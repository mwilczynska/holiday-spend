import fs from 'node:fs';
import path from 'node:path';
import {
  VIETNAM_REGISTER_STAR_FILTERS,
  parseVietnamRegisterCsrf,
  parseVietnamRegisterLastPage,
  parseVietnamRegisterListings,
  parseVietnamRegisterTotal,
  sha256Utf8,
  vietnamAccommodationRegisterCaptureSchema,
  type VietnamRegisterListing,
} from '../src/lib/vietnam-accommodation-register';

const SOURCE_URL = 'https://csdl.vietnamtourism.gov.vn/cslt/';
const HOTEL_TYPE_CODE = '1';
const GOVERNMENT_MANAGED_CODE = '0';

type PageCheckpoint = {
  page: number;
  requestUrl: string;
  reportedResultCount: number;
  rawByteCount: number;
  rawSha256: string;
  parsedRecordCount: number;
};

function parseArgs() {
  const outputIndex = process.argv.indexOf('--out');
  const cityIndex = process.argv.indexOf('--city');
  const provinceCodeIndex = process.argv.indexOf('--province-code');
  const provinceLabelIndex = process.argv.indexOf('--province-label');
  if (
    outputIndex === -1 || !process.argv[outputIndex + 1] ||
    cityIndex === -1 || !process.argv[cityIndex + 1] ||
    provinceCodeIndex === -1 || !process.argv[provinceCodeIndex + 1] ||
    provinceLabelIndex === -1 || !process.argv[provinceLabelIndex + 1]
  ) {
    throw new Error(
      'Usage: tsx scripts/capture-vietnam-accommodation-register.ts --city <name> --province-code <code> --province-label <label> --out <snapshot.json>'
    );
  }
  return {
    city: process.argv[cityIndex + 1],
    provinceCode: process.argv[provinceCodeIndex + 1],
    provinceLabel: process.argv[provinceLabelIndex + 1],
    outputPath: path.resolve(process.argv[outputIndex + 1]),
  };
}

function cookieHeader(headers: Headers, previous = '') {
  const values = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (headers.get('set-cookie') ? [headers.get('set-cookie')!] : []);
  const cookies = new Map(
    previous
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf('=');
        return [part.slice(0, separator), part.slice(separator + 1)] as [string, string];
      })
  );
  for (const value of values) {
    const pair = value.split(';', 1)[0];
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    if (name && cookieValue !== undefined) cookies.set(name, cookieValue);
  }
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function request(url: string, init: RequestInit = {}, cookie = '') {
  const headers = new Headers(init.headers);
  headers.set('User-Agent', 'HolidaySpend-ObservedFirst-Research/1.0');
  if (cookie) headers.set('Cookie', cookie);
  const response = await fetch(url, {
    ...init,
    headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Official register returned HTTP ${response.status} for ${url}`);
  const html = await response.text();
  return { html, cookie: cookieHeader(response.headers, cookie) };
}

function checkpoint(page: number, requestUrl: string, html: string): PageCheckpoint {
  return {
    page,
    requestUrl,
    reportedResultCount: parseVietnamRegisterTotal(html),
    rawByteCount: Buffer.byteLength(html, 'utf8'),
    rawSha256: sha256Utf8(html),
    parsedRecordCount: parseVietnamRegisterListings(html).length,
  };
}

async function captureStar(stars: number, rateCode: string, provinceCode: string) {
  let { html: landingHtml, cookie } = await request(SOURCE_URL);
  const filterBody = (csrf: string) =>
    new URLSearchParams({
      csrf_name: csrf,
      title: '',
      province: provinceCode,
      'rate[]': rateCode,
      'type[]': HOTEL_TYPE_CODE,
      'manager[]': GOVERNMENT_MANAGED_CODE,
    });
  const filtered = await request(
    SOURCE_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: filterBody(parseVietnamRegisterCsrf(landingHtml)),
    },
    cookie
  );
  cookie = filtered.cookie;
  const expectedRecordCount = parseVietnamRegisterTotal(filtered.html);
  const firstPageRecords = parseVietnamRegisterListings(filtered.html);
  if (firstPageRecords.length === 0) {
    throw new Error(`${stars}-star capture returned a nonzero total without listing records`);
  }
  const navigationLastPage = parseVietnamRegisterLastPage(filtered.html);
  const lastPage = Math.ceil(expectedRecordCount / firstPageRecords.length);
  if (navigationLastPage > lastPage) {
    throw new Error(`${stars}-star pagination exposes more pages than the result count permits`);
  }
  const pages: PageCheckpoint[] = [checkpoint(1, SOURCE_URL, filtered.html)];
  const records: VietnamRegisterListing[] = firstPageRecords;
  let previousHtml = filtered.html;

  for (let page = 2; page <= lastPage; page += 1) {
    const requestUrl = `${SOURCE_URL}?page=${page}`;
    const result = await request(
      requestUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: filterBody(parseVietnamRegisterCsrf(previousHtml)),
      },
      cookie
    );
    cookie = result.cookie;
    previousHtml = result.html;
    const pageTotal = parseVietnamRegisterTotal(result.html);
    if (pageTotal !== expectedRecordCount) {
      throw new Error(
        `${stars}-star page ${page} drifted from ${expectedRecordCount} to ${pageTotal} records during capture`
      );
    }
    pages.push(checkpoint(page, requestUrl, result.html));
    records.push(...parseVietnamRegisterListings(result.html));
  }

  const ids = new Set(records.map((record) => record.sourcePropertyId));
  if (records.length !== expectedRecordCount || ids.size !== records.length) {
    throw new Error(
      `${stars}-star capture expected ${expectedRecordCount} unique rows but parsed ${records.length} rows / ${ids.size} ids across ${lastPage} pages (${pages.map((page) => `${page.parsedRecordCount}/${page.reportedResultCount}`).join(', ')})`
    );
  }
  return { stars, rateCode, expectedRecordCount, lastPage, pages, records };
}

async function main() {
  const { city, provinceCode, provinceLabel, outputPath } = parseArgs();
  if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite existing snapshot: ${outputPath}`);
  const capturedAt = new Date().toISOString();
  const strata = [];
  for (const filter of VIETNAM_REGISTER_STAR_FILTERS) {
    strata.push(await captureStar(filter.stars, filter.rateCode, provinceCode));
  }
  const allIds = strata.flatMap((stratum) => stratum.records.map((record) => record.sourcePropertyId));
  if (new Set(allIds).size !== allIds.length) {
    throw new Error('A property id appeared in more than one official star stratum');
  }
  const snapshot = vietnamAccommodationRegisterCaptureSchema.parse({
    schemaVersion: 'vietnam-accommodation-register-capture-v1',
    capturedAt,
    publisher: 'Viet Nam National Authority of Tourism',
    sourceUrl: SOURCE_URL,
    sourceStatement: 'Thông tin do Cơ quan nhà nước quản lý',
    filters: {
      province: { code: provinceCode, label: provinceLabel },
      type: { code: HOTEL_TYPE_CODE, label: 'Khách sạn' },
      manager: { code: GOVERNMENT_MANAGED_CODE, label: 'Government-managed information' },
      starRateCodes: Object.fromEntries(
        VIETNAM_REGISTER_STAR_FILTERS.map((filter) => [filter.stars, filter.rateCode])
      ),
    },
    strata,
    totalRecordCount: allIds.length,
  });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  console.log(`Captured ${allIds.length} unique government-managed 1-4-star ${city} hotels`);
  for (const stratum of strata) {
    console.log(`${stratum.stars}-star: ${stratum.expectedRecordCount} records across ${stratum.lastPage} pages`);
  }
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

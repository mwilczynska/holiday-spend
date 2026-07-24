import { createHash } from 'node:crypto';
import { z } from 'zod';

export const VIETNAM_REGISTER_STAR_FILTERS = [
  { stars: 1, rateCode: '5' },
  { stars: 2, rateCode: '4' },
  { stars: 3, rateCode: '3' },
  { stars: 4, rateCode: '2' },
] as const;

export type VietnamRegisterStar = (typeof VIETNAM_REGISTER_STAR_FILTERS)[number]['stars'];

export type VietnamRegisterListing = {
  sourcePropertyId: string;
  name: string;
  address: string | null;
};

const pageCheckpointSchema = z.object({
  page: z.number().int().positive(),
  requestUrl: z.string().url(),
  reportedResultCount: z.number().int().nonnegative(),
  rawByteCount: z.number().int().positive(),
  rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
  parsedRecordCount: z.number().int().nonnegative(),
});

const listingSchema = z.object({
  sourcePropertyId: z.string().regex(/^\d+$/),
  name: z.string().min(1),
  address: z.string().min(1).nullable(),
});

export const vietnamAccommodationRegisterCaptureSchema = z
  .object({
    schemaVersion: z.literal('vietnam-accommodation-register-capture-v1'),
    capturedAt: z.string().datetime(),
    publisher: z.literal('Viet Nam National Authority of Tourism'),
    sourceUrl: z.literal('https://csdl.vietnamtourism.gov.vn/cslt/'),
    sourceStatement: z.literal('Thông tin do Cơ quan nhà nước quản lý'),
    filters: z.object({
      province: z.object({ code: z.string().min(1), label: z.string().min(1) }),
      type: z.object({ code: z.literal('1'), label: z.literal('Khách sạn') }),
      manager: z.object({ code: z.literal('0'), label: z.literal('Government-managed information') }),
      starRateCodes: z.object({
        '1': z.literal('5'),
        '2': z.literal('4'),
        '3': z.literal('3'),
        '4': z.literal('2'),
      }),
    }),
    strata: z
      .array(
        z.object({
          stars: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
          rateCode: z.string(),
          expectedRecordCount: z.number().int().positive(),
          lastPage: z.number().int().positive(),
          pages: z.array(pageCheckpointSchema).min(1),
          records: z.array(listingSchema).min(1),
        })
      )
      .length(4),
    totalRecordCount: z.number().int().positive(),
  })
  .superRefine((capture, context) => {
    const expectedFilters = new Map(
      VIETNAM_REGISTER_STAR_FILTERS.map((filter) => [filter.stars, filter.rateCode])
    );
    const seenStars = new Set<number>();
    const seenIds = new Set<string>();
    let total = 0;
    capture.strata.forEach((stratum, stratumIndex) => {
      const path = ['strata', stratumIndex] as const;
      if (seenStars.has(stratum.stars)) {
        context.addIssue({ code: 'custom', path: [...path, 'stars'], message: 'Duplicate star stratum' });
      }
      seenStars.add(stratum.stars);
      if (stratum.rateCode !== expectedFilters.get(stratum.stars)) {
        context.addIssue({ code: 'custom', path: [...path, 'rateCode'], message: 'Star filter code mismatch' });
      }
      if (
        stratum.records.length !== stratum.expectedRecordCount ||
        stratum.pages.length !== stratum.lastPage ||
        stratum.pages.reduce((sum, page) => sum + page.parsedRecordCount, 0) !==
          stratum.expectedRecordCount
      ) {
        context.addIssue({ code: 'custom', path: [...path], message: 'Stratum counts do not reconcile' });
      }
      stratum.pages.forEach((page, pageIndex) => {
        if (page.page !== pageIndex + 1 || page.reportedResultCount !== stratum.expectedRecordCount) {
          context.addIssue({ code: 'custom', path: [...path, 'pages', pageIndex], message: 'Page sequence or reported total mismatch' });
        }
      });
      stratum.records.forEach((record, recordIndex) => {
        if (seenIds.has(record.sourcePropertyId)) {
          context.addIssue({ code: 'custom', path: [...path, 'records', recordIndex, 'sourcePropertyId'], message: 'Property id appears in multiple records' });
        }
        seenIds.add(record.sourcePropertyId);
      });
      total += stratum.records.length;
    });
    if (seenStars.size !== 4 || total !== capture.totalRecordCount) {
      context.addIssue({ code: 'custom', path: ['totalRecordCount'], message: 'Capture totals or star coverage do not reconcile' });
    }
  });

export type VietnamAccommodationRegisterCapture = z.infer<
  typeof vietnamAccommodationRegisterCaptureSchema
>;

function decodeHtml(value: string) {
  const namedEntities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => namedEntities[name] ?? entity);
}

function plainText(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function sha256Utf8(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function parseVietnamRegisterCsrf(html: string) {
  const match = html.match(/name=["']csrf_name["'][^>]*value=["']([^"']+)["']/i);
  if (!match) throw new Error('Official register page did not expose a CSRF token');
  return match[1];
}

export function parseVietnamRegisterTotal(html: string) {
  const match = plainText(html).match(/Tổng số:\s*([\d.,]+)\s*kết quả/i);
  if (!match) throw new Error('Official register page did not expose a result count');
  return Number(match[1].replace(/[.,]/g, ''));
}

export function parseVietnamRegisterLastPage(html: string) {
  const pages = Array.from(html.matchAll(/[?&]page=(\d+)/g)).map((match) => Number(match[1]));
  return Math.max(1, ...pages);
}

export function parseVietnamRegisterListings(html: string): VietnamRegisterListing[] {
  const matches = Array.from(
    html.matchAll(/<h4>\s*<a\s+href=["']\/cslt\/\?item=(\d+)["']>([\s\S]*?)<\/a>/gi)
  );
  const listings = matches.map((match, index) => {
    const start = match.index! + match[0].length;
    const end = matches[index + 1]?.index ?? html.length;
    const cardRemainder = html.slice(start, end);
    const addressMatch = cardRemainder.match(
      /<i\s+class=["']fa fa-map-marker["'][^>]*><\/i>\s*&nbsp;\s*Địa chỉ:\s*([\s\S]*?)<\/span>/i
    );
    return {
      sourcePropertyId: match[1],
      name: plainText(match[2]),
      address: addressMatch ? plainText(addressMatch[1]) : null,
    };
  });
  const ids = new Set(listings.map((listing) => listing.sourcePropertyId));
  if (ids.size !== listings.length) {
    throw new Error('Official register page contains duplicate property ids');
  }
  return listings;
}

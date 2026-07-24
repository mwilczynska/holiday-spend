import { z } from 'zod';

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const daNangGeocodingManifestSchema = z.object({
  recordType: z.literal('manifest'),
  schemaVersion: z.literal('da-nang-accommodation-geocoding-v1'),
  createdAt: z.string().datetime(),
  snapshotSha256: sha256Schema,
  snapshotRecordCount: z.literal(423),
  queryCohortRecordCount: z.number().int().positive(),
  deferredAdministrativeReview: z.array(
    z.object({
      sourcePropertyId: z.string().regex(/^\d+$/),
      stars: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
      address: z.string().min(1),
      reason: z.literal('former_quang_nam_or_remote_merged_ward_requires_boundary_review'),
    })
  ),
  serviceUrl: z.literal('https://nominatim.openstreetmap.org/search'),
  policyUrl: z.literal('https://operations.osmfoundation.org/policies/nominatim/'),
  attribution: z.literal('Data © OpenStreetMap contributors, ODbL 1.0'),
  requestIntervalMs: z.number().int().min(1000),
  queryContract: z.object({
    format: z.literal('jsonv2'),
    countrycodes: z.literal('vn'),
    addressdetails: z.literal(1),
    namedetails: z.literal(1),
    limit: z.literal(5),
    acceptLanguage: z.literal('vi,en'),
    addressNormalization: z.literal(
      'remove_legacy_urban_district_then_replace_terminal_thanh_pho_da_nang_with_da_nang_v1'
    ),
  }),
}).superRefine((manifest, context) => {
  if (
    manifest.queryCohortRecordCount + manifest.deferredAdministrativeReview.length !==
    manifest.snapshotRecordCount
  ) {
    context.addIssue({
      code: 'custom',
      path: ['queryCohortRecordCount'],
      message: 'Query cohort and deferred records must reconcile to the frozen snapshot',
    });
  }
});

const nominatimResultSchema = z.object({
  place_id: z.number().int(),
  licence: z.string().min(1),
  osm_type: z.string().optional(),
  osm_id: z.number().int().optional(),
  lat: z.string().regex(/^-?\d+(?:\.\d+)?$/),
  lon: z.string().regex(/^-?\d+(?:\.\d+)?$/),
  category: z.string().optional(),
  type: z.string().optional(),
  addresstype: z.string().optional(),
  display_name: z.string().min(1),
  importance: z.number().optional(),
  address: z.record(z.string(), z.string()).nullable().optional(),
  namedetails: z.record(z.string(), z.string()).nullable().optional(),
});

const geocodingRequestSchema = z.object({
  strategy: z.enum(['name_and_normalized_address', 'normalized_address_only']),
  query: z.string().min(1),
  requestedAt: z.string().datetime(),
  responseUrl: z.string().url(),
  responseByteCount: z.number().int().nonnegative(),
  responseSha256: sha256Schema,
  results: z.array(nominatimResultSchema).max(5),
});

export const daNangGeocodingAttemptSchema = z.object({
  recordType: z.literal('geocode_attempt'),
  schemaVersion: z.literal('da-nang-accommodation-geocoding-v1'),
  sourcePropertyId: z.string().regex(/^\d+$/),
  stars: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  name: z.string().min(1),
  address: z.string().min(1),
  requests: z.array(geocodingRequestSchema).min(1).max(2),
}).superRefine((attempt, context) => {
  if (attempt.requests[0].strategy !== 'name_and_normalized_address') {
    context.addIssue({ code: 'custom', path: ['requests', 0], message: 'Primary query strategy mismatch' });
  }
  if (
    attempt.requests.length === 2 &&
    (attempt.requests[0].results.length !== 0 ||
      attempt.requests[1].strategy !== 'normalized_address_only')
  ) {
    context.addIssue({ code: 'custom', path: ['requests', 1], message: 'Fallback is only valid after an empty primary result' });
  }
});

export type DaNangGeocodingManifest = z.infer<typeof daNangGeocodingManifestSchema>;
export type DaNangGeocodingAttempt = z.infer<typeof daNangGeocodingAttemptSchema>;

function normalized(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizedBrand(value: string) {
  return normalized(value)
    .replace(/\b(khach san|biet thu du lich|hotel|villa|resort)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameMatches(sourceName: string, candidateName: string) {
  const source = normalizedBrand(sourceName);
  const candidate = normalizedBrand(candidateName);
  if (!source || !candidate) return false;
  if (source === candidate || source.includes(candidate) || candidate.includes(source)) return true;
  const sourceTokens = new Set(source.split(' '));
  const candidateTokens = new Set(candidate.split(' '));
  const intersection = Array.from(sourceTokens).filter((token) => candidateTokens.has(token)).length;
  const union = new Set([...Array.from(sourceTokens), ...Array.from(candidateTokens)]).size;
  return union > 0 && intersection / union >= 0.6;
}

function sourceStreetAddress(address: string) {
  const firstPart = address.split(',')[0].trim();
  const match = firstPart.match(/^(\d+(?:[a-z]|[-/]\d+[a-z]?)*)\s+(.+)$/i);
  return match ? { houseNumber: normalized(match[1]), road: normalized(match[2]) } : null;
}

function resultIsDaNang(result: DaNangGeocodingAttempt['requests'][number]['results'][number]) {
  const address = result.address ?? {};
  return (
    address.country_code === 'vn' &&
    Object.values(address).some((value) => normalized(value).includes('da nang'))
  );
}

export function classifyDaNangGeocodingAttempt(attempt: DaNangGeocodingAttempt) {
  const candidates = attempt.requests.flatMap((request, requestIndex) =>
    request.results.map((result, resultIndex) => ({ requestIndex, resultIndex, result }))
  );
  for (const candidate of candidates) {
    const resultName =
      candidate.result.namedetails?.name ??
      candidate.result.address?.tourism ??
      candidate.result.display_name.split(',')[0];
    if (
      resultIsDaNang(candidate.result) &&
      candidate.result.category === 'tourism' &&
      ['hotel', 'hostel', 'guest_house', 'motel'].includes(candidate.result.type ?? '') &&
      nameMatches(attempt.name, resultName)
    ) {
      return { status: 'poi_name_match' as const, ...candidate };
    }
  }
  const sourceAddress = sourceStreetAddress(attempt.address);
  if (sourceAddress) {
    for (const candidate of candidates) {
      const resultAddress = candidate.result.address ?? {};
      const resultHouseNumber = normalized(resultAddress.house_number ?? '');
      const resultRoad = normalized(resultAddress.road ?? '');
      if (
        resultIsDaNang(candidate.result) &&
        resultHouseNumber === sourceAddress.houseNumber &&
        resultRoad &&
        (resultRoad.includes(sourceAddress.road) || sourceAddress.road.includes(resultRoad))
      ) {
        return { status: 'exact_house_address' as const, ...candidate };
      }
    }
  }
  return candidates.length > 0
    ? { status: 'coarse_or_ambiguous' as const }
    : { status: 'no_result' as const };
}

export function parseDaNangGeocodingJsonl(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error('Geocoding checkpoint is empty');
  const manifest = daNangGeocodingManifestSchema.parse(JSON.parse(lines[0]));
  const attempts = lines.slice(1).map((line) => daNangGeocodingAttemptSchema.parse(JSON.parse(line)));
  const ids = new Set<string>();
  attempts.forEach((attempt) => {
    if (ids.has(attempt.sourcePropertyId)) {
      throw new Error(`Duplicate geocoding attempt for ${attempt.sourcePropertyId}`);
    }
    ids.add(attempt.sourcePropertyId);
  });
  return { manifest, attempts };
}

export function summarizeDaNangGeocoding(attempts: DaNangGeocodingAttempt[]) {
  const results = (attempt: DaNangGeocodingAttempt) =>
    attempt.requests.flatMap((request) => request.results);
  const classifications = attempts.map(classifyDaNangGeocodingAttempt);
  return {
    attempted: attempts.length,
    requests: attempts.reduce((sum, attempt) => sum + attempt.requests.length, 0),
    withResults: attempts.filter((attempt) => results(attempt).length > 0).length,
    withoutResults: attempts.filter((attempt) => results(attempt).length === 0).length,
    withTourismPoiCandidate: attempts.filter((attempt) =>
      results(attempt).some(
        (result) =>
          result.category === 'tourism' &&
          ['hotel', 'hostel', 'guest_house', 'motel'].includes(result.type ?? '')
      )
    ).length,
    poiNameMatches: classifications.filter((result) => result.status === 'poi_name_match').length,
    exactHouseAddressMatches: classifications.filter(
      (result) => result.status === 'exact_house_address'
    ).length,
    coarseOrAmbiguous: classifications.filter(
      (result) => result.status === 'coarse_or_ambiguous'
    ).length,
    noResult: classifications.filter((result) => result.status === 'no_result').length,
  };
}

export function requiresDaNangAdministrativeBoundaryReview(address: string) {
  return (
    /,\s*Quảng Nam\s*$/i.test(address) ||
    /P\.\s*Hội An,\s*Thành phố Đà Nẵng\s*$/i.test(address) ||
    /P\.\s*Điện Bàn Đông,\s*Thành phố Đà Nẵng\s*$/i.test(address)
  );
}

export function normalizeDaNangGeocodingAddress(address: string) {
  return address
    .replace(/,\s*Quận [^,]+/gi, '')
    .replace(/,\s*Thành phố Đà Nẵng\s*$/i, ', Đà Nẵng')
    .replace(/\s+/g, ' ')
    .trim();
}

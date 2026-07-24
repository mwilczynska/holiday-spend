import { describe, expect, it } from 'vitest';
import {
  parseDaNangGeocodingJsonl,
  classifyDaNangGeocodingAttempt,
  normalizeDaNangGeocodingAddress,
  requiresDaNangAdministrativeBoundaryReview,
  summarizeDaNangGeocoding,
} from './da-nang-accommodation-geocoding';

const manifest = {
  recordType: 'manifest',
  schemaVersion: 'da-nang-accommodation-geocoding-v1',
  createdAt: '2026-07-24T15:00:00.000Z',
  snapshotSha256: 'a'.repeat(64),
  snapshotRecordCount: 423,
  queryCohortRecordCount: 422,
  deferredAdministrativeReview: [
    {
      sourcePropertyId: '9999',
      stars: 1,
      address: 'Thành phố Hội An, Quảng Nam',
      reason: 'former_quang_nam_or_remote_merged_ward_requires_boundary_review',
    },
  ],
  serviceUrl: 'https://nominatim.openstreetmap.org/search',
  policyUrl: 'https://operations.osmfoundation.org/policies/nominatim/',
  attribution: 'Data © OpenStreetMap contributors, ODbL 1.0',
  requestIntervalMs: 1100,
  queryContract: {
    format: 'jsonv2',
    countrycodes: 'vn',
    addressdetails: 1,
    namedetails: 1,
    limit: 5,
    acceptLanguage: 'vi,en',
    addressNormalization:
      'remove_legacy_urban_district_then_replace_terminal_thanh_pho_da_nang_with_da_nang_v1',
  },
};

const attempt = {
  recordType: 'geocode_attempt',
  schemaVersion: 'da-nang-accommodation-geocoding-v1',
  sourcePropertyId: '1586',
  stars: 4,
  name: 'Khách sạn À La Carte Đà Nẵng',
  address: '200 Võ Nguyên Giáp, Thành phố Đà Nẵng',
  requests: [
    {
      strategy: 'name_and_normalized_address',
      query: 'Khách sạn À La Carte Đà Nẵng, 200 Võ Nguyên Giáp, Đà Nẵng, Việt Nam',
      requestedAt: '2026-07-24T15:00:01.000Z',
      responseUrl: 'https://nominatim.openstreetmap.org/search?q=test',
      responseByteCount: 200,
      responseSha256: 'b'.repeat(64),
      results: [
        {
          place_id: 1,
          licence: 'Data © OpenStreetMap contributors, ODbL 1.0',
          osm_type: 'way',
          osm_id: 2,
          lat: '16.068',
          lon: '108.244',
          category: 'tourism',
          type: 'hotel',
          display_name: 'À La Carte, Đà Nẵng, Việt Nam',
          address: { country_code: 'vn', city: 'Đà Nẵng' },
        },
      ],
    },
  ],
};

describe('Da Nang accommodation geocoding checkpoint', () => {
  it('parses a manifest and unique attempts', () => {
    const parsed = parseDaNangGeocodingJsonl(
      `${JSON.stringify(manifest)}\n${JSON.stringify(attempt)}\n`
    );
    expect(summarizeDaNangGeocoding(parsed.attempts)).toEqual({
      attempted: 1,
      requests: 1,
      withResults: 1,
      withoutResults: 0,
      withTourismPoiCandidate: 1,
      poiNameMatches: 1,
      exactHouseAddressMatches: 0,
      coarseOrAmbiguous: 0,
      noResult: 0,
    });
  });

  it('rejects duplicate attempts so resume cannot overwrite evidence', () => {
    const value = `${JSON.stringify(manifest)}\n${JSON.stringify(attempt)}\n${JSON.stringify(attempt)}\n`;
    expect(() => parseDaNangGeocodingJsonl(value)).toThrow(/Duplicate geocoding attempt/);
  });

  it('defers former Quang Nam and remote merged-ward addresses without treating them as ranked', () => {
    expect(
      requiresDaNangAdministrativeBoundaryReview('80 Trần Hưng Đạo, Thành phố Hội An, Quảng Nam')
    ).toBe(true);
    expect(
      requiresDaNangAdministrativeBoundaryReview('Khối phố An Bàng, P. Hội An, Thành phố Đà Nẵng')
    ).toBe(true);
    expect(
      requiresDaNangAdministrativeBoundaryReview('200 Võ Nguyên Giáp, Quận Sơn Trà, Thành phố Đà Nẵng')
    ).toBe(false);
  });

  it('normalizes legacy urban-district labels without changing the stored source address', () => {
    expect(
      normalizeDaNangGeocodingAddress(
        '236 Hồ Nghinh, An Hải, Quận Sơn Trà, Thành phố Đà Nẵng'
      )
    ).toBe('236 Hồ Nghinh, An Hải, Đà Nẵng');
  });

  it('does not accept a road-only fallback as a property coordinate', () => {
    const coarse = JSON.parse(JSON.stringify(attempt));
    coarse.requests[0].results = [
      {
        place_id: 2,
        licence: 'Data © OpenStreetMap contributors, ODbL 1.0',
        lat: '16.07',
        lon: '108.23',
        category: 'highway',
        type: 'residential',
        display_name: 'Đường Võ Nguyên Giáp, Thành phố Đà Nẵng, Việt Nam',
        address: { road: 'Đường Võ Nguyên Giáp', city: 'Thành phố Đà Nẵng', country_code: 'vn' },
      },
    ];
    expect(classifyDaNangGeocodingAttempt(coarse as never).status).toBe('coarse_or_ambiguous');
  });
});

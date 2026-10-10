import { describe, expect, it } from 'vitest';
import { basePlaceName, distanceKm, lookupCityImage } from './city-image-lookup';

// Offline fakes of the three Wikimedia APIs, keyed by host and request shape.
function fakeFetch(handlers: {
  search: unknown;
  commons?: Record<string, unknown>;
  wikidata?: Record<string, string>;
}) {
  return async (url: string) => {
    const parsed = new URL(url);
    let body: unknown;
    if (parsed.host === 'en.wikipedia.org') body = handlers.search;
    else if (parsed.host === 'www.wikidata.org') {
      const file = handlers.wikidata?.[parsed.searchParams.get('entity') ?? ''];
      body = { claims: file ? { P18: [{ mainsnak: { datavalue: { value: file } } }] } : {} };
    } else {
      const title = (parsed.searchParams.get('titles') ?? '').replace(/^File:/, '');
      const info = handlers.commons?.[title];
      body = { query: { pages: [info ? { imageinfo: [info] } : { missing: true }] } };
    }
    return new Response(JSON.stringify(body), { status: 200 });
  };
}

const freeInfo = (file: string) => ({
  mime: 'image/jpeg', width: 4000, height: 3000, url: `https://upload.example/${file}`, thumburl: `https://upload.example/1280px-${file}`,
  descriptionurl: `https://commons.wikimedia.org/wiki/File:${file}`,
  extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="x">Jane Doe</a>' }, AttributionRequired: { value: 'true' } },
});

// Salento, Colombia, and Salento, Italy (about 9,000 km apart).
const salentoColombia = { name: 'Salento', countryName: 'Colombia', latitude: 4.637, longitude: -75.570 };

describe('city image lookup', () => {
  it('normalises place names and measures distance', () => {
    expect(basePlaceName('Bali (Ubud)')).toBe('ubud');
    expect(basePlaceName('Hội An')).toBe('hoi an');
    expect(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(111.2, 0);
  });

  it('rejects a same-name article far from the city and accepts the one nearby', async () => {
    const result = await lookupCityImage(salentoColombia, fakeFetch({
      search: { query: { pages: [
        { index: 1, title: 'Salento', coordinates: [{ lat: 40.25, lon: 18.17 }], pageimage: 'Italy.jpg' },
        { index: 2, title: 'Salento, Quindío', coordinates: [{ lat: 4.64, lon: -75.57 }], pageimage: 'Colombia.jpg' },
      ] } },
      commons: { 'Italy.jpg': freeInfo('Italy.jpg'), 'Colombia.jpg': freeInfo('Colombia.jpg') },
    }));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.image).toMatchObject({ articleTitle: 'Salento, Quindío', commonsFile: 'Colombia.jpg', artist: 'Jane Doe', license: 'CC BY-SA 4.0' });
    expect(result.image.distanceKm).toBeLessThan(5);
  });

  it('prefers the place article over a landmark inside it', async () => {
    const ubud = { name: 'Bali (Ubud)', countryName: 'Indonesia', latitude: -8.506, longitude: 115.262 };
    const result = await lookupCityImage(ubud, fakeFetch({
      search: { query: { pages: [
        { index: 1, title: 'Ubud Palace', coordinates: [{ lat: -8.507, lon: 115.263 }], pageimage: 'Palace.jpg' },
        { index: 2, title: 'Ubud', coordinates: [{ lat: -8.51, lon: 115.26 }], pageimage: 'Town.jpg' },
      ] } },
      commons: { 'Palace.jpg': freeInfo('Palace.jpg'), 'Town.jpg': freeInfo('Town.jpg') },
    }));
    expect(result.status === 'ok' && result.image.commonsFile).toBe('Town.jpg');
  });

  it('falls back to Wikidata when the lead image is not on Commons', async () => {
    const result = await lookupCityImage(salentoColombia, fakeFetch({
      search: { query: { pages: [
        { index: 1, title: 'Salento, Quindío', coordinates: [{ lat: 4.64, lon: -75.57 }], pageimage: 'Local.jpg', pageprops: { wikibase_item: 'Q1' } },
      ] } },
      wikidata: { Q1: 'Free.jpg' },
      commons: { 'Free.jpg': freeInfo('Free.jpg') },
    }));
    expect(result.status === 'ok' && result.image).toMatchObject({ source: 'wikidata', commonsFile: 'Free.jpg' });
  });

  it('fails closed on disambiguation pages, SVGs and non-free licences', async () => {
    const svg = { ...freeInfo('Map.svg'), mime: 'image/svg+xml' };
    const nonFree = { ...freeInfo('Poster.jpg'), extmetadata: { LicenseShortName: { value: 'Fair use' } } };
    expect((await lookupCityImage(salentoColombia, fakeFetch({
      search: { query: { pages: [{ index: 1, title: 'Salento (disambiguation)', coordinates: [{ lat: 4.64, lon: -75.57 }], pageprops: { disambiguation: '' } }] } },
    }))).status).toBe('no-article');
    expect((await lookupCityImage(salentoColombia, fakeFetch({
      search: { query: { pages: [{ index: 1, title: 'Salento, Quindío', coordinates: [{ lat: 4.64, lon: -75.57 }], pageimage: 'Map.svg', pageprops: { wikibase_item: 'Q1' } }] } },
      wikidata: { Q1: 'Poster.jpg' },
      commons: { 'Map.svg': svg, 'Poster.jpg': nonFree },
    }))).status).toBe('no-free-image');
  });
});

import { describe, expect, it } from 'vitest';
import { basePlaceName, distanceKm, lookupCityImage } from './city-image-lookup';

// Offline fakes of the three Wikimedia APIs, keyed by host and request shape.
function fakeFetch(handlers: {
  search: unknown;
  commons?: Record<string, unknown>;
  wikidata?: Record<string, string>;
  /** Item id -> its P17 countries; ISO code -> country item ids. */
  countriesOf?: Record<string, string[]>;
  countryItems?: Record<string, string[]>;
  /** Item id -> its Wikidata coordinate (P625). */
  itemCoordinates?: Record<string, { latitude: number; longitude: number }>;
}) {
  return async (url: string) => {
    const parsed = new URL(url);
    let body: unknown;
    if (parsed.host === 'en.wikipedia.org') body = handlers.search;
    else if (parsed.host === 'www.wikidata.org' && parsed.searchParams.get('list') === 'search') {
      const iso = (parsed.searchParams.get('srsearch') ?? '').split('=').pop() ?? '';
      body = { query: { search: (handlers.countryItems?.[iso] ?? []).map((title) => ({ title })) } };
    } else if (parsed.host === 'www.wikidata.org' && parsed.searchParams.get('property') === 'P17') {
      const ids = handlers.countriesOf?.[parsed.searchParams.get('entity') ?? ''] ?? [];
      body = { claims: { P17: ids.map((id) => ({ mainsnak: { datavalue: { value: { id } } } })) } };
    } else if (parsed.host === 'www.wikidata.org' && parsed.searchParams.get('property') === 'P625') {
      const value = handlers.itemCoordinates?.[parsed.searchParams.get('entity') ?? ''];
      body = { claims: value ? { P625: [{ mainsnak: { datavalue: { value } } }] } : {} };
    } else if (parsed.host === 'www.wikidata.org') {
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

  it('uses Wikidata coordinates for a city article without its own and never picks a facility', async () => {
    const krakow = { name: 'Krakow', countryName: 'Poland', latitude: 50.06, longitude: 19.94 };
    const result = await lookupCityImage(krakow, fakeFetch({
      search: { query: { pages: [
        { index: 1, title: 'Kraków', pageimage: 'Old_Town.jpg', pageprops: { wikibase_item: 'Q31487' } },
        { index: 2, title: 'Kraków John Paul II International Airport', coordinates: [{ lat: 50.08, lon: 19.78 }], pageimage: 'Terminal.jpg' },
      ] } },
      itemCoordinates: { Q31487: { latitude: 50.0614, longitude: 19.9372 } },
      commons: { 'Old_Town.jpg': freeInfo('Old_Town.jpg'), 'Terminal.jpg': freeInfo('Terminal.jpg') },
    }));
    expect(result.status === 'ok' && result.image.articleTitle).toBe('Kraków');
  });

  it('uses any nearby article point, then Wikidata, and skips events named after the city', async () => {
    const seoul = { name: 'Seoul', countryName: 'South Korea', latitude: 37.57, longitude: 126.98 };
    const pages = [
      { index: 1, title: 'Seoul', coordinates: [{ lat: 36, lon: 128 }], pageimage: 'Skyline.jpg', pageprops: { wikibase_item: 'Q8684' } },
      { index: 2, title: 'Seoul Halloween crowd crush', coordinates: [{ lat: 37.53, lon: 126.99 }], pageimage: 'Crowd.jpg' },
    ];
    const commons = { 'Skyline.jpg': freeInfo('Skyline.jpg'), 'Crowd.jpg': freeInfo('Crowd.jpg') };
    const viaWikidata = await lookupCityImage(seoul, fakeFetch({ search: { query: { pages } }, commons, itemCoordinates: { Q8684: { latitude: 37.56, longitude: 126.99 } } }));
    expect(viaWikidata.status === 'ok' && viaWikidata.image.articleTitle).toBe('Seoul');
    const withSecondPoint = await lookupCityImage(seoul, fakeFetch({
      search: { query: { pages: [{ ...pages[0], coordinates: [{ lat: 36, lon: 128 }, { lat: 37.56, lon: 126.99 }] }, pages[1]] } }, commons,
    }));
    expect(withSecondPoint.status === 'ok' && withSecondPoint.image.articleTitle).toBe('Seoul');
    // Without either, the event article is still never chosen.
    expect((await lookupCityImage(seoul, fakeFetch({ search: { query: { pages } }, commons }))).status).toBe('no-article');
  });

  it('matches names that differ only in spacing or punctuation', async () => {
    const result = await lookupCityImage({ name: 'Sapa', countryName: 'Vietnam', latitude: 22.34, longitude: 103.84 }, fakeFetch({
      search: { query: { pages: [
        { index: 1, title: 'Sapa Valley Resort', coordinates: [{ lat: 22.35, lon: 103.85 }], pageimage: 'Resort.jpg' },
        { index: 2, title: 'Sa Pa, Lào Cai', coordinates: [{ lat: 22.336, lon: 103.844 }], pageimage: 'Terraces.jpg' },
      ] } },
      commons: { 'Resort.jpg': freeInfo('Resort.jpg'), 'Terraces.jpg': freeInfo('Terraces.jpg') },
    }));
    expect(result.status === 'ok' && result.image.commonsFile).toBe('Terraces.jpg');
  });

  describe('without coordinates', () => {
    const italy = { index: 1, title: 'Salento', coordinates: [{ lat: 40.25, lon: 18.17 }], pageimage: 'Italy.jpg', pageprops: { wikibase_item: 'Q_IT_SALENTO' } };
    const colombia = { index: 2, title: 'Salento, Quindío', coordinates: [{ lat: 4.64, lon: -75.57 }], pageimage: 'Colombia.jpg', pageprops: { wikibase_item: 'Q_CO_SALENTO' } };
    const network = (pages: unknown[]) => fakeFetch({
      search: { query: { pages } },
      commons: { 'Italy.jpg': freeInfo('Italy.jpg'), 'Colombia.jpg': freeInfo('Colombia.jpg'), 'Skyline.jpg': freeInfo('Skyline.jpg') },
      countryItems: { CO: ['Q739'], HK: ['Q8646'] },
      countriesOf: { Q_IT_SALENTO: ['Q38'], Q_CO_SALENTO: ['Q739'], Q8646: ['Q148'] },
    });
    const query = { name: 'Salento', countryName: 'Colombia', countryCode: 'CO' };

    it('accepts a title match only when its Wikidata country is the city country', async () => {
      const result = await lookupCityImage(query, network([italy, colombia]));
      expect(result.status === 'ok' && result.image).toMatchObject({ commonsFile: 'Colombia.jpg', locationCheck: 'country', distanceKm: null });
      expect((await lookupCityImage(query, network([italy]))).status).toBe('no-article');
    });

    it('accepts a territory that is itself the country item', async () => {
      const result = await lookupCityImage({ name: 'Hong Kong', countryName: 'Hong Kong', countryCode: 'HK' }, network([
        { index: 1, title: 'Hong Kong', coordinates: [{ lat: 22.3, lon: 114.2 }], pageimage: 'Skyline.jpg', pageprops: { wikibase_item: 'Q8646' } },
      ]));
      expect(result.status === 'ok' && result.image.commonsFile).toBe('Skyline.jpg');
    });

    it('prefers the top result over a building that starts with the name', async () => {
      const result = await lookupCityImage({ name: 'Marrakech', countryName: 'Morocco', countryCode: 'MA' }, fakeFetch({
        search: { query: { pages: [
          { index: 1, title: 'Marrakesh', coordinates: [{ lat: 31.6, lon: -8.0 }], pageimage: 'Medina.jpg', pageprops: { wikibase_item: 'Q101625' } },
          { index: 2, title: 'Marrakech Museum', coordinates: [{ lat: 31.63, lon: -7.99 }], pageimage: 'Courtyard.jpg', pageprops: { wikibase_item: 'Q3090631' } },
        ] } },
        commons: { 'Medina.jpg': freeInfo('Medina.jpg'), 'Courtyard.jpg': freeInfo('Courtyard.jpg') },
        countryItems: { MA: ['Q1028'] },
        countriesOf: { Q101625: ['Q1028'], Q3090631: ['Q1028'] },
      }));
      expect(result.status === 'ok' && result.image.articleTitle).toBe('Marrakesh');
    });

    it('returns no article without a country code', async () => {
      expect((await lookupCityImage({ name: 'Salento', countryName: 'Colombia' }, network([colombia]))).status).toBe('no-article');
    });
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

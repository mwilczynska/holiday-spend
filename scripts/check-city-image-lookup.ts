/**
 * Live check of the deterministic city image lookup, using the same Open-Meteo geocoding the app
 * runs when a city is created. Read-only: writes nothing, needs no key and makes no LLM call.
 *
 *   npx tsx scripts/check-city-image-lookup.ts            # built-in list of cities not in the library
 *   npx tsx scripts/check-city-image-lookup.ts "Hue|VN|Vietnam" "Brno|CZ|Czech Republic"
 */
import { geocodingUrl, resolveClimateLocation } from '../src/lib/climate-provider';
import { lookupCityImage } from '../src/lib/city-image-lookup';

// Several share a name with a better-known place elsewhere, which the coordinate check must reject.
const DEFAULT_CITIES = [
  'Valladolid|MX|Mexico', 'Cordoba|AR|Argentina', 'Granada|NI|Nicaragua', 'Perth|AU|Australia',
  'Merida|MX|Mexico', 'Hue|VN|Vietnam', 'Battambang|KH|Cambodia', 'Kandy|LK|Sri Lanka',
  'Pokhara|NP|Nepal', 'Ljubljana|SI|Slovenia', 'Tallinn|EE|Estonia', 'Bergen|NO|Norway',
  'Hobart|AU|Australia', 'Nelson|NZ|New Zealand', 'Arequipa|PE|Peru', 'Sucre|BO|Bolivia',
  'Matsumoto|JP|Japan', 'Gyeongju|KR|South Korea', 'Kotor|ME|Montenegro', 'Plovdiv|BG|Bulgaria',
  'Essaouira|MA|Morocco', 'Tottori|JP|Japan', 'Toowoomba|AU|Australia', 'Brno|CZ|Czech Republic',
];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const cities = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_CITIES;
  let found = 0;
  for (const entry of cities) {
    const [name, countryCode, countryName] = entry.split('|');
    try {
      const geo = await fetch(geocodingUrl(name, countryCode)).then((r) => r.json());
      const location = resolveClimateLocation(geo, name, countryCode);
      const result = await lookupCityImage({ name, countryName, latitude: location.latitude, longitude: location.longitude });
      if (result.status === 'ok') {
        found += 1;
        const { image } = result;
        console.log(`ok    ${name}, ${countryName}: "${image.articleTitle}" ${image.distanceKm} km, ${image.source}, ${image.license}, ${image.commonsFile}`);
      } else {
        console.log(`miss  ${name}, ${countryName}: ${result.status}${result.articleTitle ? ` ("${result.articleTitle}")` : ''}`);
      }
    } catch (error) {
      console.log(`error ${name}, ${countryName}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await pause(1000); // Wikimedia asks unauthenticated clients to stay well under their limits.
  }
  console.log(`\n${found}/${cities.length} cities have a verified, freely licensed image.`);
}

main();

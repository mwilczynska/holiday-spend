# City images

Status: integrated (10 October 2026). Every city has a stored free photo where one can be verified;
the rest show the drawn scene chosen from the city name (`src/components/dashboard/DestinationScene.tsx`).

## Source

Free photos come from Wikipedia, Wikidata and Wikimedia Commons. All three are free to use without
an API key, like Open-Meteo, so this stays within the "no paid data APIs" constraint. Commons only
hosts freely licensed or public-domain files.

The method is plain HTTP calls to public JSON APIs. It needs no browser, no agent, no API key and
no LLM, and it runs on the server whenever a city is added.

| File | Role |
| --- | --- |
| `src/lib/city-image-lookup.ts` | Finds and verifies the article and image; returns credit data or a miss |
| `src/lib/city-image-service.ts` | Coordinates, download, storage, identity checks and page views |
| `src/lib/city-image-view.ts` | Client-safe view type and schema |
| `src/app/city-images/[cityId]/route.ts` | Serves stored files (authenticated, cached by versioned URL) |
| `src/components/dashboard/CityPhoto.tsx` | Photo over the drawn scene, with the credit |
| `scripts/collect-city-images.ts` | Batch collection for the whole library |
| `scripts/check-city-image-lookup.ts` | Read-only live check for cities not in the library |

```
npx tsx scripts/collect-city-images.ts                  # cities without a result, plus failed attempts
npx tsx scripts/collect-city-images.ts --retry-misses   # also look again where no photo was found
npx tsx scripts/collect-city-images.ts --refresh        # look again for every city
npx tsx scripts/collect-city-images.ts --city salento --refresh
npx tsx scripts/check-city-image-lookup.ts "Hue|VN|Vietnam"
```

The batch uses `HOLIDAY_SPEND_DB_PATH` like the app and writes photos to the `city-images` folder
beside the database (`data/city-images/` by default, gitignored). It runs sequentially at about one
city per second and can be stopped and rerun.

## Method

1. **Coordinates.** Use the city's saved climate location. Without one, geocode exactly as climate
   collection does (Open-Meteo, exact name and ISO country code).
2. **Find the article.** Search English Wikipedia for `<place> <country>` (`Bali (Ubud)` searches for
   `ubud`). Skip disambiguation pages and facility articles (airport, stadium, showground, arena,
   station, railway, university, hospital, festival). Request all article coordinates, because many
   city infoboxes mark theirs as non-primary; an exact title match without coordinates uses its
   Wikidata coordinate (P625). Any of an article's points may be the near one: Seoul's first point
   is the centre of South Korea.
3. **Confirm it is the right place.**
   - With coordinates: the article must be within 50 km. This picks Salento, Quindío (Colombia)
     rather than Salento in Italy.
   - Without coordinates (the geocoder cannot place islands, regions and some spellings): the
     article must be a title match or the top search result, and its Wikidata country (P17) must be
     the city's country, found from its ISO code (P297). A territory that is itself the country
     item, such as Hong Kong, also matches.
   - Prefer an exact title match, ignoring spacing and punctuation (`Sa Pa` matches `Sapa`). Among
     equal titles a settlement qualifier comes first, then a bare title, then any other qualifier,
     then the nearest (`Querétaro (city)` over the state article `Querétaro`; `Rio de Janeiro`
     over `Rio de Janeiro (state)`). Then the name followed by a place word (`Ko Lanta district`,
     `Jeju Province`); without any title match, only the first geolocated search result.
   - When the country-qualified search finds no title match, search the place name alone (`york United
     Kingdom` returns only articles about the country). The distance or country check still decides.
   - The search uses the city's geocoding alias where one exists, so the library spelling
     `Banatayan` is searched as `Bantayan`. A place with no article of its own is searched by the
     area that contains it (`CONTAINING_AREA` in `city-image-service.ts`: Tomo by its commune,
     Boulouparis); the distance check still applies.
4. **Choose the image.** Use the article's lead image. If it is missing, local to English Wikipedia
   (possibly non-free), an SVG (maps, flags, seals) or non-free, use the Wikidata item's `image`
   (P18), which must be a Commons file. If neither is usable, try the next matching article, up to
   three (`Zanzibar` has only a flag; `Zanzibar City` has a photo).
5. **Read the licence.** Commons `imageinfo` with `extmetadata`. Reject anything not on Commons or
   with a non-free licence. Keep author, licence, licence URL and description page.
6. **Download.** 1280px and 500px thumbnails, only from `upload.wikimedia.org` or
   `thumb.wikimedia.org`, as JPEG/PNG/WebP/GIF up to 8 MB, written atomically under versioned names.

API etiquette: a descriptive `User-Agent`, about one city per second, batches run sequentially.

## Storage and lifecycle

`city_images` holds one row per city: status (`ok`, `no-location`, `no-article`, `no-free-image`,
`error`), the verified image metadata as JSON, the two file names, fetch and attempt times, and the
last error. The row records the city name and country code it was collected for and a method
version; a rename or country change makes the row stale, so the old photo is never shown for the new
identity.

- **New city.** Manual add (`POST /api/cities`) and every generation path
  (`generateAndPersistCityEstimate`, used by the planner, dataset and CSV import) collect the photo
  after climate, so they reuse its coordinates. Failure is logged and never blocks saving the city.
- **Regeneration.** A current result is kept; the photo is looked up again only when the city's
  name or country changed.
- **Misses** are recorded and not retried on every run, because they are deterministic. Errors
  (network, HTTP) are retried by the batch.
- **Refresh.** A transient failure keeps the previous photo; a deterministic miss under the current
  rules drops it.

## Display

Itinerary legs and the dashboard's per-city rows carry the photo view in their existing
server-rendered data, so a full page load still makes no `/api/` requests. Images are served from
`/city-images/<cityId>?v=<fetchedAt>` outside `/api`, with long private caching.

The dashboard's Current destination and Up next cards and the planner banner show the 1280px photo
with a credit chip. Planner leg cards show the 500px photo, lazily loaded, with the credit as a
tooltip and as a line in the expanded card. While an unsaved draft changes a leg's city, the card
shows that city's drawn scene. A missing row, a missing file or a failed image load shows the drawn
scene; another city's photo is never substituted.

## Licence obligations

CC BY and CC BY-SA require credit: author, licence name, and a link to the source. The credit links
to the Commons description page, which carries the licence text and link. Do not crop away
watermarks or alter the meaning of the image. Resizing and cropping for layout are fine.

## Evidence

| Sample | Result | Notes |
| --- | --- | --- |
| 10 hand-picked hard cases (probe) | 10/10 | Salento resolves to Colombia; Puerto Escondido via the Wikidata fallback |
| 24 cities not in the library, via geocode then lookup | 23/24 | Valladolid, Córdoba, Granada and Perth resolve to Mexico, Argentina, Nicaragua and Australia rather than their namesakes |
| Full library, first rules | 183/211 | Audit found Kraków matched to its airport, Wollongong to its showground and Ubud to Ubud Palace: their city articles' coordinates were non-primary or absent. 22 misses were places the geocoder could not pin down |
| Full library, second rules | 207/211 | 186 confirmed by distance, 21 by Wikidata country; non-exact and country-confirmed matches reviewed by hand. Misses: `Banatayan` (library spelling), Cotopaxi (the only populated "Cotopaxi" is 150 km from the park), Zanzibar (archipelago article has only a flag) and Tomo (no article; not in the geocoder) |
| Full library, current rules | 211/211 | 190 confirmed by distance, 21 by Wikidata country. Misses fixed by a geocoding alias (Banatayan), explicit points (Cotopaxi National Park; Tomo from OpenStreetMap), trying the next matching article (Zanzibar City) and the containing commune (Tomo: Boulouparis, 15 km). Side effects checked by diff: Santa Fe now gets its own town rather than Bantayan, Koh Lanta and Bali (Ubud/Canggu) improved; Rio de Janeiro briefly matched its state article until the qualifier rule above, which also moved Hoi An, Hue and Sa Pa to their city or town articles |
| New cities through the app (QA database) | 2/2 | Hobart (by distance) and Koh Phangan (by country) saved with climate and photo in 5-6 s; the planner card showed the photo and credit; deleting the city removed its files |

The licences seen are CC BY, CC BY-SA, CC0, public domain, the Free Art Licence and Korea's KOGL
Type 1. All allow reuse with credit.

## Climate cross-check

The distance check doubles as a check on the saved climate location: a city whose saved point has no
same-named article within 50 km deserves a look. Cotopaxi would have been collected for an
Esmeraldas village 150 km from the national park, and now has an explicit point. It found that Querétaro's climate had been collected
for a village in Chiapas about 900 km away, because the geocoder's only exact "Querétaro" is that
village and it lists the capital as "Querétaro City". `climate-provider.ts` now gives Querétaro an
explicit point, and a saved record that disagrees with an explicit point is recollected.

## Why no LLM is needed

With coordinates, choosing the article is a distance check; without them, it is a country check
against Wikidata. Both are deterministic and repeatable. A small model could be asked only for an
article title in the remaining cases, and its answer would have to pass the same checks; this is not
built.

# City images

Status: method tested, not yet integrated (10 October 2026). Until it is, every city shows a drawn
scene chosen from its name (`src/components/dashboard/DestinationScene.tsx`).

## Source

Free photos come from Wikipedia and Wikimedia Commons. Both are free to use without an API key,
like Open-Meteo, so this stays within the "no paid data APIs" constraint. Commons only hosts
freely licensed or public-domain files.

The probe `scripts/city-image-probe.mjs` implements the method. It is read-only: it writes no
database rows and downloads no images.

```
node scripts/city-image-probe.mjs --limit 40 --json probe.json
node scripts/city-image-probe.mjs --cities "Salento,Puerto Escondido"
```

## Method

1. **Find the article.** Search English Wikipedia for `<place> <country>`. `Bali (Ubud)` searches
   for `ubud`. Skip disambiguation pages.
2. **Confirm it is the right place.**
   - When the city has stored climate coordinates, accept only an article whose coordinates are
     within 50 km. This picks Salento, Quindío (Colombia) rather than Salento in Italy.
   - Without coordinates, accept only a geolocated article whose title matches the place name, and
     flag the result `title-only`.
   - Prefer an exact title match, then a title that starts with the name, then search order.
3. **Choose the image.** Use the article's lead image (the PageImages API). If it is missing, local
   to English Wikipedia (possibly non-free), an SVG (maps, flags, seals), or non-free, fall back to
   the Wikidata item's `image` (P18), which must be a Commons file.
4. **Read the licence.** Query Commons `imageinfo` with `extmetadata` for `LicenseShortName`,
   `LicenseUrl`, `Artist`, `Credit` and `AttributionRequired`. Reject anything not on Commons or
   with a non-free licence.
5. **Size.** Request a 1280px-wide thumbnail (`iiurlwidth`). Never hotlink the original file.

API etiquette: send a descriptive `User-Agent`, make about one request per second, and run
batches sequentially. A city costs three or four requests.

## Evidence

| Sample | Usable | Notes |
| --- | --- | --- |
| 10 hand-picked hard cases | 10/10 after fixes | Salento resolves to Colombia; Puerto Escondido via the Wikidata fallback |
| First 40 cities alphabetically, 25 without stored coordinates | 38/40 | Misses were `Bali (Ubud/Canggu)`, a combined entry, and `Banatayan`, a misspelt duplicate of `Bantayan` |

The licences seen were CC BY, CC BY-SA, CC0, public domain, and Korea's KOGL Type 1. All allow
reuse with attribution. One known imperfection is that `Bali (Ubud)` resolves to Ubud Palace,
which is inside the town. The manual override below covers cases like that.

## Licence obligations

CC BY and CC BY-SA require credit: author, licence name with a link, and a link to the source
file. Show this in a small caption or tooltip wherever the photo appears. A link to the Commons
description page meets the source requirement. Do not crop away watermarks or alter the meaning
of the image. Resizing and cropping for layout are fine.

## Proposed integration

**Storage.** Add a `city_images` table keyed by `city_id`:

- `source` (`article` or `wikidata`)
- `article_title`
- `commons_file`
- `description_url`
- `license`, `license_url`
- `artist`, `credit`
- `attribution_required`
- `width`, `height`
- `location_check` (`coordinates` or `title-only`)
- `local_path`
- `fetched_at`, `last_attempt_at`, `last_error`
- `override_file` (nullable; set by hand to replace a wrong pick)

Download the 1280px thumbnail once into `data/city-images/<cityId>.jpg`. Like the database, this
is gitignored and local. Pages serve the local copy, so viewing a page never calls Wikimedia.

**When it runs.** Follow the climate pattern: collect once and keep the result.

- **New city** (generation or manual add): fetch after the city is saved. A failure stores
  `last_error` and leaves the drawn scene; it never blocks saving the city.
- **City refresh:** keep an existing image unless `override_file` changed or the owner asks for a
  re-fetch.
- **Batch for existing cities:** a script like the probe, writing rows and files. Run it
  sequentially at one request per second (211 cities is about 12 minutes) and make it resumable,
  skipping rows already fetched.

**Display.** Prefer the photo, with the credit caption. Fall back to the drawn scene when there is
no row, the row has an error, or the local file is missing. Never substitute another city's photo.

**Fail closed.** If the location check, licence check or download fails, store no image. Do not
present a photo of a different place as the city.

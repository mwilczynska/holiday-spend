# City Cost Observation Research Prompt — Version 1

You are collecting evidence for a travel-cost dataset. You must use live public web research. Do not
answer from memory and do not estimate a price that you cannot verify.

## Assigned Call

- City: `{{city}}`
- Country: `{{country}}`
- Region: `{{region}}`
- Category: `{{category}}`
- Batch id: `{{batch_id}}`
- Retrieval/reference date: `{{reference_date}}`
- Pricing window or accommodation dates: `{{pricing_window}}`
- Additional context: `{{context}}`

One call covers one city and one category. Keep the search bounded to the requested category.

## Evidence Rules

1. Browse current publicly accessible pages. Do not use remembered prices.
2. Prefer a public Numbeo city page for standardized food/drink items in this private project,
   direct/official venue pages for attractions, and the selected property's own public booking page for
   accommodation. For accommodation, public search-result listings on Booking.com and Trip.com are the
   primary channel as of 27 July 2026: read them signed out, filtered to hotels and to the star class, with
   taxes and fees included. A property's own public booking page, or a property drawn from an assigned
   versioned panel, remains acceptable. Never sign in, never use member or account-conditional rates, and
   never work around a block or CAPTCHA — a blocked page is a missing observation. Use normal
   page-by-page research with attribution; do not build or invoke a scraper/crawler or the paid Numbeo API.
3. Every numeric observation requires the exact source URL and retrieval timestamp.
4. Preserve the displayed currency, unit, tax/fee treatment, range, count, and price-valid dates where
   available. Do not convert to USD or AUD.
5. A search snippet alone may be reported as an unreviewed lead, but clearly say that the underlying page
   was not inspected. Do not mark it accepted.
6. Do not bypass a login, paywall, CAPTCHA, robots restriction, or blocked page.
7. If the item definition, occupancy, date, or unit is ambiguous, return it as missing or add an unreviewed
   observation with the ambiguity in `notes`.
8. Do not derive lifestyle tiers, apply fallback ratios, assign confidence labels, or run currency
   conversion.
9. Return explicit missing entries. Missing evidence is preferable to a plausible invention.

## Requested Measures

### `food_drinks`

- `inexpensive_restaurant_meal_1p`
- `midrange_restaurant_meal_2p`
- `cappuccino_1`
- `domestic_draft_beer_1`
- `cocktail_1` only if directly observable
- `wine_glass_1` only if directly observable

### `accommodation`

- `hostel_dorm_bed_1p`
- `hostel_private_room_2p`
- `hotel_1star_room_2p`
- `hotel_2star_room_2p`
- `hotel_3star_room_2p`
- `hotel_4star_room_2p`

Accommodation observations require check-in, check-out, stay length, two-adult/one-room occupancy for
private rooms, booker country, displayed mandatory-charge treatment, assigned sampling-frame id, and
official-register property id. Return one observation per property quote, not a pre-aggregated city
minimum or median. A dorm observation is per bed. Exclude login, member, and mobile-only prices. Record
whether the lowest eligible public rate is flexible or non-refundable, and reject the quote if the final
payable total including mandatory taxes and fees cannot be verified. The local calculator requires at
least five eligible property quotes in each of low, shoulder, and high season before a direct
accommodation measure can be materialized.

Preserve the displayed payable total in `priceAmount` and use `quantity` as the denominator needed to
produce the declared nightly unit. For a seven-night private-room/hotel total, `quantity` is 7. For a
seven-night dorm total covering two travellers/two beds, `quantity` is 14 bed-nights. If the page displays
a nightly rate but the seven-night payable total is also verified, the nightly amount may use
`quantity = 1`; explain the displayed-total check in `notes`.

### `activities`

- `paid_attraction_adult_1`
- `half_day_group_activity_adult_1`
- `full_day_premium_activity_adult_1`

Collect multiple products per measure where possible. Prefer official attraction/operator prices for the
validation sample. Record whether pricing is per person or per group.

## Output

Return JSON only:

```json
{
  "call": {
    "city": "City",
    "country": "Country",
    "region": "Europe",
    "category": "food_drinks",
    "batchId": "batch-zero-day-01",
    "status": "complete|partial|no_public_evidence"
  },
  "observations": [
    {
      "schemaVersion": "city-cost-observation-v1",
      "observationId": "stable-lowercase-id",
      "batchId": "batch-zero-day-01",
      "city": "City",
      "country": "Country",
      "region": "Europe",
      "category": "food|drinks|accommodation|activities",
      "measure": "one requested measure id",
      "valueStatus": "direct",
      "priceAmount": 0,
      "currency": "EUR",
      "unit": "per_person_item|per_two_person_meal|per_bed_night|per_room_night|per_person_ticket",
      "travellers": 1,
      "quantity": 1,
      "taxStatus": "included|excluded|mixed|unknown",
      "sourceName": "Source name",
      "sourceType": "official_website|crowdsourced_api|published_dataset|manual_menu_sample",
      "sourceAccess": "personal_use_with_attribution|open_license|public_official|public_property|user_supplied|unknown",
      "sourceTermsUrl": null,
      "sourceUrl": "https://source.example/page",
      "sourceRecordId": null,
      "retrievedAt": "ISO-8601 timestamp",
      "priceValidFrom": null,
      "priceValidTo": null,
      "reportedLow": null,
      "reportedHigh": null,
      "sampleSize": null,
      "resultCount": null,
      "checkIn": null,
      "checkOut": null,
      "quoteCaptureDate": null,
      "bookingLeadDays": null,
      "stayNights": null,
      "season": "low|shoulder|high|not_applicable|unknown",
      "searchRadiusKm": null,
      "minimumReviewScore": null,
      "bookerCountry": null,
      "samplingFrameId": null,
      "rateAccess": "public|member|mobile|login|unknown|not_applicable",
      "rateCondition": "flexible|non_refundable|mixed|unknown|not_applicable",
      "extractionMethod": "browser_research",
      "extractorVersion": "llm-observation-prompt-1",
      "parentObservationIds": [],
      "derivationMethod": null,
      "modelVersion": null,
      "predictionLower": null,
      "predictionUpper": null,
      "reviewerStatus": "unreviewed",
      "exclusionReason": null,
      "notes": "Definition caveats or source context"
    }
  ],
  "missing": [
    {
      "measure": "requested measure id",
      "reason": "Why no defensible observation was returned",
      "attemptedUrls": ["https://example.com/attempt"]
    }
  ]
}
```

Do not add commentary outside the JSON.

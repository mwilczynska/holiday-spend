# City-cost v5 experiment 021 — one-city accommodation class search

You are extracting accommodation source facts for **one city only**. Do not inspect, mention, infer from,
or substitute another city. Use provider web search only; do not open direct booking or hostel pages in this
experiment. Issue exactly six targeted searches, one per measure. Do not retry a query.

This is a city-average source feasibility test, not a dated quote. A found hotel value must be an explicit
per-room/per-night city or class average that names the exact city and formal star class. A found hostel value
must be an explicitly labelled per-bed dorm price or private-hostel-room price for the exact city. Reject
`from` prices, ranges, promotions, packages, multi-night totals, member/login rates, review-score classes,
unlabelled property prices, arithmetic, and values from another city. Do not estimate or emit ratios. A
blocked or unavailable result is `blocked`/`not_found`, not a plausible substitute.

Search targets:
- `hostel_dorm_bed_1p`: exact city, Hostelworld or named hostel, explicit dorm-bed per-night price
- `hostel_private_room_2p`: exact city, Hostelworld or named hostel, explicit private-room per-night price
- `hotel_1star_room_2p`: exact city, explicit one-star city/class average per-room night
- `hotel_2star_room_2p`: exact city, explicit two-star city/class average per-room night
- `hotel_3star_room_2p`: exact city, explicit three-star city/class average per-room night
- `hotel_4star_room_2p`: exact city, explicit four-star city/class average per-room night

Prefer public Booking.com or Hotels.com class-page search results for hotels and public Hostelworld or named
hostel sources for hostels. Search result evidence must contain exact city, formal class or occupancy label,
central numeric price, currency, per-night basis, and source URL. Do not open the URL. If a result shows only
named-property prices without a city/class average, do not calculate a median in the model.

Return exactly this JSON shape and no surrounding prose:

```json
{
  "city":"{{city}}",
  "country":"{{country}}",
  "referenceDate":"YYYY-MM-DD",
  "searchOnly":{"queriesAttempted":6,"directPageReads":0},
  "measures": {
    "hostel_dorm_bed_1p":{"status":"found|not_found|blocked","value":0.0,"currency":"EUR","unit":"per_person_bed_night","basis":"city_average|property_quote","sourceUrl":null,"searchQuery":"","resultEvidence":""},
    "hostel_private_room_2p":{"status":"found|not_found|blocked","value":0.0,"currency":"EUR","unit":"per_room_night","basis":"city_average|property_quote","sourceUrl":null,"searchQuery":"","resultEvidence":""},
    "hotel_1star_room_2p":{"status":"found|not_found|blocked","value":0.0,"currency":"EUR","unit":"per_room_night","basis":"city_average","sourceUrl":null,"searchQuery":"","resultEvidence":""},
    "hotel_2star_room_2p":{"status":"found|not_found|blocked","value":0.0,"currency":"EUR","unit":"per_room_night","basis":"city_average","sourceUrl":null,"searchQuery":"","resultEvidence":""},
    "hotel_3star_room_2p":{"status":"found|not_found|blocked","value":0.0,"currency":"EUR","unit":"per_room_night","basis":"city_average","sourceUrl":null,"searchQuery":"","resultEvidence":""},
    "hotel_4star_room_2p":{"status":"found|not_found|blocked","value":0.0,"currency":"EUR","unit":"per_room_night","basis":"city_average","sourceUrl":null,"searchQuery":"","resultEvidence":""}
  },
  "outcome":"accepted|partial|no_result|blocked",
  "notes":""
}
```

For non-found or blocked measures set value, currency, unit, basis, sourceUrl, and resultEvidence to null;
retain the attempted query in `searchQuery` where available. For found measures, never leave source evidence
blank and never claim a direct page was read.

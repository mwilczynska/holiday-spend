# v5 Experiment 048 — broad private-hostel property panel

You are a strict ground-truth extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly two ordered searches:

1. `site:hostelworld.com {{CITY}} {{COUNTRY}} private room 2 guests price per night`
2. `site:booking.com {{CITY}} {{COUNTRY}} hostel private room 2 adults price per night`

Do not open pages, retry, use another city, calculate, convert currency, average sources, or infer occupancy from
a generic “private room” label. Preserve exact named property, URL/title, dates/reference period, currency, and
evidence snippet.

Accept one quote only when the same evidence identifies an exact-city named hostel, a private room, explicit two
adults/two guests and one room, a numeric non-from one-night price, and tax/fee treatment. Reject ranges,
from/lowest prices, generic city averages, ambiguous occupancy, private bathrooms without private-room class,
login-only results, and nearby cities. A quote is property-level ground truth only; do not compute a city median or
map it to `accom_hostel_private_room`.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-private-hostel-broad-panel-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measure": {"status":"found|not_found","propertyName":null,"value":null,"currency":null,"unit":"per_room_per_night","occupancyBasis":"explicit_two_adults","class":"hostel_private_room","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
  "telemetry": {"searchesAttempted":2,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0}
}
```

Do not add commentary outside JSON. Unknown tax status is retained as evidence but is not a compatible observed
row for the strict panel.

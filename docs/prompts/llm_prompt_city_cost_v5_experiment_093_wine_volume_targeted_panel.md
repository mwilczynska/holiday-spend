# v5 Experiment 093 — volume-targeted wine-glass panel

You are a strict structured ground-truth collector. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly three ordered searches:

1. `{{CITY}} {{COUNTRY}} wine menu red wine glass 125 ml 150 ml current public`
2. `{{CITY}} {{COUNTRY}} wine list red wine glass 175 ml 15 cl current public`
3. `{{CITY}} {{COUNTRY}} restaurant wine list standard pour 15cl red wine price`

You may open only public pages returned by these searches. Do not log in, book, retry, use another city, issue a
fallback search, calculate, convert currency, average, or use cross-city evidence. Accept a row only when one exact-
city public menu supplies at least three standard dry-red wines, each explicitly priced for a 125–175 ml or 15 cl
glass. Preserve raw prices and volume; local code computes the median. Reject bottles, carafes, tasting pours,
10–12 cl pours, unspecified glass volume, from/starting prices, stale pages, and unknown city identity.

Return JSON only:

```json
{
  "schemaVersion":"city-cost-v5-wine-volume-targeted-v1",
  "city":"{{CITY}}",
  "country":"{{COUNTRY}}",
  "retrievalDate":"YYYY-MM-DD",
  "wineGlass": {"status":"found|not_found","currency":null,"unit":"per_person_item","glassVolumeMl":null,"priceSamples":[],"priceStatistic":"median_of_standard_red_glasses","venueName":null,"sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
  "telemetry":{"searchesAttempted":3,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0,"protocolCompliant":true}
}
```

`priceSamples` must contain at least three raw positive values in the named currency. Do not return a median or add
commentary outside JSON.

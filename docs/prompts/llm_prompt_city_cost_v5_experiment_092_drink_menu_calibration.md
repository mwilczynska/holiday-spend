# v5 Experiment 092 — independent drink-menu calibration

You are a strict structured ground-truth collector. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly three ordered searches:

1. `{{CITY}} {{COUNTRY}} public cocktail bar menu classic cocktails prices current`
2. `{{CITY}} {{COUNTRY}} public wine menu wine by the glass red price current`
3. `{{CITY}} {{COUNTRY}} public menu VAT tax included cocktail wine glass`

You may open only public pages returned by those searches; do not log in, book, retry, issue another search, use a
fallback source, use another city, calculate, convert currency, or average. Preserve raw prices; local code computes
the median. For cocktails, retain at least three standard/classic cocktails from one public menu (exclude shots,
zero-proof, bottle service, tasting flights, and reserve/premium sections). For wine, retain at least three standard
dry-red wines sold by a stated glass volume of 125–175 ml (or explicitly standard glass); exclude tasting pours,
carafes, and bottle-only entries. Tax status may be unknown but must be recorded.

Return JSON only:

```json
{
  "schemaVersion":"city-cost-v5-drink-menu-calibration-v1",
  "city":"{{CITY}}",
  "country":"{{COUNTRY}}",
  "retrievalDate":"YYYY-MM-DD",
  "cocktail": {"status":"found|not_found","currency":null,"unit":"per_person_item","priceSamples":[],"priceStatistic":"median_of_standard_classics","venueName":null,"sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
  "wineGlass": {"status":"found|not_found","currency":null,"unit":"per_person_item","glassVolumeMl":null,"priceSamples":[],"priceStatistic":"median_of_standard_red_glasses","venueName":null,"sourceUrl":null,"sourceTitle":null,"evidenceText":null,"taxStatus":"included|excluded|unknown","referencePeriod":null,"searchQuery":null,"reason":""},
  "telemetry":{"searchesAttempted":3,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0,"protocolCompliant":true}
}
```

`priceSamples` must contain raw positive numeric values in the named source currency. Do not compute or return a
median. Do not call a wine bottle a glass. Do not add commentary outside JSON.

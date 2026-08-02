# v5 Experiment 091 — Expatistan drink-anchor panel

You are a strict structured source extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Issue exactly two ordered searches:

1. `site:expatistan.com/cost-of-living/ {{CITY}} {{COUNTRY}} "1 cocktail drink in downtown club"`
2. `site:expatistan.com/cost-of-living/ {{CITY}} {{COUNTRY}} "1 bottle of red table wine, good quality"`

Search only. Do not open pages, retry, use a fallback source, calculate, convert currency, divide a bottle into
glasses, average, or use another city. Accept a row only when the evidence is from the exact city's public
Expatistan page, includes the canonical label and a numeric central value, names the currency, and gives a current
page/update/reference context. Reject comparison pages, wrong cities, ranges without a central value, stale or
malformed currency, and substitutions. The wine row is a bottle input and must never be labelled a glass.

Return JSON only:

```json
{
  "schemaVersion":"city-cost-v5-expatistan-drink-anchors-v1",
  "city":"{{CITY}}",
  "country":"{{COUNTRY}}",
  "retrievalDate":"YYYY-MM-DD",
  "measures": {
    "cocktail": {"status":"found|not_found","value":null,"currency":null,"unit":"per_person_item","basis":"standard_cocktail_downtown_club|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""},
    "wineBottle": {"status":"found|not_found","value":null,"currency":null,"unit":"per_bottle","basis":"red_table_wine_good_quality|unknown","taxStatus":"included|excluded|unknown","sourceUrl":null,"sourceTitle":null,"evidenceText":null,"referencePeriod":null,"searchQuery":null,"reason":""}
  },
  "telemetry":{"searchesAttempted":2,"searchOperations":0,"directReads":0,"retries":0,"fallbackSources":0,"arithmeticOperations":0,"currencyConversions":0,"crossCityEvidence":0,"protocolCompliant":true}
}
```

Do not add commentary outside JSON.

# v5 Experiment 028 — single-city Expedia class-trend source prompt

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly four Expedia-restricted searches, one for each hotel class. Do not open pages,
retry, use another city, calculate, convert currency, or use a different source family.

Measures:

- `expedia_1_star`, `expedia_2_star`, `expedia_3_star`, `expedia_4_star`.

Accept only an Expedia result that explicitly identifies the exact city and requested star class, states a
numeric **average or price trend** for a nightly room for two adults, and gives a named currency, source URL,
and reference date/window. Reject `from`, lowest, starting, single-property, weekend-only/event-specific,
ranges, per-person, generic city, country, or class-ambiguous prices. A result saying that Expedia's trend is
based on two adults is not enough if the numeric value shown is only a different `from` or lowest quote.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-expedia-class-trend-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "expedia_1_star": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_room_per_night",
      "occupancy": "two_adults",
      "class": "1_star",
      "referencePeriod": "...",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "searchQuery": "exact query issued",
      "reason": "..."
    }
  },
  "telemetry": {
    "searchesAttempted": 4,
    "searchOperations": 0,
    "directReads": 0,
    "retries": 0,
    "fallbackSources": 0,
    "arithmeticOperations": 0,
    "currencyConversions": 0,
    "crossCityEvidence": 0
  }
}
```

Do not add commentary outside JSON. A found Expedia trend row is a source-feasibility observation; it is not
validated ground truth until matched against an independent definition-compatible panel.

# v5 Experiment 027 — single-city HOTEVI hotel-tier source prompt

You are a strict source-feasibility extractor. Research **one city only**: `{{CITY}}, {{COUNTRY}}`.
Use search only and issue exactly three targeted searches, one for each HOTEVI hotel-price tier below. Do not
open pages, retry, calculate, convert currency, or use facts from another city.

Measures:

- `hotevi_budget_1_2_star`: HOTEVI Budget (1–2 star) average nightly rate;
- `hotevi_mid_3_star`: HOTEVI Mid-Range (3 star) average nightly rate;
- `hotevi_luxury_4_5_star`: HOTEVI Luxury (4–5 star) average nightly rate.

Accept only a search result that explicitly identifies HOTEVI, the exact requested city and country, the
requested tier, a numeric nightly price, and a reference month/date. Record displayed currency and occupancy
basis exactly. HOTEVI's grouped tiers and any absent two-adult statement are limitations, not permission to
pretend the value is an `accom_1_star`–`accom_4_star` two-adult observation. Reject global/regional values,
the wrong city, top-100 sample rows without exact city identity, ranges, from/lowest prices, and pages that do
not expose a numeric tier value. Do not infer separate 1-star, 2-star, 4-star, or 5-star values.

Return JSON only:

```json
{
  "schemaVersion": "city-cost-v5-hotevi-tier-feasibility-v1",
  "city": "{{CITY}}",
  "country": "{{COUNTRY}}",
  "retrievalDate": "YYYY-MM-DD",
  "measures": {
    "hotevi_budget_1_2_star": {
      "status": "found|not_found",
      "value": 0,
      "currency": "ISO-4217",
      "unit": "per_room_per_night",
      "tier": "budget_1_2_star",
      "occupancyBasis": "explicit|source_default|unknown",
      "referencePeriod": "...",
      "sourceUrl": "https://...",
      "sourceTitle": "...",
      "evidenceText": "short quote or exact snippet",
      "searchQuery": "exact query issued",
      "reason": "..."
    }
  },
  "telemetry": {
    "searchesAttempted": 3,
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

Do not add commentary outside JSON. This experiment tests source feasibility only; a found grouped tier is
not a product accommodation class and cannot be presented as observed `accom_1_star`–`accom_4_star`.

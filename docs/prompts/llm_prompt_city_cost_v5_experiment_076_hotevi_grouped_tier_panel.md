# v5 Experiment 076 prompt — HOTEVI grouped-tier proxy panel

You are a bounded web-research extractor. You are given exactly one city. Do not use evidence from any other city.
Return one JSON object matching the schema below and no prose outside JSON.

Use exactly two ordered web operations:

1. Search for the public HOTEVI research dataset for the supplied city.
2. Read the exact HOTEVI research page returned, preferably `https://hotevi.com/research`.

Extract only the supplied city's row from HOTEVI's public sample table. The page publishes three grouped rates:
budget (1–2 star), mid-range (3 star), and luxury (4–5 star). Report all three source facts if strict fields are
present. Do not use another city, a destination booking page, a product page, or any fallback source.

Strict fields for each group:

- numeric positive USD value;
- the page's monthly-average statistic and standard-room unit;
- group identity exactly as published (`budget_1_2_star`, `mid_3_star`, or `luxury_4_5_star`);
- source URL/title, evidence text, and reference period.

Set `taxStatus` to `unknown` unless the page explicitly states tax/fee treatment. Do not infer occupancy: use
`occupancyBasis: source_defined_standard_room`, which is a proxy basis, not explicit two-adult evidence. Do not split
the 1–2 or 4–5 groups into individual star values. Reject missing, stale, malformed, or other-city rows.

Use exactly two web operations total. Do not retry, read another page, calculate, convert currency, average, or derive
any product value. If blocked or a strict field is absent, mark that group `not_found` and explain the exact reason.

Schema:

```json
{
  "schemaVersion":"city-cost-v5-hotevi-grouped-tier-panel-v1",
  "city":"...",
  "country":"...",
  "retrievalDate":"YYYY-MM-DD",
  "measures": {
    "budget_1_2_star": {
      "status":"found|not_found",
      "value":null,
      "currency":null,
      "unit":"per_room_per_night|null",
      "occupancyBasis":"source_defined_standard_room|null",
      "class":"budget_1_2_star|null",
      "statistic":"monthly_average_price|null",
      "taxStatus":"included|excluded|unknown|null",
      "sourceUrl":null,
      "sourceTitle":null,
      "evidenceText":null,
      "referencePeriod":null,
      "searchQuery":null,
      "reason":null
    },
    "mid_3_star": {},
    "luxury_4_5_star": {}
  },
  "telemetry": {
    "searchesAttempted":2,
    "searchOperations":1,
    "directReads":1,
    "retries":0,
    "fallbackSources":0,
    "arithmeticOperations":0,
    "currencyConversions":0,
    "crossCityEvidence":0,
    "protocolCompliant":true
  }
}
```

The two abbreviated measure objects must contain the same fields and enum values as the budget object. Telemetry must
describe what actually happened; never claim an operation did not occur.

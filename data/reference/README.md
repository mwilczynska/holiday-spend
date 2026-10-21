# Reference Data

Committed datasets and what reads them. Do not move or rename a file here without updating its readers.

| Path | What it is | Read by |
| --- | --- | --- |
| `city_costs_app_aud.csv` | The seed city-cost library: 121 cities, 58 countries, AUD for two people, tagged `base_csv_apr_2026`. Produced by the v1 method | `src/db/seed.ts` (empty library only), `scripts/check-city-cost-v1-1.ts` |
| `transport_accuracy_references_2026-09-05.json` | Same-day reference fares for the transport accuracy check | `docs/product/transport-estimation.md` |
| `transport_accuracy_run_2026-09-05.json` | Transport prompt v1 run against those references | `docs/product/transport-estimation.md` |
| `transport_accuracy_run_v1_1_2026-09-05.json` | Transport prompt v1.1 run against the same references | `docs/product/transport-estimation.md` |
| `transport_token_usage_2026-09-05.json` | Token usage recorded for those runs | provenance |

The local SQLite library (`data/travel.db`, gitignored) holds every city added since the seed. Rebuild an empty
library with `npm run db:seed`.

## Removed research data

Earlier city-cost research is no longer on `main`:

| Programme | Where it is |
| --- | --- |
| v1 audit, v3 observed-first collection, v4 ratio model (observations, accommodation panels, dry-run fits, pilot and materialized outputs, frozen FX) | tag `city-cost-v3-v4-research-final-2026-10-21`, together with the scripts and tests that read it |
| v5 and v6/v6.1 | branch `feat/city-cost-methodology-v6`, tag `city-cost-v6.1-research-final-2026-08-18` |
| v1.2 accuracy research | branch `research/city-cost-accuracy`, tag `city-cost-research-r3-2026-10-17` |

The written history of each programme is in `docs/dev/LOG.md` and the `archive/` folders under `docs/`.

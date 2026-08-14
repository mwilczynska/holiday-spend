# v6.1 provider/search coverage audit — Tottori

**Date:** 14 August 2026  
**Purpose:** diagnose explicit `not_found` results from the keyed v6.1 webapp path.  
**Scope:** one owner-authorized Tottori run; no holdout, live CSV, coefficient or migration artifact was changed.

This is an operational boundary audit, not ground-truth evidence and not a change to the three-call contract.

## Reproduction

The run used the normal `/api/cities/create-with-generation` planner path through the browser UI. The browser-supplied
OpenAI key was used by the app but was not read or recorded by the audit.

| Field | Value |
|---|---|
| City / country | Tottori / Japan |
| Provider / model | OpenAI / `gpt-5.6-luna` |
| Reasoning effort | `max` |
| Reference date | `2026-08-14` (UI left blank; collector fallback) |
| Expedia window | `2026-08-14` to `2026-08-15` |
| Source calls | exactly 3, sequentially: Expedia, BudgetYourTrip, Numbeo |
| Direct page reads | 0 |
| Retries | 0 |
| Result | persisted as `llm_city_generation_v6_1`, methodology `v6.1`, city-estimate row 51 |

The exact prompt templates are versioned at:

- [Expedia 3-star prompt](../../../docs/prompts/llm_prompt_city_cost_v6_1_expedia_3star.md)
- [BudgetYourTrip daily-tier prompt](../../../docs/prompts/llm_prompt_city_cost_v6_1_budgetyourtrip_daily_tiers.md)
- [Numbeo drinks prompt](../../../docs/prompts/llm_prompt_city_cost_v6_1_numbeo_drinks.md)

The rendered variables were `city=Tottori`, `country=Japan`, `referenceDate=2026-08-14`,
`arrivalDate=2026-08-14`, and `departureDate=2026-08-15`. The system instruction was:
`You are a careful source extractor. Return valid JSON only; never estimate or calculate.`

## Raw provider results

The OpenAI Responses envelopes were captured locally, outside the repository, by the opt-in audit flag
`CITY_COST_V61_AUDIT_DIR`. No API key is present in those records.

| Source | Provider-observed query count | Queries | Model result | Persisted status |
|---|---:|---|---|---|
| Expedia | 4 | `site:expedia.com Tottori Japan hotels "Aug 14" "Aug 15" 2026 "3 stars" price "2 adults"`; `site:expedia.com Tottori hotels "3-star" "Aug 14 - Aug 15" Expedia`; `Expedia Tottori Japan hotel 3 star August 14 2026 August 15 2026 2 adults 1 room price`; `site:expedia.com/Hotel-Search Tottori "3 stars" "Aug 14, 2026"` | `not_found`: no snippet satisfied exact city + 3-star + numeric room price + currency + stated window | `not_found` |
| BudgetYourTrip | 4 | `site:budgetyourtrip.com Tottori Japan Food & Meals budget mid-range luxury per person per day Budget Your Trip`; `site:budgetyourtrip.com Tottori Japan Entertainment Activities budget mid-range luxury per person per day Budget Your Trip`; `site:budgetyourtrip.com/japan/tottori Tottori Travel Cost Food Entertainment`; `site:budgetyourtrip.com/japan/tottori "Tottori" "Food" "Entertainment"` | `not_found`: no exact-city daily Food/Entertainment tier snippet with all required fields | `not_found` |
| Numbeo | 2 | `site:numbeo.com/cost-of-living/in/Tottori "Cappuccino (Regular Size)"`; `site:numbeo.com/cost-of-living/in/Tottori "Domestic Draft Beer (0.5 Liter)" OR site:numbeo.com/cost-of-living/in/Tottori "Domestic Draft Beer (1 Pint)"` | `not_found` for both measures; no accepted canonical city-row snippet | `not_found` |

Every returned JSON object used `value=null`, `currency=null`, `sourceUrl=null`, empty documentary fields,
`directPageReads=0`, and the explicit non-observed status. The materializer therefore applied its documented
regional/global fallback and produced 18 grade-D modelled tiers plus definitional `activities_free`.

The first version of the transport parser undercounted these calls as 1 / 2 / 1 because current OpenAI Responses
places the query list under `web_search_call.action.queries`, not the legacy top-level `queries` field. The raw
envelopes prove the actual 4 / 4 / 2 query counts; the parser and regression test now handle both shapes.

## Independent source checks

### Expedia: destination exists; the exact search-snippet contract did not

Independent search results show an Expedia Tottori hotel surface with 196 properties and identify multiple Tottori
3-star properties. The result also exposes generic prices, but not the complete requested tuple of exact dates,
occupancy, class and numeric room price in one qualifying snippet. The production prompt deliberately rejects generic
“from”/starting prices and class-ambiguous snippets. Therefore this is **search-snippet contract insufficiency**, not
proof that Tottori has no hotels.

### BudgetYourTrip: the supplied page exists, but it is the wrong estimand

The supplied [Tottori hotel page](https://www.budgetyourtrip.com/hotels/japan/tottori-1849892) is real. It reports
hotel analytics, including 13 hotels and an average 3-star hotel price of US$77. That is useful evidence that
BudgetYourTrip recognizes Tottori, but it is an accommodation/Kayak-derived page—not the required daily Food & Meals
and Entertainment/Activities traveller-spend tiers. The [Japan country page](https://www.budgetyourtrip.com/japan)
does publish daily food and entertainment bands, but substituting those national values for Tottori would violate the
exact-city contract and silently create false observations. Thus this is **destination coverage with no matching daily
tier surface**, not evidence that the hotel URL should have been accepted.

### Numbeo: national data exists; accepted city-level item data was not found

Numbeo search results expose Japan-level cappuccino and domestic-draft-beer values, but the v6.1 prompt explicitly
rejects country aggregates and non-canonical pages. The Tottori-specific result found by independent search was a
property-investment page, not the canonical cost-of-living city item table. This is **missing accepted city-level
coverage**, not a reason to substitute Japan-level prices.

## What the smoke history now means

- Cali, La Ceiba and Tomo were **blocked before search** by the old OpenAI JSON-mode/web-search incompatibility;
  they are not source-coverage failures.
- Matsuyama, Takamatsu and Tottori are clean post-fix examples of the provider completing its searches and returning
  explicit `not_found` results. Their all-prior outputs are diagnostic, not passing coverage evidence.
- Toyama's Expedia and BudgetYourTrip calls were `not_found`, but its Numbeo response was a **schema error** (the
  model returned values while marking measures non-observed), so it must not be counted as clean Numbeo absence.
- Medellin demonstrates that the path is not universally blind: BudgetYourTrip returned a complete city result while
  Expedia was not found and Numbeo failed schema validation.

The current evidence therefore identifies three different causes that must not be collapsed into one metric:

1. provider/transport failure before search (`blocked`/`error`);
2. exact source/estimand coverage missing (Tottori daily BYT tiers and Numbeo city items);
3. source exists but search snippets do not expose all fields demanded by the contract (Tottori Expedia).

The correct next diagnostic is to aggregate these statuses and provider-observed query lists over the existing keyed
smokes and migration evidence, then decide whether to loosen only the Expedia evidence contract or accept the explicit
fallback behavior. Do not substitute the Tottori hotel page or Japan-level values, and do not claim `not_found` means
the destination itself is absent.

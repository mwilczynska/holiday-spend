# City Cost Methodology v4 — Search-Anchored, Deterministically Derived

**Status:** draft 3. Incorporates Phase 0 dry-run results. No paid data APIs.

## Context

Phase 6 tried to directly observe 17 measures across 36 cities with pre-registered gates, seasonal accommodation panels and a model bake-off. It reached **156 of 684 pilot cells (22.8%), zero complete cities, zero eligible accommodation measures**, and needed ~17,300 further searches for the full 121-city set.

The audit that justified it is **nine data points across three cities**, six benchmarked against Numbeo, and its headline −16.30% bias is largely one city (Lisbon's stored cappuccino was EUR 1.50 against Numbeo's EUR 2.57). The real v1 defects were narrower:

1. **Anchors came from LLM memory.** `src/lib/city-llm-client.ts:77-95` posts a plain chat completion with **no `tools` array**. The prompt tells the model to "research" Numbeo prices it cannot fetch.
2. **Multipliers were asserted globally**, forcing region-dependent relationships into one constant.
3. **`activities = (inexp_meal + 10.0) / 2`** has an additive constant that does not scale.
4. **The LLM also did the arithmetic and the FX**, compounding three error sources.

**Design targets:** reasonably accurate, cheap to refresh, user-added cities on demand, no paid APIs, published error by category and region.

## Phase 0 results (complete)

Run without any API key. Artifacts: `data/reference/dry-run/phase-0a-numbeo-anchors.json`, `phase-0b-accommodation-search.json`.

| Question | Answer |
| --- | --- |
| Does the SEA long tail have obtainable prices? | **Yes.** Don Det returned named-property prices via search where Numbeo, a GDS and every API would return nothing |
| Are hostel/dorm prices obtainable? | **Yes**, for 4 of 5 cities. This was the gap that made Amadeus unusable |
| Is coverage the binding constraint? | **No — consistency is.** Hanoi 4★ reported as both $100 and $25; Lisbon 3★ "average €158" exceeds another source's stated €80–150 range |
| Does the free quality signal work? | **Yes.** Chiang Rai fired three flags at once: 19 contributors over 18 months, 4-month-stale update, explicit estimated-data warning |
| Price sanity, Copenhagen 4★ | **Failed as specified** (+47.5%), but the gate compared a shoulder-season median of five specific central properties against an undated blended city-wide average. Basis mismatch, not source error |

Two empirical findings that change the design:

- **The `mcmeal / inexp_meal` ratio is 0.60–0.67 in Europe and 2.18–2.57 in SEA** — a 3.6× between-band gap with tight within-band clustering (n=5).
- **The star ladder does not map to the long tail.** Don Det is guesthouses and bungalows with no star classification. Parts of SEA need a budget/midrange/luxury mapping instead of 1–4★.

## Phase 0d results — expanded sample, fitted equations (supersedes 0c)

`scripts/fit-city-cost-ratios.mjs` → `data/reference/dry-run/phase-0c-ratio-model-fit.json`. Sample expanded by fetching Numbeo anchors for 22 further cities (`phase-0d-numbeo-expanded-sample.json`), pooled with the observation store to **58 cities**. The expanded set adds `mcmeal_combo`, which the store does not carry.

Cost bands cut at AUD 58.59 / 114.70 on the existing dataset's `food_mid_range`. Every relationship is a within-city ratio, so local currency cancels.

### Model equations

```
R0   T = k · A                        1 parameter
R1   T = k_band · A                   3 parameters, band ∈ {low, mid, high}
R2   ln T = a + b · ln A              2 parameters (power law)
```

Fitted on the full pool:

| Relation | n | R0 | R1 (low / mid / high) | R2 |
| --- | --- | --- | --- | --- |
| `midrange ~ inexpensive` | 56 | `T = 5.6916·A` | `6.6864 / 5.4318 / 5.0089` | `ln T = 1.5244 + 1.0396·ln A` |
| `mcmeal ~ inexpensive` | 27 | `T = 1.0014·A` | `1.6515 / 0.8566 / 0.6519` | `ln T = −0.4953 + 1.0965·ln A` |
| `cappuccino ~ beer` | 56 | `T = 0.8974·A` | `1.0286 / 1.1441 / 0.6256` | `ln T = −0.3289 + 1.0482·ln A` |
| `attraction ~ inexpensive` | 29 | `T = 1.0571·A` | `0.7433 / 1.2427 / 1.1728` | `ln T = 0.5111 + 0.9183·ln A` |

### Performance — median APE %, leave-one-out / 25% holdout

| Relation | Spread | R0 | R1 | R2 | Selected |
| --- | --- | --- | --- | --- | --- |
| `midrange ~ inexpensive` | 4.31× | 18.7 / **18.0** | **15.2** / 20.6 | 18.5 / 19.3 | **R0** — tie on merit, simplest wins |
| `mcmeal ~ inexpensive` | 6.67× | 48.6 / 63.3 | **18.1 / 31.1** | 29.1 / 54.8 | **R1** — decisive on both |
| `cappuccino ~ beer` | 8.30× | 25.0 / 20.5 | **18.6** / 14.8 | 21.7 / **13.9** | **R1** |
| `attraction ~ inexpensive` | **241×** | 47.2 / 54.7 | 61.9 / 61.0 | 55.4 / 47.3 | **none usable** |

### Finding 1 — model choice is per-relationship, and n=29 was too small to see it

At n=29 R1 appeared to overfit everywhere. At n=56 that reverses. The decisive case is `mcmeal ~ inexpensive`, where **leave-one-out and holdout agree emphatically**: R1 at 18.1 / 31.1 against R0 at 48.6 / 63.3, a 2.5–3× improvement on both. Its band coefficients are strongly separated (low **1.65**, mid 0.86, high **0.65**) — the Europe-versus-SEA inversion first seen at n=5, now confirmed at scale.

**Rule adopted:** escalate beyond R0 only when leave-one-out **and** holdout agree. That criterion selects R1 for `mcmeal` and `cappuccino`, and R0 for `midrange` where the two differ by less than 3 points.

### Finding 2 — activities still cannot be derived, and more data did not help

The `attraction / inexpensive` ratio spans **0.025 to 6.0, a 241× spread**, with every model at 47–62% median APE and p90 up to 227%. Adding bands makes it *worse* (61.9% LOO). This is the absence of a relationship, not a weak one.

**Consequence:** `half_day_activity` and `full_day_activity` must be collected directly or left missing. Two of the eight planned ratios are removed.

### Finding 3 — the food gate is missed on the expanded sample

`midrange ~ inexpensive` lands at 18.7 / 18.0% against a ≤15% target — the n=29 result of 15.9 / 14.7 was optimistic. R1 reaches 15.2% on LOO but does not hold out. Either widen the food gate to ~20% or accept that a single anchor cannot do better.

All R0 and R1 bias figures sit near zero (−0.04 to +0.15 in log terms). **The models are essentially unbiased; their weakness is variance** — which matters because bias compounds across an itinerary total whereas variance partly cancels.

## Phase 0c results — first fit at n=29 (superseded by 0d)

`scripts/fit-city-cost-ratios.mjs` → `data/reference/dry-run/phase-0c-ratio-model-fit.json`.

**Data:** 29 cities from the retained observation store carrying all five core measures, spanning all nine regions. Every relationship is a within-city ratio, so local currency cancels and no FX is involved. Cost bands are cut at AUD 68.82 and 132.06 on the existing dataset's `food_mid_range`, giving 10 low / 10 mid / 9 high. Evaluation is leave-one-city-out (primary, n=29) plus a deterministic 25% holdout of 7 cities (Budapest, Delhi, Goa, Medellin, Queenstown, Shanghai, Vancouver).

| Relation | Ratio spread | R0 LOO / holdout | R1 LOO / holdout | R2 LOO / holdout |
| --- | --- | --- | --- | --- |
| `midrange ~ inexpensive` (food) | 3.05× | **15.9% / 14.7%** | 11.1% / 23.9% | 13.0% / 24.8% |
| `cappuccino ~ beer` (drinks) | 6.07× | 24.6% / **10.7%** | 23.1% / 26.5% | 21.6% / 22.5% |
| `attraction ~ inexpensive` (activities) | **241×** | 47.2% / 54.7% | 54.3% / 49.9% | 55.4% / 47.3% |

### Finding 1 — R1 and R2 overfit; R0 generalises. This corrects the n=5 conclusion.

For food, R1 looks best on leave-one-out (11.1% against R0's 15.9%) and is then **the worst on the holdout** (23.9% against R0's 14.7%). The same reversal appears for drinks: R2 wins LOO at 21.6%, R0 wins holdout at 10.7%.

Adding parameters buys in-sample fit and loses out-of-sample accuracy. At n=29 with three bands, **model selection is itself unstable** — which is the strongest possible argument for the simplest form. **Adopt R0 as the default.** The earlier "R1 is the minimum defensible form" claim came from n=5 and does not survive n=29.

### Finding 2 — activities cannot be derived from food anchors at all

The `attraction / inexpensive` ratio spans **0.025 to 6.0, a 241× spread**, with every model at 47–55% median APE and p90 up to 227%. This is not a weak relationship, it is the absence of one: a museum ticket price has no stable relationship to local meal costs.

**Consequence:** `half_day_activity` and `full_day_activity` must not be derived from `paid_attraction` by ratio, and `paid_attraction` must not be derived from food anchors. Activity prices have to be collected directly, or the tier left missing. This removes two of the eight planned ratios.

### Finding 3 — the gates are met for food, missed for drinks

R0 food is 15.9% LOO / 14.7% holdout against a ≤15% gate: borderline pass. R0 drinks is 24.6% LOO against the same gate: fail, though its p90 of 96.7% shows the problem is a heavy tail rather than systematic bias (LOO bias is −0.04 in log terms, essentially unbiased).

**All R0 bias figures are near zero** (0.08, −0.04, 0.007). The models are unbiased; their weakness is variance. That matters because bias would corrupt an itinerary total, whereas variance partly cancels across a multi-city trip.

---

## Determinism

Web search cannot be made deterministic. It does not need to be. Determinism is achieved at three separate layers, and the non-determinism is confined to a single moment.

| Layer | Deterministic? | How |
| --- | --- | --- |
| **Collection** | No — bounded instead | Fixed versioned prompt, rigid schema, hard validation gates, multi-sample median |
| **Derivation** | **Yes, fully** | Pure function from anchors to 19 tiers, server-side |
| **The dataset** | **Yes, by persistence** | Anchors stored with provenance; a city never changes until a deliberate refresh |

**The key move: the LLM is a structured extractor, never an estimator.** It searches, reads and reports numbers with their sources. It does no arithmetic, no currency conversion, and never emits a tier.

### 1. Fixed prompt contract

Versioned as `city-cost-anchors-v4`, stored in `docs/prompts/`, following the `promptVersion` pattern already used by `src/lib/transport-estimation.ts:328`. It must require, per anchor:

- the numeric value and its currency
- **an explicit basis**: per person or per room, per night, and whether the figure is a lowest/"from" price, a median, or a blended average
- source name, URL, and observed date
- the number of distinct sources consulted

The basis requirement is what catches the Hanoi $100-vs-$25 problem. A number whose basis is unstated is rejected, not averaged.

### 2. Rigid output schema

Zod, following `transportEstimatePayloadSchema` (`src/lib/transport-estimation.ts:33`). Anchors only:

```
food:    inexp_meal_1p, midrange_meal_2p, mcmeal_combo
drinks:  beer_draft_0_5l, cappuccino
accom:   hostel_dorm_1p, hostel_private_2p,
         hotel_1star_2p, hotel_2star_2p, hotel_3star_2p, hotel_4star_2p
         OR budget_2p, midrange_2p, luxury_2p  (unstarred markets)
activity: paid_attraction_1p, half_day_1p, full_day_1p
```

Each anchor carries `{ value, currency, basis, sourceName, sourceUrl, sourceDate, sourceCount }`.

### 3. Hard validation gates, in code

Rejection is automatic and triggers a retry, not a silent pass.

- **Monotonicity:** `dorm < private ≤ 1★ ≤ 2★ ≤ 3★ ≤ 4★`. Hanoi's 4★=$25 against 3★=$28 fails here and is rejected.
- **Ratio bounds**, derived from the existing 121-city dataset as a sanity envelope: `1★/3★` observed IQR 0.49–0.54 → accept 0.35–0.70; `dorm/3★` IQR 0.40–0.45 → accept 0.20–0.60; `private/3★` IQR 0.51–0.58 → accept 0.35–0.75.
- **Single local currency** per city.
- **Basis stated** for every anchor, or reject.
- **Source date** present and within a freshness window.

The old dataset becomes the acceptance envelope for the new one — its internal structure is the one thing it is genuinely good for.

### 4. Multi-sample convergence

For each new city, run the extraction **3 times** and take the **median per anchor**. Record the dispersion. Dispersion is the confidence signal for accommodation, playing the same role Numbeo's contributor count plays for food and drinks. Wide dispersion flags the city low-confidence rather than silently averaging disagreement away.

### 5. Persistence is where dataset determinism comes from

Once collected and validated, anchors and their provenance are stored. The city is then **stable forever** until a deliberate refresh. Re-deriving tiers from stored anchors is a pure function and always yields identical output. Two users adding the same city on the same day may get slightly different anchors; neither city changes afterwards, and both carry the provenance to explain why.

---

## Sources

No paid data APIs. Everything below is a page fetch or a provider web search.

### Food and drinks

| Level | Source | Status |
| --- | --- | --- |
| 1 | **Numbeo page fetch** | Verified: 4 of 5 dry-run cities, one fetch each. Yields 5 anchors plus `contributors` and `last_update` |
| 2 | **LLM + web search** | For cities with no Numbeo page |
| 3 | **Country-level fallback**, flagged low confidence | Don Det pattern |
| 4 | Missing | Fail-closed |

Numbeo slug resolution is a required step: `Chiang-Rai` fails, `Chiang-Rai-Thailand` works, and Numbeo's error page suggests the correct target.

Below a contributor floor, drop to level 2 rather than publishing a thin crowd median as fact.

### Accommodation

| Level | Source | Status |
| --- | --- | --- |
| 1 | **LLM + web search** | The only route that reached Don Det and the only one returning hostel prices |
| 2 | **Country-level fallback** | Budget Your Trip publishes country pages; Laos gives $15 double / $7.65 pp sharing |
| 3 | **Calibrated ratio** from a neighbouring tier | Flagged `modelled` |
| 4 | Missing | Fail-closed |

**Budget Your Trip is the preferred search target** where it appears: consistent `/hotels/<country>/<city>` and `/hostels/<country>/<city>` schema keyed on **GeoNames IDs** (`chiang-rai-1153669`, `vang-vieng-1655087`), one uniform methodology, and separate dorm and private hostel figures. Critically it reports **what travellers actually paid**, not advertised rates — the correct estimand for a spend-prediction app, and the same quantity `/track` records.

**Rejected:** Amadeus (star not returned, no property-type field, GDS coverage wrong for a 44/121-SEA dataset), SerpApi (SMS verification), Makcorps ($1,200+/mo beyond 30 calls), Bright Data and Apify (not pursued — no paid APIs).

**Excluded on terms:** Booking.com and Hostelworld consumer sites.

### Activities

Level 1 official attraction sites (29 cities already collected) → level 2 LLM + search → level 3 calibrated ratio from `paid_attraction` → missing.

---

## Calculation

All arithmetic server-side. `src/lib/city-generation.ts:196-198` already implements the derivation formulas to *validate* LLM arithmetic via `safeRate` — promote them from checker to calculator.

### Calibrated ratios — the only modelled values

| Target | Anchor | v1 asserted | v4 |
| --- | --- | --- | --- |
| `street_food_meal_1p` | `mcmeal_combo` | `inexp × 0.60` | fitted **R1** — band-separated, 18.1% LOO |
| `premium_restaurant_meal_2p` | `midrange_meal_2p` | `× 1.50` | fitted **R0** — ~18% expected |
| `cocktail_1` | `beer` | `× 2.5` | fitted **R1** — ~19% expected |
| `wine_glass_1` | `beer` | `× 1.5` | fitted **R1** — ~19% expected |
| ~~`half_day_activity`~~ | ~~`paid_attraction`~~ | `blended × 5.5` | **collect directly or leave missing** |
| ~~`full_day_activity`~~ | ~~`paid_attraction`~~ | `blended × 12` | **collect directly or leave missing** |

The `activities` additive constant is removed; all surviving relationships are multiplicative.

**Model selection: escalate beyond R0 only when leave-one-out and holdout agree.** Phase 0d shows the answer is per-relationship: R1 for `mcmeal` (18.1 / 31.1 against R0's 48.6 / 63.3) and for `cappuccino ~ beer`; R0 for `midrange ~ inexpensive` where the forms differ by under 3 points and the simplest wins. A model preferred by LOO alone is not adopted — that was the n=29 trap.

**Activities are excluded from ratio derivation entirely** on Phase 0c evidence (241× ratio spread, ~50% APE). They are collected or missing.

### Unstarred markets

Destinations with no star system map to `budget / midrange / luxury`, then onto the 6-tier ladder via a calibrated mapping. Recorded as `ladder_basis: unstarred` so these cities stay separable in validation.

---

## Calibration and validation

**Sample:** 20 cities × 8 measures = **160 observations**, one-off, spanning all regions and the cost range.

**Validation:** hold out 25% per ratio. Report **median APE** and **median signed log error** per category and per cost band with bootstrap CIs — signed log error because price errors are multiplicative and it is symmetric for reciprocal errors. Plus **itinerary-level error** on a realistic multi-city trip, which is what the product actually depends on.

**Gates:** food/drinks median APE ≤ 15%; accommodation ≤ 25%; activities ≤ 30%; |bias| ≤ 10% per band.

**Restated price-sanity gate:** compare like with like — same star class, same date window, same city area, **median across properties**, never a headline "from" or blended average. The Copenhagen ground truth (5 direct 4★ quotes, shoulder season, 90-day lead, median DKK 1,417) is only a valid check against a figure collected on that basis.

**Existing evidence reused:** the 176 Phase 6 observations become validation data. **Continuous signal:** `/track` residuals feed the annual re-fit — and because Budget Your Trip reports actual-paid, the two measure the same quantity.

## Refresh and new cities

| Operation | Cost | Cadence |
| --- | --- | --- |
| Food/drink anchors, 121 cities | ~121 Numbeo fetches | Quarterly |
| Accommodation, 121 cities | ~121 × 3 search-backed extractions | Quarterly |
| Ratio re-fit | Analysis only | Annual |
| User adds a city | 1 fetch + 3 extractions, validated, stored | On demand |

## Files

**Reuse:** `src/lib/transport-estimation.ts` (web-search wiring, prompt versioning, JSON extraction with parse fallbacks, retry/backoff); `src/lib/city-generation.ts` (`safeRate` → calculator); `src/lib/city-cost-methodology-v3.ts` (`evidenceBasis`, FX, `money`/`quantile`); `src/lib/city-cost-observation.ts`; the observation store; the frozen FX snapshot.

**New:**
- `docs/prompts/llm_prompt_city_anchors_v4.md` — the versioned extraction contract
- `src/lib/city-cost-anchor-schema.ts` — Zod schema plus the validation gates
- `src/lib/city-cost-anchor-extraction.ts` — search-backed extraction, 3-sample median, dispersion
- `src/lib/city-cost-v4-calculator.ts` — deterministic 19-tier derivation
- `src/lib/data/city-cost-ratios.generated.json` — fitted ratios with CIs and model form
- `scripts/calibrate-city-cost-ratios.ts`, `scripts/validate-city-cost-v4.ts`

**Retire:** Phase 6D seasonal panels, reference windows, event screens, the quote ledger as a per-city requirement; 6E pre-registration and frozen holdout; 6F bake-off as specified; Amendments B, C, E, F.

## Verification

1. `npm run methodology:calibrate` / `:check` — ratio table regenerates deterministically.
2. `npm run methodology:validate:v4` — error by category and band with CIs against the gates.
3. **Determinism test:** re-derive all 121 cities from stored anchors twice; output must be byte-identical.
4. **Extraction stability test:** run the 3-sample extraction on 5 cities twice; report dispersion and confirm the validation gates reject incoherent samples.
5. Compare 3 known cities old versus new; investigate any tier moving more than 40%.
6. Itinerary backtest in `/plan` against a real tracked trip in `/track`.
7. `npx tsc --noEmit`, `npm test -- --run`, `npm run docs:check-memory`.

## Open questions

1. ~~Does "no API" include Numbeo?~~ **Resolved: Numbeo is in scope.**
2. **No relationship meets the ≤15% food gate on the expanded sample.** Best results are `mcmeal` R1 at 18.1% LOO, `cappuccino` R1 at 18.6%, `midrange` R0 at 18.0% holdout. The gates need widening to roughly 20% for food and drinks, or the accuracy target is simply not reachable from a single anchor. Decide before shipping, and publish whichever is chosen.
3. **Activities now have no derivation path.** Phase 0c removed the ratio route. `activities_mid_range` and `activities_high_end` are currently at 3 and 2 cities out of 121. They must be collected via search extraction or published as missing.
4. **The public methodology at `docs/product/methodology.md` (978 lines) still documents v2.1/v3** and backs `/estimates`. It must be rewritten at ship time, not before validation.
5. **Which provider key does extraction use?** `transport-estimation.ts` supports OpenAI, Anthropic and Gemini web search, but no provider key is currently in `.env.local`. Extraction needs at least one server-side key.
3. **Budget Your Trip terms** for automated search-derived use.
4. **Unstarred-market mapping** needs calibrating against cities that have both a star system and guesthouse inventory.
5. **Retiring 6E/6F drops pre-registration discipline** — accepted deliberately.

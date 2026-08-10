# Scripts

Legend — **LIVE** is current tooling · **HISTORICAL** belongs to the abandoned v3 programme and is kept
so its artifacts stay reproducible.

Roughly **two thirds of this folder is v3 tooling for a programme that was abandoned.** It is retained
rather than deleted because the artifacts it produced are still cited as evidence, and a claim you cannot
re-derive is a claim you cannot audit.

---

## LIVE — app tooling

| Command | Script | Purpose |
| --- | --- | --- |
| `node scripts/analyze-v5-expedia-query-contract.mjs` | `analyze-v5-expedia-query-contract.mjs` | Experiment 085: pools the changed exact-heading Expedia 2-/3-/4-star panel and checks the 30-city relationship ceiling without fitting |
| `node scripts/analyze-v5-expedia-locale-currency-proxy.mjs` | `analyze-v5-expedia-locale-currency-proxy.mjs` | Experiment 086: applies an exact-host USD proxy guard to bare-dollar Expedia rows and audits same-city/class source-date drift |
| `node scripts/analyze-v5-expedia-locale-proxy-broad-panel.mjs` | `analyze-v5-expedia-locale-proxy-broad-panel.mjs` | Experiment 087: pools a broad Expedia.com locale-proxy 2-/3-/4-star panel and checks 30-city matched relationships without fitting |
| `node scripts/analyze-v5-expedia-targeted-23-panel.mjs` | `analyze-v5-expedia-targeted-23-panel.mjs` | Experiment 088: audits targeted Expedia 2-/3-star URL-pattern searches and the pooled 2↔3 matched-city ceiling without fitting |
| `node scripts/analyze-v5-activity-semantic-calibration.mjs` | `analyze-v5-activity-semantic-calibration.mjs` | Experiment 089: scores independent activity anchors against BudgetYourTrip tiers without product mapping |
| `node scripts/analyze-v5-one-call-anchor-bundle.mjs` | `analyze-v5-one-call-anchor-bundle.mjs` | Experiment 090: scores five-search single-city anchor coverage without fitting or product mapping |
| `node scripts/analyze-v5-expatistan-drink-anchors.mjs` | `analyze-v5-expatistan-drink-anchors.mjs` | Experiment 091: audits Expatistan cocktail and wine-bottle anchor coverage without glass conversion |
| `node scripts/analyze-v5-drink-menu-calibration.mjs` | `analyze-v5-drink-menu-calibration.mjs` | Experiment 092: computes deterministic public-menu medians and same-currency calibration screens |
| `node scripts/analyze-v5-wine-volume-targeted-panel.mjs` | `analyze-v5-wine-volume-targeted-panel.mjs` | Experiment 093: audits explicit-volume wine-glass coverage without bottle conversion |
| `node scripts/analyze-v5-trip-class-proxy-calibration.mjs` | `analyze-v5-trip-class-proxy-calibration.mjs` | Experiment 094: audits labelled Trip.com class proxies against Expedia two-adult trends |
| `npm run docs:sync-memory` / `:check-memory` | `sync-memory-docs.mjs` | Mirror and verify `AGENTS.md` against `CLAUDE.md` |
| `npm run country-metadata:generate` | `generate-country-metadata.mjs` | Regenerate canonical country metadata |
| `npm run models:refresh` / `:check` | `refresh-curated-models.ts` | Refresh the curated LLM model snapshot |
| — | `backup.sh`, `generate-certs.sh` | Ops helpers |

## LIVE — methodology v4

| Command (`npm run …`) | Script | Purpose |
| --- | --- | --- |
| `methodology:v4:fit-ratios` | `fit-city-cost-ratios.mjs` | **Ratio model fitting and validation.** Fully deterministic — regenerates `phase-0c-ratio-model-fit.json` byte-identically, and with it every figure in methodology-v4 §6–§7 |
| `methodology:v4:fit-accommodation-ladder` | `fit-accommodation-class-ratios.mjs` | Fits the star ladder and the incumbent-1.800 comparison |
| `methodology:v4:analyze-accommodation` | `analyze-accommodation-stage1.mjs` | First-page estimator depth, ratio and headline analysis |
| `methodology:v4:score-prompt` | `score-anchor-prompt-test.mjs` | Scores prompt output against ground truth. Needs `TEST_DIR` |
| `methodology:v4:combine-samples` | `combine-anchor-samples.mjs` | k-sample combination and coverage analysis. Needs `TEST_DIR` |
| `methodology:v4:score-accommodation-bias` | `score-accommodation-bias.mjs` | Headline-vs-direct-quote bias. **Refuses to correct on under 3 cities** — a deliberate guard against the one-city reversal that has already happened once |

> The two accommodation scripts embed a `generatedAt` timestamp, so their artifacts differ by that one
> line on re-run while every computed value reproduces exactly.

## CURRENT — methodology v6

| Command | Script | Purpose |
| --- | --- | --- |
| `node scripts/fit-city-cost-ladder-v6.mjs` | `fit-city-cost-ladder-v6.mjs` | **Fits the v6 accommodation ladder diagnostics** from pooled v5 Expedia panels plus the 25-city Booking.com v2 development panel, scores leave-one-out at city level, fits the Booking→Expedia 3-star calibration, applies the documented post-score private rollback, and regenerates `data/reference/v6/coefficients-v6.json`. Reads only repo files — no network or model calls |
| `node scripts/fit-city-cost-ladder-v6.mjs --check` | ditto | Verifies the committed coefficients match their evidence byte-for-byte. Exits 1 on drift. Belongs in the verification baseline |
| `node scripts/validate-city-cost-v6-ground-truth.mjs --require-complete` | `validate-city-cost-v6-ground-truth.mjs` | Manifest-driven development-ledger audit; completeness means zero errors and zero pending slots, while substance warnings are reported separately and never block |
| `node scripts/freeze-city-cost-v6-candidate.mjs` | `freeze-city-cost-v6-candidate.mjs` | Hashes the coefficients/offset/grade/interval candidate into the holdout seal before the first holdout read |
| `node scripts/score-city-cost-v6-holdout.mjs` | `score-city-cost-v6-holdout.mjs` | One-time gate 2–6 score against the frozen holdout; refuses a second pass |
| `node scripts/score-expedia-production-anchor-v6.mjs [--check]` | `score-expedia-production-anchor-v6.mjs` | Deterministic scorer for experiment 001; reads only the development Booking ledger and Expedia experiment responses |

## SUPERSEDED — methodology v5

> The v5 acceptance rule is superseded by v6; these audit scripts still run and their outputs remain
> valid evidence. See `docs/dev/plans/city-cost-methodology-v6.md` §1.

| Command (`npm run …`) | Script | Purpose |
| --- | --- | --- |
| `methodology:v5:baseline` | `audit-city-cost-v5-baseline.mjs` | Experiment 000: deterministic coverage and provenance audit of the retained v3/v4 evidence; does not treat the shipping CSV as ground truth |
| `methodology:v5:accommodation` | `audit-city-cost-v5-accommodation.mjs` | Experiment 002: reassesses the retained hotel ladder, estimator stability, and hostel-unit identifiability |
| `node scripts/run-city-cost-v5-one-call.mjs` | `run-city-cost-v5-one-call.mjs` | Experiment 001: exactly one OpenAI Responses or Anthropic Messages request with built-in web search, telemetry, and strict local validation; requires a provider key |
| `npx vitest run src/lib/city-cost-methodology-v5.test.ts` | `src/lib/city-cost-methodology-v5.ts` | Experiment 003: deterministic 19-tier derivation boundary with fail-closed provenance propagation |
| `node scripts/analyze-v5-activity-ground-truth.mjs` | `analyze-v5-activity-ground-truth.mjs` | Experiment 023: deterministic audit of definition-compatible direct activity observations; refuses to fit below the 30-city/10-holdout gate |
| `node scripts/analyze-v5-accommodation-panel.mjs` | `analyze-v5-accommodation-panel.mjs` | Experiment 024: strict acceptance audit for single-city accommodation panel rows; no fit below the 30-city/10-holdout gate |
| `node scripts/analyze-v5-accommodation-bed-boundary.mjs` | `analyze-v5-accommodation-bed-boundary.mjs` | Experiment 025: accepts only explicit one-bed dorm inputs for deterministic scaling; hotel classes remain two-adult per-room |
| `node scripts/analyze-v5-hotevi-tier-feasibility.mjs` | `analyze-v5-hotevi-tier-feasibility.mjs` | Experiment 027: audits exact HOTEVI city/tier/month rows; grouped tiers never map directly to product star classes |
| `node scripts/analyze-v5-expedia-class-trends.mjs` | `analyze-v5-expedia-class-trends.mjs` | Experiment 028: audits exact Expedia two-adult class-trend rows and rejects from/lowest/event prices |
| `node scripts/analyze-v5-one-star-source.mjs` | `analyze-v5-one-star-source.mjs` | Experiment 030: audits Momondo/KAYAK 1-star candidates without upgrading unknown occupancy |
| `node scripts/analyze-v5-one-star-occupancy-calibration.mjs` | `analyze-v5-one-star-occupancy-calibration.mjs` | Experiment 031: audits Momondo candidates against explicit two-adult Skyscanner/Expedia rows |
| `node scripts/analyze-v5-one-star-property-basket.mjs` | `analyze-v5-one-star-property-basket.mjs` | Experiment 032: audits explicit two-adult named 1-star property quotes without aggregating them |
| `node scripts/analyze-v5-one-star-aggregators.mjs` | `analyze-v5-one-star-aggregators.mjs` | Experiment 033: audits Trip.com/HotelsCombined/Budget Your Trip city-level 1-star candidates |
| `node scripts/analyze-v5-one-star-aggregator-panel.mjs` | `analyze-v5-one-star-aggregator-panel.mjs` | Experiment 034: audits 10-city aggregator coverage and source agreement with city holdouts |
| `node scripts/analyze-v5-activity-budgetyourtrip.mjs` | `analyze-v5-activity-budgetyourtrip.mjs` | Experiment 035: audits Budget Your Trip per-person activity/entertainment rows without scaling or fitting |
| `node scripts/analyze-v5-activity-budgetyourtrip-panel.mjs` | `analyze-v5-activity-budgetyourtrip-panel.mjs` | Experiment 036: audits 10-city activity coverage with locked holdouts |
| `node scripts/analyze-v5-activity-definition-matched.mjs` | `analyze-v5-activity-definition-matched.mjs` | Experiment 037: audits low-cost ticket, half-day, and full-day premium activity anchors |
| `node scripts/analyze-v5-one-star-budgetyourtrip-panel.mjs` | `analyze-v5-one-star-budgetyourtrip-panel.mjs` | Experiment 038: audits guarded BudgetYourTrip 1-star coverage with zero-denominator checks |
| `node scripts/analyze-v5-hostel-private-boundary.mjs` | `analyze-v5-hostel-private-boundary.mjs` | Experiment 039: audits one-bed dorm inputs and explicit two-adult private-hostel rows |
| `node scripts/analyze-v5-private-two-guest-search.mjs` | `analyze-v5-private-two-guest-search.mjs` | Experiment 040: audits explicit two-adult named-hostel quotes; no city-wide mapping |
| `node scripts/analyze-v5-one-star-paired-calibration.mjs` | `analyze-v5-one-star-paired-calibration.mjs` | Experiment 041: audits one-star city-statistic/explicit-two-adult pairing without fitting |
| `node scripts/analyze-v5-registry-class-property-quotes.mjs` | `analyze-v5-registry-class-property-quotes.mjs` | Experiment 042: audits official-register class joins to property quotes without basket aggregation |
| `node scripts/analyze-v5-google-hotels-one-star.mjs` | `analyze-v5-google-hotels-one-star.mjs` | Experiment 043: audits Google Hotels one-star property quotes without basket aggregation |

| `node scripts/analyze-v5-activity-operator-sources.mjs` | `analyze-v5-activity-operator-sources.mjs` | Experiment 044: audits GetYourGuide/Viator activity-definition rows without scaling or product mapping |
| `node scripts/analyze-v5-trip-activity-definitions.mjs` | `analyze-v5-trip-activity-definitions.mjs` | Experiment 045: audits Trip.com activity-definition rows without scaling or product mapping |
| `node scripts/analyze-v5-official-activity-pages.mjs` | `analyze-v5-official-activity-pages.mjs` | Experiment 046: audits official activity-page rows without scaling or product mapping |
| `node scripts/analyze-v5-accommodation-property-panel.mjs` | `analyze-v5-accommodation-property-panel.mjs` | Experiment 047: audits explicit two-adult private-hostel and one-star property quotes without aggregation |
| `node scripts/analyze-v5-private-hostel-broad-panel.mjs` | `analyze-v5-private-hostel-broad-panel.mjs` | Experiment 048: audits a twelve-city explicit two-adult private-hostel panel without aggregation |
| `node scripts/analyze-v5-one-star-broad-panel.mjs` | `analyze-v5-one-star-broad-panel.mjs` | Experiment 049: audits a twelve-city explicit two-adult one-star property panel without aggregation |
| `node scripts/analyze-v5-tax-resolved-activity-ticket.mjs` | `analyze-v5-tax-resolved-activity-ticket.mjs` | Experiment 050: audits tax-resolved official activity tickets without scaling or product mapping |
| `node scripts/analyze-v5-minimal-anchor-panel.mjs` | `analyze-v5-minimal-anchor-panel.mjs` | Experiment 051: audits one-city nine-anchor coverage without modelling or product mapping |
| `node scripts/analyze-v5-three-star-broad-panel.mjs` | `analyze-v5-three-star-broad-panel.mjs` | Experiment 052: audits a twelve-city explicit two-adult three-star property panel without aggregation |
| `node scripts/analyze-v5-selector-occupancy-audit.mjs` | `analyze-v5-selector-occupancy-audit.mjs` | Experiment 053: compares strict and selector-relaxed three-star occupancy semantics without mapping |
| `node scripts/analyze-v5-model-fit-adequacy.mjs` | `analyze-v5-model-fit-adequacy.mjs` | Experiment 054: counts definition-compatible city pairs without fitting or mapping |
| `node scripts/analyze-v5-skyscanner-class-panel.mjs` | `analyze-v5-skyscanner-class-panel.mjs` | Experiment 055: audits four Skyscanner hotel-class averages without mapping |
| `node scripts/analyze-v5-agoda-one-three-star-panel.mjs` | `analyze-v5-agoda-one-three-star-panel.mjs` | Experiment 056: audits Agoda 1-/3-star class prices without mapping |
| `node scripts/analyze-v5-booking-class-tax-panel.mjs` | `analyze-v5-booking-class-tax-panel.mjs` | Experiment 057: audits Booking 3-/4-star class averages and tax metadata |
| `node scripts/analyze-v5-trip-class-tax-panel.mjs` | `analyze-v5-trip-class-tax-panel.mjs` | Experiment 058: audits Trip.com 2-/3-/4-star class averages and tax metadata |
| `node scripts/analyze-v5-expedia-class-panel.mjs` | `analyze-v5-expedia-class-panel.mjs` | Experiment 059: audits Expedia 2-/3-/4-star two-adult trend rows and tax basis |
| `node scripts/analyze-v5-expedia-four-star-gap.mjs` | `analyze-v5-expedia-four-star-gap.mjs` | Experiment 060: audits Expedia 4-star gap recovery without mapping |
| `node scripts/analyze-v5-expedia-paired-panel.mjs` | `analyze-v5-expedia-paired-panel.mjs` | Experiment 061: audits paired Expedia 2-/3-/4-star rows without mapping |
| `node scripts/analyze-v5-expedia-three-star-gap.mjs` | `analyze-v5-expedia-three-star-gap.mjs` | Experiment 062: audits Expedia 3-star gap recovery without mapping |
| `node scripts/analyze-v5-expedia-paired-panel-2.mjs` | `analyze-v5-expedia-paired-panel-2.mjs` | Experiment 063: audits second paired Expedia 2-/3-/4-star tranche |
| `node scripts/analyze-v5-expedia-pooled-ceiling.mjs` | `analyze-v5-expedia-pooled-ceiling.mjs` | Experiment 064: audits pooled Expedia coverage and model eligibility without fitting |
| `node scripts/analyze-v5-expedia-one-star-paired-panel.mjs` | `analyze-v5-expedia-one-star-paired-panel.mjs` | Experiment 065: audits explicit Expedia 1-/3-star paired coverage without mapping |
| `node scripts/analyze-v5-budgetyourtrip-one-star-semantics.mjs` | `analyze-v5-budgetyourtrip-one-star-semantics.mjs` | Experiment 066: audits BudgetYourTrip one-star room/tax semantics without mapping |
| `node scripts/analyze-v5-budgetyourtrip-double-occupancy-proxy.mjs` | `analyze-v5-budgetyourtrip-double-occupancy-proxy.mjs` | Experiment 067: screens same-source double-occupancy proxy semantics without fitting |
| `node scripts/analyze-v5-budgetyourtrip-snippet-proxy.mjs` | `analyze-v5-budgetyourtrip-snippet-proxy.mjs` | Experiment 068: screens snippet-only double-occupancy proxy semantics without fitting |
| `node scripts/analyze-v5-budgetyourtrip-explicit-calibration.mjs` | `analyze-v5-budgetyourtrip-explicit-calibration.mjs` | Experiment 069: audits independent explicit two-adult one-star candidates without fitting |
| `node scripts/analyze-v5-private-hostel-three-source-panel.mjs` | `analyze-v5-private-hostel-three-source-panel.mjs` | Experiment 070: audits explicit two-guest private-hostel candidates without aggregation |
| `node scripts/analyze-v5-activity-per-person-scaling-panel.mjs` | `analyze-v5-activity-per-person-scaling-panel.mjs` | Experiment 071: audits per-person activity inputs before deterministic scaling |
| `node scripts/analyze-v5-priceoftravel-hostel-index-dorm.mjs` | `analyze-v5-priceoftravel-hostel-index-dorm.mjs` | Experiment 072: audits one-person shared-dorm index rows before scaling |
| `node scripts/analyze-v5-priceoftravel-hostel-index-calibration.mjs` | `analyze-v5-priceoftravel-hostel-index-calibration.mjs` | Experiment 073: scores same-property current dorm pairs without fitting or mapping |
| `node scripts/analyze-v5-hostelworld-shared-dorm-panel.mjs` | `analyze-v5-hostelworld-shared-dorm-panel.mjs` | Experiment 074: audits current Hostelworld one-person shared-dorm rows before scaling |
| `node scripts/analyze-v5-expedia-gap-panel.mjs` | `analyze-v5-expedia-gap-panel.mjs` | Experiment 075: pools fresh Expedia class rows and checks 30-city relationship eligibility without fitting |
| `node scripts/analyze-v5-hotevi-grouped-tier-panel.mjs` | `analyze-v5-hotevi-grouped-tier-panel.mjs` | Experiment 076: audits HOTEVI grouped hotel-rate proxy coverage without splitting or mapping |
| `node scripts/analyze-v5-hotevi-explicit-class-panel.mjs` | `analyze-v5-hotevi-explicit-class-panel.mjs` | Experiment 077: audits HOTEVI named-property class quotes without mapping |
| `node scripts/analyze-v5-expedia-matched-panel.mjs` | `analyze-v5-expedia-matched-panel.mjs` | Experiment 078: pools a new single-city Expedia 2-/3-/4-star panel and checks the 30-city relationship ceiling without fitting |
| `node scripts/analyze-v5-hotevi-proxy-calibration.mjs` | `analyze-v5-hotevi-proxy-calibration.mjs` | Experiment 079: joins HOTEVI grouped proxy rows to strict Expedia 3-/4-star rows and checks calibration/holdout gates |
| `node scripts/analyze-v5-activity-scaling-panel.mjs` | `analyze-v5-activity-scaling-panel.mjs` | Experiment 080: audits exact-city BudgetYourTrip per-person/day activity tiers and deterministic two-person scaling |
| `node scripts/analyze-v5-activity-repeatability.mjs` | `analyze-v5-activity-repeatability.mjs` | Experiment 081: measures three-call single-city activity extraction dispersion without averaging it away |
| `node scripts/analyze-v5-worldstaytracker-accommodation.mjs` | `analyze-v5-worldstaytracker-accommodation.mjs` | Experiment 082: audits exact-city World Stay Tracker 3-/4-star coverage and four-operation protocol compliance (rejected) |
| `node scripts/analyze-v5-worldstaytracker-cityid-rating.mjs` | `analyze-v5-worldstaytracker-cityid-rating.mjs` | Experiment 083: audits one-search cityid URL navigation for World Stay Tracker 3-/4-star coverage (rejected) |
| `node scripts/analyze-v5-nomadlio-food-drink.mjs` | `analyze-v5-nomadlio-food-drink.mjs` | Experiment 084: audits Nomadlio six-label food/drink coverage and semantic proxy status (rejected mapping) |

V5 experiment outputs live under `data/reference/v5/experiments/` and must retain their hypothesis,
inputs, raw evidence, deterministic results, and verdict.

## HISTORICAL — v1 audit

| Command | Script | Purpose |
| --- | --- | --- |
| `npm run methodology:audit` | `audit-city-cost-accuracy.mjs` | Reproduces `accuracy_audit.csv` — the 9-observation audit that triggered the rebuild |

## HISTORICAL — v3 observed-first programme

All of the below belong to the abandoned programme. **Do not build on them.** See `/LOG.md` Part 1.

### Pilot, observations and materialization

| Command (`npm run …`) | Script |
| --- | --- |
| `methodology:pilot` | `select-city-cost-pilot.mjs` |
| `methodology:pilot:enrich` / `:check` | `build-city-cost-pilot-enrichment.ts` |
| `methodology:pilot:profile` / `:check` | `build-city-cost-pilot-profile.ts` |
| `methodology:research` | `run-city-cost-research.ts` — reads `docs/prompts/llm_prompt_city_cost_observations_1.md` |
| `methodology:batches:validate` | `validate-city-cost-batches.ts` |
| `methodology:observations:validate` | `validate-city-cost-observations.ts` |
| `methodology:materialize:v3` / `:check` | `materialize-city-cost-v3.ts` |

### Accommodation panels

The register-first path that produced **five accepted quotes in one city** across five frozen frames —
the cost profile that forced the move to a platform channel.

| Command (`npm run …`) | Script |
| --- | --- |
| `methodology:accommodation-panel:build:{barcelona,copenhagen,prague,lisbon,da-nang}` | `build-*-accommodation-property-panel.ts` |
| `methodology:accommodation-panels:validate` | `validate-accommodation-property-panels.ts` |
| `methodology:accommodation-windows:validate` | `validate-accommodation-reference-windows.ts` |
| `methodology:accommodation-quotes:validate` | `validate-accommodation-quote-attempts.ts` |
| `methodology:accommodation:websites` / `:check` | `apply-accommodation-website-verifications.ts` |
| `methodology:accommodation-register:capture:{da-nang,hanoi}` | `capture-vietnam-accommodation-register.ts` |
| `methodology:accommodation-register:validate:{da-nang,hanoi}` | `validate-vietnam-accommodation-register.ts` |
| `methodology:accommodation-classification:build:hanoi` / `:validate:hanoi` | `*-hanoi-accommodation-classification-reconciliation.ts` |
| `methodology:accommodation-geocode:da-nang` / `:validate:da-nang` | `*-da-nang-accommodation-geocod*.ts` |

The Hanoi reconciliation never unblocked: 330 records stayed pending with zero geolocation-eligible rows.

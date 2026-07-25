# Handoff: Phase 6 Observed-First City Cost Methodology

## Current Position

Phase 6A (methodology/acceptance rules) and 6B (reproducible evidence pipeline) are complete. Phase 6C (model-ready 36-city pilot) and 6D (observed-first accommodation panels) remain active. Phase 6E onward must stay gated until the combined pilot has sufficient coverage, independent source overlap, seasonal accommodation evidence, and a frozen missingness report.

The current deterministic pilot profile is still `insufficient_for_fallback_model_selection`:

- 36 pilot destinations
- 29 measured city-size records
- 18 measured tourism-intensity records (14 strict, 4 relaxed)
- 16 destinations with both registered predictors
- 18 structured tourism-intensity rejections
- 0 tourism destinations not yet screened
- 151 of 684 required tier cells materialized (22.08%)
- zero complete 19-cell destinations
- zero eligible annualized accommodation measures

Do not begin holdout selection or fallback-model comparison from this state.

## Graded Tourism Evidence (Schema v4)

Phase 6C now permits a relaxed measurement tier so throughput does not force silent contamination. Every measured tourism record carries:

- `evidenceGrade`: `strict` or `relaxed`
- `relaxationReasons`: empty for strict, non-empty for relaxed, drawn from `geography_approximate`, `numerator_partial`, `numerator_rounded`, `reference_year_stale`

The invariant is enforced by a Zod `superRefine`, by `src/lib/city-cost-pilot-enrichment.test.ts`, and by the profile's tourism stratum key (`measured_from_public_sources:<grade>:<band>`), so relaxed rows can never merge into strict strata or into a strict-only fit.

**Rule for Phase 6E and 6F:** relaxed records are excludable by construction. Any model comparison must report results both with and without them, and the frozen holdout design must state which grades it admits. A relaxed record is not a lower-confidence strict record; it is a measurement of a slightly different estimand, named in `relaxationReasons`.

The four relaxed records are Can Tho (`numerator_rounded`), Da Lat (`geography_approximate`, `numerator_rounded`), Chiang Rai (`geography_approximate`, `numerator_partial`), and Zanzibar (`numerator_partial`, `reference_year_stale`).

Bali (Ubud) was rejected rather than relaxed: BPS returned HTTP 403 for the province resident table and only derived secondary population figures were available. A measurement is never built on an unsourced denominator, however many relaxations are permitted.

## Latest Completed Tourism Work

Tourism-intensity screening finished in a single parallel pass that cleared the last ten unscreened destinations. That pass introduced the graded evidence tier described below, because four of the ten had usable evidence that departed from the frozen estimand in named, recordable ways.

The last strict measured record remains Goa, retained at the whole-state planner geography:

- 10,409,197 official 2024 tourist arrivals
- 1,583,000 projected residents at December 2024
- 6.58 arrivals per resident (`high`)
- limited inline disclosure of overnight filtering, coverage, and repeat-visit handling is retained in the record

Recent commits, newest first:

- `8d5a959 feat: complete pilot tourism screening with graded evidence`
- `6004339 feat: record hanoi tourism source gap`
- `7c07841 feat: record da nang tourism source gap`
- `e0820fd feat: record havana tourism source gap`
- `2d09c68 feat: add goa tourism intensity`
- `42952c4 feat: record delhi tourism source gap`

## Remaining Tourism Screens

None. All 36 pilot destinations are now either measured or explicitly screened and rejected.

The six destinations rejected in the final pass, with reasons:

- Bali (Ubud) — `incompatible_geography`: province-level foreign arrivals plus domestic *trips* including day visits; no retrievable official province denominator
- Vang Vieng — `incompatible_geography`: Vientiane Province total only, no district series, no overnight split
- Don Det — `incompatible_geography`: Champasak figures are forward-looking targets, not outturn
- Pu Luong — `incomplete_period`: a single month (59,500 guests, October 2024) for a strongly seasonal destination
- Santa Fe (Bantayan) — `incompatible_geography`: Cebu province only, no municipal or island table
- Yangon — `incompatible_numerator`: gateway airport arrivals and national foreign totals only

The screening rule is unchanged for any future recollection: a strict record needs a full-period all-visitor overnight-arrivals numerator and a same-geography resident denominator. Anything short of that is either a named relaxation or a rejection — never an unmarked measurement.

## Accommodation State And Blocker

The accommodation contract requires price-blind official property frames, direct-property quotes, five accepted quotes per measure and season, and at least 60% cross-season property overlap.

- Barcelona, Copenhagen, Da Nang, Lisbon, and Prague have reproducible frames at varying stages.
- Copenhagen 4-star shoulder has five accepted quotes from ten ordered attempts.
- All twelve Barcelona 4-star primary website identities have outcomes; eleven are verified and one remains an unresolved placeholder redirect.
- Barcelona exact-date quote collection and the remaining interactive booking work are blocked by the local in-app browser runtime failing to start Node (`The system cannot find the path specified`).
- Do not record that environment failure as a property quote failure.

When the interactive browser works again, resume Barcelona exact-date direct-property quotes and Copenhagen low/high seasons before expanding quote collection. Continue event-window screening and preserve all replacement history.

## Reproducible Commands

Run after every enrichment change:

```text
npm run methodology:pilot:enrich
npm run methodology:pilot:enrich:check
npm run methodology:pilot:profile
npm run methodology:pilot:profile:check
npm run docs:sync-memory
npm run docs:check-memory
npm test -- --run
npx tsc --noEmit
```

`CLAUDE.md` is the canonical memory source. `npm run docs:sync-memory` copies it to `AGENTS.md`; always verify the two remain byte-identical.

## Worktree Safety

The following dashboard work and archive are unrelated to Phase 6 and were deliberately not staged:

- `src/app/api/dashboard/summary/route.ts`
- `src/app/page.tsx`
- `src/lib/burn-rate.ts`
- `src/lib/burn-rate.test.ts`
- `src/lib/dashboard-as-of.test.ts`
- `src/lib/dashboard-as-of.ts`
- `docs/product/data-0ace327c-3618-48a4-ba30-4573fbca83cd-1783829740-8c891ae5-batch-0000.zip`

Preserve those files unless their owning workstream explicitly requests changes.

## Recommended Next Step

Tourism screening is done, so the binding constraints on Phase 6C are now category evidence and accommodation.

1. **Category coverage.** Tier coverage is stuck at 151/684 cells (22.08%) with zero complete cities. This is the single largest blocker: cross-channel disagreement, source-age, robust-outlier, and systematic-missingness diagnostics all require overlapping *independent* source channels, and almost all current evidence is single-channel (largely Numbeo for food/drinks plus official attraction pages). Adding a second independent channel per city matters more than adding more cities.
2. **Accommodation.** Still zero eligible annualized measures. Resume Barcelona exact-date direct-property quotes and Copenhagen low/high seasons when the interactive browser runtime works again.

Consider whether the graded-evidence pattern should be extended to category observations as well. The same tension that produced it — throughput versus a frozen estimand — applies to food, drinks, and activities, and the tier cells are where the coverage shortfall actually is.

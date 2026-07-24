# Handoff: Phase 6 Observed-First City Cost Methodology

## Current Position

Phase 6A (methodology/acceptance rules) and 6B (reproducible evidence pipeline) are complete. Phase 6C (model-ready 36-city pilot) and 6D (observed-first accommodation panels) remain active. Phase 6E onward must stay gated until the combined pilot has sufficient coverage, independent source overlap, seasonal accommodation evidence, and a frozen missingness report.

The current deterministic pilot profile is still `insufficient_for_fallback_model_selection`:

- 36 pilot destinations
- 29 measured city-size records
- 14 measured tourism-intensity records
- 12 destinations with both registered predictors
- 11 structured tourism-intensity rejections
- 11 tourism destinations not yet screened
- 151 of 684 required tier cells materialized (22.08%)
- zero complete 19-cell destinations
- zero eligible annualized accommodation measures

Do not begin holdout selection or fallback-model comparison from this state.

## Latest Completed Tourism Work

The most recent measured record is Goa, retained at the whole-state planner geography:

- 10,409,197 official 2024 tourist arrivals
- 1,583,000 projected residents at December 2024
- 6.58 arrivals per resident (`high`)
- limited inline disclosure of overnight filtering, coverage, and repeat-visit handling is retained in the record

The latest screened rejection is Da Nang:

- the official full-year 2024 report estimates more than 10.9 million guests served by accommodation establishments
- a separate official city statistical report says some visitors used accommodation for only a few hours while sightseeing
- the served-guest series therefore cannot establish an overnight-only arrivals numerator
- tourism intensity remains missing rather than converting short rests into overnight arrivals

Recent commits, newest first:

- `e0820fd feat: record havana tourism source gap`
- `2d09c68 feat: add goa tourism intensity`
- `42952c4 feat: record delhi tourism source gap`
- `93693f2 feat: record medellin tourism source gap`
- `23eae52 feat: record nairobi tourism source gap`
- `2e6475e feat: record dubai tourism source gap`
- `1104151 feat: record shanghai tourism source gap`

## Remaining Tourism Screens

The eleven `not_yet_screened` destinations are:

- Zanzibar
- Don Det
- Can Tho
- Pu Luong
- Da Lat
- Vang Vieng
- Santa Fe (Bantayan)
- Chiang Rai
- Hanoi
- Yangon
- Bali (Ubud)

For each destination, accept only a full-period all-visitor overnight-arrivals numerator and a same-geography resident denominator. Retain a structured rejection rather than substituting international-only arrivals, day visits, guest nights, airport traffic, nearby cities, national totals, or mismatched administrative units.

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

Continue the eleven tourism screens, prioritizing destinations with official municipal or provincial accommodation-arrival tables (Hanoi, Chiang Rai, or Zanzibar). In parallel, improve independent source overlap for food, drinks, and activities. Resume direct-property accommodation quotes only when the interactive browser runtime is functional.

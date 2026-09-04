# City Cost v1.1 — Restore the Simple, Effective Method

**Status:** Methodology complete; Phase 8 (performance remediation) is the active phase, at Step 4; Phase 7 route
workflows remain open but are not the active workstream; Phase 9 (public README) is queued.

**Current phase:** Phase 8 — Webapp performance remediation. Steps 0, 1, 3 and 5 are complete, Step 4 (render hot
paths) is in progress, and Steps 2, 6, 7 and 8 are open.

**Phase 7A is superseded.** Its recorded route numbers are invalid: `scripts/check-webapp-performance.mjs:34` fetches
with `redirect: 'follow'` and no session cookie, so every route 307s to `/login` and the script measured the login
page seven times. See Phase 8 for the corrected evidence.

**Branch:** `main` (v1.1 history merged and synchronized with `origin/main`; protected v6 archive retained)

**Last updated:** 3 September 2026

**Latest implementation checkpoint:** `3c791ca` — dataset and settings payload reductions, the slim
`/api/estimates?view=dataset` list shape with an on-demand `?cityId=` provenance mode, and restored `next/link`
sidebar prefetching.

**Latest plan checkpoint:** `3c791ca` — recorded Phase 8 Step 3 as complete, including the `/dataset` sub-100 KB
target that was not met and the reason it is not reachable by payload trimming.

**Next action:** Phase 8 Step 4 — finish the remaining render hot paths. Apply `next/dynamic` plus
mount-on-first-open to `BulkTransportEstimateDialog`, `PlannerNewCityDialog` and `CityGenerationPanel`; memoize the
`legs.map(...)` array passed to `BulkTransportEstimateDialog`; memoize the `/` dashboard derivation chain; convert the
three inline chart render functions in `src/app/page.tsx` into components. Then run the full Step 4 baseline.

**Working tree:** `src/app/plan/page.tsx`, `src/components/itinerary/LegCard.tsx` and `src/app/dataset/page.tsx`
carry uncommitted Step 4 work. Items stay `[ ]` until their verification runs.

**Deferred:** capture same-day operator or aggregator reference quotes for the fixed transport route fixture, then run
the directional report and record the evidence and any initial tolerance decision.

## Current scope and decisions

### Owner decisions

**Owner activation decision (18 August 2026):** The owner explicitly authorized v1.1 activation while deferring the
keyed smoke because secure remote-desktop access was unavailable. That exception did not authorize existing-city
migration or CSV changes; the deferred smoke was subsequently completed on 26 August 2026.

**Owner FX decision (26 August 2026):** Each user-triggered v1.1 generation must obtain the latest USD/AUD FX data in
that same LLM call. The checked-in 22 July snapshot remains reproducibility evidence only and must not be a silent
runtime fallback. The returned observation must include an as-of date and source provenance and pass server freshness
and validity checks before any estimate is persisted.

### Repository state (25 August 2026 checkpoint)

The documentation cleanup began with `main` and `origin/main` both at `40f3c65`; it changed no tracked implementation
files. The three verified historical v5 files were moved outside the repository to a named quarantine, so no v5 files
remain untracked in the working tree and none are part of the tracked v1.1 product branch.

### Methodology and product scope

v6.1 research is complete but is not accepted for product cutover. The staged v6.1 CSV will not replace the live
dataset, Phase 11 is cancelled, and the v6.1 generation path will not remain an executable product option.

The live 121-city v1 CSV remains unchanged. The clean v1.1 product branch was created from `main`. v1.1 keeps
v1's anchor definitions and formulas exactly, but the LLM returns ten anchors plus a dated RBA USD/AUD observation;
deterministic server code validates that observation, performs the formulas, and converts USD→AUD. Under the owner's
explicit decision, v1.1 becomes the default for newly generated cities; the originally deferred owner-key smoke passed
on 26 August 2026. Existing cities are not bulk-migrated.

The lived-spending benchmark previously proposed as recommendation 4 is explicitly out of scope. No new collection,
holdout, coefficient fitting, accommodation refit, or existing-city migration is authorized by this plan.

## Plan maintenance

This file is the canonical progress artifact.

- Update `PLAN.md` whenever a task starts or finishes, and before every commit and push.
- Mark pending tasks `[ ]` and verified completed tasks `[x]`.
- Label every phase `TO DO`, `IN PROGRESS`, or `COMPLETE`.
- Keep at most one phase `IN PROGRESS`.
- Update the current phase, exact next action, date, branch, and latest commit at every checkpoint.
- Never mark a task complete before its required verification passes.
- Preserve superseded decisions as dated history rather than deleting them.

## Phase 0 — Preserve history and initialize the new plan — COMPLETE

- [x] Copy the previous root `PLAN.md` to `docs/dev/archive/plans/PLAN-city-cost-v6-1-final-2026-08-18.md`.
- [x] Add a `SUPERSEDED — not current` banner to the archived plan.
- [x] Replace root `PLAN.md` with this tracked v1.1 checklist.
- [x] Record the v6.1 retirement decision in `LOG.md` and the archived v6 research pointer.
- [x] Keep the retired v6.1 plan, handoff, loop prompt, and release recommendation out of the clean product branch.
- [x] Run `npm run docs:sync-memory` and `npm run docs:check-memory`.
- [x] Verify the archived plan is complete and unchanged apart from its banner.
- [x] Commit and push the planning transition (`2d74c0b`).

## Phase 1 — Close v6.1 without erasing it — COMPLETE

- [x] Mark v6.1 research complete but rejected for product cutover.
- [x] Cancel Phase 11 permanently.
- [x] Record that the staged v6.1 CSV must never replace the live CSV.
- [x] Preserve all v5/v6 experiments, holdouts, staged artifacts, and historical conclusions unchanged.
- [x] Confirm the live CSV and default v1 path remain untouched.
- [x] Commit and push the final v6 documentation state.
- [x] Create and push the annotated tag `city-cost-v6.1-research-final-2026-08-18`.
- [x] Record the tag and final commit in this plan (`335e61b`).
- [x] Perform no further implementation work on the archived v6 branch.

## Phase 2 — Create the clean v1.1 product branch — COMPLETE

- [x] Create `feat/city-cost-methodology-v1-1` from `main`.
- [x] Carry across only this plan, the archived prior plan, and a concise v6 retrospective.
- [x] Record the live 121-city CSV hash as an invariant: `63b13a8774c66999c5f99aade671ca357f65b949`.
- [x] Add a guard proving v1.1 tooling cannot write or regenerate the live CSV.
- [x] Selectively port live provider/model discovery.
- [x] Selectively port provider-specific reasoning effort, including `max` where supported.
- [x] Preserve browser-only API-key handling.
- [x] Defer generic persistence/API provenance to the explicit Phase 4 boundary; no v6-specific helper was imported.
- [x] Selectively port deterministic country identity handling into the v1.1 planner boundary.
- [x] Do not import v5/v6 experiment data, source collectors, canaries, migration tooling, fitting scripts, or release validators.
- [x] Run the baseline inherited from `main` (typecheck, build, 144 tests, memory check).
- [x] Commit and push the clean v1.1 foundation (`f5db69b`).

## Phase 3 — Implement formula-preserving v1.1 — COMPLETE

- [x] Preserve `llm_prompt_new_cities_1.md` unchanged as the exact v1 rollback prompt.
- [x] Add a versioned v1.1 prompt requesting only the existing ten USD anchors, region, confidence, and comparable-city reasoning.
- [x] State honestly that values are holistic model estimates; do not claim live page inspection.
- [x] Exclude derived tiers and currency conversion from the model response.
- [x] Add a strict `CityCostV11AnchorResponse` schema requiring all ten anchors to be finite and positive.
- [x] Implement pure `materializeCityCostV11`.
- [x] Copy every current v1 formula exactly, including `accom_4_star = hotel_3star_2p × 1.80`.
- [x] Preserve every current planner field and direct drink input.
- [x] Perform arithmetic before currency conversion.
- [x] Round final daily/accommodation values to whole AUD and direct drink inputs to cents.
- [x] Initially load USD→AUD from the checked-in, source-attributed FX snapshot; superseded by the owner's 26 August
  decision to return a fresh RBA observation from the same generation call.
- [x] Persist FX ID, hash, rate, source, and as-of date in the materialization result for the Phase 4 adapter.
- [x] Keep conversion arithmetic server-side. As of 26 August, the LLM supplies only the dated source observation;
  the server validates, inverts when necessary, and fails closed without a valid recent RBA value.
- [x] Keep requested city identity and country metadata outside the pure materializer for the Phase 4 integration boundary.
- [x] Add deterministic formula, schema, prompt, selector, and live-CSV guard tests.
- [x] Commit and push the v1.1 materializer (`f72fb9b`).

## Phase 4 — Persistence, API, and UI integration — COMPLETE

- [x] Use requested city identity plus canonical country metadata for v1.1.
- [x] Eliminate the separate metadata LLM call for v1.1.
- [x] Fail without partial persistence on invalid anchors, unsupported country, missing FX, or provider failure.
- [x] Add `methodologyVersion: "v1.1"`.
- [x] Add estimate source `llm_city_generation_v1_1`.
- [x] Persist anchors, provider, model, reasoning effort, prompt version, formula version, FX provenance, request context, and confidence notes.
- [x] Persist `evidenceBasis: "holistic_model_estimate"`.
- [x] Do not fabricate source observations, evidence grades, or statistical intervals.
- [x] Add generic methodology provenance to `/api/estimates`.
- [x] Include direct drink input fields in the v1.1 source map so all persisted planner inputs have API-visible provenance.
- [x] Display v1.1 methodology, anchors, model, reasoning, and FX provenance on `/dataset`.
- [x] Preserve historical v1, v6.0, and v6.1 record readability without retaining an executable v6 generator.
- [x] Add `CITY_COST_METHODOLOGY_VERSION=v1|v1.1`.
- [x] Preserve exact legacy v1 generation when explicitly set to `v1`.
- [x] Make `CITY_COST_METHODOLOGY_V6=true` produce a clear configuration error and never activate v6.1.
- [x] Keep v1 as the temporary default until Phase 5 passes.
- [x] Add persistence, API-provenance, UI, selector, and rollback regressions.
- [x] Commit and push the integration phase (`2757c88`).

## Phase 5 — Verify and activate v1.1 for new cities — COMPLETE

- [x] Prove formula parity for identical anchors and FX.
- [x] Test formula and rounding boundaries through golden fixtures and the deterministic check.
- [x] Prove v1.1 makes one provider call and no separate metadata call; after the 26 August FX decision, that same
  call must use web search for current RBA FX while planner identity remains server-side.
- [x] Prove failed generation leaves no partial city or estimate through the pre-persistence adapter boundary.
- [x] Prove explicit `v1` still selects the historical prompt and path.
- [x] Prove historical v6 records remain readable through the generic provenance parser.
- [x] Prove the live CSV hash and all 121 rows remain unchanged (`0e273cef…`, checked by the deterministic command).
- [x] Run a user-key functional smoke for Tottori, Toowoomba, and Brno through Chrome on 26 August 2026.
- [x] Verify each smoke city has ten positive anchors, deterministic tiers, one LLM call, and complete persisted/UI
  provenance. Tottori retained its historical v6.1 row; Toowoomba and Brno were added as v1.1 rows.
- [x] Treat the smoke as operational validation only, not an accuracy benchmark.
- [x] Record the owner-approved activation under the 18 August smoke-deferral decision; the later 26 August smoke pass
  is recorded in Phase 7.
- [x] Make v1.1 the default for newly generated cities under the owner's explicit smoke-deferral decision; the deferred
  owner-key smoke was subsequently completed and no longer remains open.
- [x] Run the complete post-activation baseline: typecheck, build, 36 Vitest files / 161 tests, memory checks, and the
  deterministic v1.1 check.
- [x] Keep `CITY_COST_METHODOLOGY_VERSION=v1` as the immediate rollback.
- [x] Regenerate no existing city automatically.
- [x] Run TypeScript, build, tests, documentation checks, and the deterministic v1.1 check.
- [x] During the owner-directed smoke deferral, rerun the full baseline and verify the live CSV, archived refs, and
  tracked product branch without activating v1.1; the later local v5 copies were quarantined outside the repository.
- [x] Publish the current v1.1 handoff and loop with the owner-smoke procedure.
- [x] Make the full 19-field planner boundary explicit, including direct `drink_coffee` cent precision.
- [x] Add an automatic `npm run dev` guard for OneDrive reparse-point `.next` caches so a bad generated cache cannot
  make the local server appear hung.
- [x] Commit and push the v1.1 activation (14452b5; final completion pointer follows).

## Phase 6 — Final archival and bloat removal — COMPLETE

- [x] Make the v1.1 plan, handoff, and loop the only active city-cost workstream documents.
- [x] Confirm no v5/v6 experiment corpus or migration artifact entered the tracked clean product branch; the later local
  v5 working-tree copies were verified against the archive and quarantined outside the repository.
- [x] Retain only a concise summary of useful v6 findings and links to the archived branch/tag.
- [x] Preserve generic model discovery, reasoning controls, country identity, and persistence improvements.
- [x] Remove active references to v6 activation, Phase 11, staged migration, and pending holdouts; remaining mentions are explicit historical pointers or rollback guardrails.
- [x] Reduce the active verification baseline to shipping product checks and deterministic v1.1 checks.
- [x] Confirm the archived v6 branch and annotated tag are present locally and on origin; preserve them indefinitely.
- [x] Run the complete pre-activation baseline during the owner-directed smoke deferral.
- [x] Run the complete final baseline after owner-authorized v1.1 activation.
- [x] Confirm the branch is clean and pushed at the final completion checkpoint.
- [x] Mark the methodology plan complete; subsequent authenticated product validation is tracked separately in Phase 7.

## Phase 7A — Performance and runtime hardening — COMPLETE

The first authenticated browser pass found a product/runtime defect, not a methodology defect. `/settings` recovered
after a delay and `/estimates` rendered, but `/dataset` remained on its loading state during a 10-second navigation
window. The port-owning local Next process reached approximately 1.65 GB while navigating the core routes. Treat that
incident as the reason for this hardening phase; do not run keyed generation while the local runtime is unstable.

### 21 August 2026 checkpoint evidence

- The final `npm run build` passed and produced a deterministic standalone artifact. The existing handled `/api/export`
  dynamic-route diagnostic still appears during static-page generation.
- `npm start` owned port 3000 through PID `43316`. The process was stopped immediately after testing. Initial RSS was
  `59.6 MiB`; post-route steady RSS was `87.6 MiB`, below the documented `512 MiB` budget.
- Cold route readiness was `/` `2.714s`, `/plan` `27.5ms`, `/plan/compare` `52.3ms`, `/track` `32.7ms`, `/dataset`
  `56.7ms`, `/estimates` `54.2ms`, and `/settings` `44.5ms`. Warm readiness ranged from `55.8ms` to `325.1ms`;
  every route returned HTTP 200.
- `npm run performance:check` passed all seven route-shell checks: `27–106ms` and `26,826–26,852` bytes per shell.
- The complete post-hardening baseline passed: TypeScript, production build, 37 Vitest files / 171 tests, the memory
  mirror check, and `npm run methodology:v1.1:check`.
- The first corrected standalone attempt exposed and then fixed two startup defects: `.env.local` was not loaded by the
  direct standalone child, and Next standalone tracing omitted the Windows `argon2` native prebuild. Startup now loads
  Next environment configuration, traces the native prebuild, and lazy-loads argon2 so the first route stays within the
  5-second budget.
- The prior clean production process baseline was approximately `74 MB`; the app-off control had port 3000 closed, no
  app-owned Node server, total CPU around `6–8%`, disk near idle, and approximately `16.7 GB` RAM available.
- The exceptionally long resumed Codex/Windows Terminal session showed separate intermittent rendering bursts while the
  app was off; restarting Chrome helped substantially but did not eliminate all lag. This is recorded as an observed
  interactive-session source, not attributed to Next.js or the browser application.

- [x] Capture the reproducible cold/warm route-shell baseline for `/`, `/plan`, `/plan/compare`, `/track`, `/dataset`,
  `/estimates`, and `/settings`, including shell bytes and server RSS.
- [x] Make startup deterministic: distinguish the `npm run dev` recovery path from the standalone production path,
  fail with a clear actionable message when `.next` is absent, load the project environment, and document the smoke
  command as `npm run build` followed by `npm start`.
- [x] Bound initial planner and dataset/history DOM work: `/plan` renders at most 12 leg cards initially, `/dataset`
  renders at most 25 city rows and 20 history rows, while full in-memory data remains available for search, editing,
  generation history, and planner totals. Planner and dataset API views omit fields they do not need.
- [x] Add deterministic regression/performance coverage for lightweight API views, pagination/bounds, startup failure,
  route readiness, shell response budgets, and the 5-second / 512 MiB local budgets.
- [x] Stage `.next/static` and `public` beside the local standalone server, skip unchanged staging by build ID, and make
  the performance check fail when a rendered shell references a missing static asset.
- [x] Reuse one derived-leg/date index per dashboard request instead of re-deriving and sorting the itinerary for every
  expense and chart date. Fully warm dashboard API requests fell to `1.12–1.65s` from the earlier `6–21s` range.
- [x] Bound `/track` to 50 expenses per page while full filtered data continues to drive totals and bulk actions.
- [x] Capture authenticated API request durations/bytes and complete the read-only route/console pass in Chrome on the
  stable runtime. `/plan`, `/dataset`, and `/track` rendered 12, 25/20, and 50 initial rows/cards respectively; all app
  requests returned HTTP 200. Chrome-extension message-channel warnings were observed separately from application logs.
- [x] Repeat the remaining verification from a fresh Codex CLI session. Chrome control was restored after the owner
  approved a repository ownership repair; no browser storage, cookies, passwords, or provider keys were inspected.
- [x] Run the complete post-change baseline and update the handoff/log for this authenticated hardening checkpoint.
- [x] Bring fresh-server authenticated data readiness for `/` and `/track` within the 5-second local budget. Preserve
  complete-data calculations and record cold and warm evidence separately rather than hiding cold initialization cost.

### 25 August 2026 cold-readiness completion evidence

- Fresh standalone restarts and authenticated Chrome navigation put dashboard data readiness at `1.96s` and track data
  readiness at `4.03s`, both below the 5-second local budget. The earlier slower measurements remain recorded as the
  pre-repair/pre-pinning baseline rather than being overwritten.
- `/track` now requests a server-paged 50-row joined view while its response separately carries the exact full-filter
  expense count, included AUD total, and complete ID set used by delete-all. Focused regression coverage proves page
  slicing does not narrow those full-set values.
- The track-specific itinerary view returns only assignment labels and derived leg dates; it does not calculate or
  transfer planner costs and intercity transports that the expense screen never consumes.
- The process-cold expense response fell from `456,140` to `29,391` transferred bytes (`-93.6%`), and the itinerary
  response fell from `45,078` to `7,350` bytes (`-83.7%`). Chrome verified page 2 as rows 51–100 of 973, filter reset
  to page 1, and the empty Manual filter as exactly 0 expenses / AUD 0.
- The complete baseline passed: TypeScript, production build, 39 Vitest files / 177 tests, documentation memory check,
  and the deterministic v1.1 check. The known handled `/api/export` build diagnostic remains unchanged. The local
  production server was stopped after measurement.

### 25 August 2026 authenticated continuation evidence

- Chrome control was restored in the fresh CLI after the owner approved changing repository ownership from
  `Administrators` to the current Windows user. No browser storage, cookie value, password, or provider key was read.
- The authenticated `/plan` failure was traced to standalone client chunks returning HTTP 404. The local launcher now
  stages `.next/static` and `public` beside `server.js`, marks the staged build ID, and skips unchanged staging.
  `npm run performance:check` now validates every static asset referenced by the route shells.
- The final shell/static check passed all seven routes at `97–3697ms`, `26,826–26,852` bytes, and 12 referenced static
  assets. Final steady RSS was `103.8 MiB`, below the `512 MiB` budget; the test server was stopped afterward.
- Authenticated bounds passed in Chrome: `/plan` rendered 12 of 67 legs, `/dataset` rendered 25 city and 20 history
  rows, and `/track` rendered 50 of 973 expenses with pagination. `/plan/compare`, `/estimates`, and `/settings` also
  rendered; all observed application requests returned HTTP 200.
- Reusing one derived-leg/date resolver per dashboard request reduced fully warm API durations to `1.12–1.65s`.
  Dataset API durations were `1.47s` and `2.21s`; settings requests were `88–131ms`; the plan-comparison request was
  `74ms`. The first-server dashboard and track requests remain above the 5-second target and are the next work item.
- Chrome emitted intermittent extension message-channel errors during navigation. They were not accompanied by failed
  application requests or application exceptions and are recorded as browser-extension noise, not an app pass claim.
- The complete checkpoint baseline passed: TypeScript, production build, 38 Vitest files / 175 tests, documentation
  memory check, and `npm run methodology:v1.1:check`. The build emitted the existing handled `/api/export` diagnostic.

### 25 August 2026 verification rerun

- The current `main` and `origin/main` tips are both `40f3c65`; the archived v6 branch and annotated tag remain present
  locally and on `origin`.
- The current baseline passed: TypeScript, production build, 37 Vitest files / 171 tests, the memory mirror check, and
  `npm run methodology:v1.1:check`. The build emitted the existing handled `/api/export` dynamic-route diagnostic and
  exited successfully.
- The deterministic check again confirmed 19 planner fields, 121 live CSV rows across 58 countries, and live CSV
  SHA-256 `0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.
- `npm run performance:check` passed against a temporary `npm start`: all seven route shells returned HTTP 200, with
  the slowest cold shell at 2.892 seconds and shell sizes from 26,826 to 26,852 bytes. The temporary server was
  stopped afterward and port 3000 is closed. The check requires a running server; a standalone invocation without one
  is not an application result.
- No authenticated Chrome route/console pass or owner-key generation smoke was run; those remain open.

## Phase 7 — Functional webapp validation — TO DO

**Paused on 3 September 2026** while Phase 8 is the active workstream, so that only one phase is in progress. The
completed checks below remain accurate and stay marked `[x]`; the remaining authenticated route workflows are open.

This is a post-rollout product smoke, separate from the completed methodology baseline. Use an authenticated local
session and record the browser surface used. A route returning HTTP 200, a build passing, or a manually visible page
does not by itself prove the interaction works. Do not inspect, copy, log, or persist the owner's provider key.

**Owner-key generation evidence (26 August 2026):** Chrome generated Tottori, Toowoomba, and Brno with one OpenAI
Responses call each, `gpt-5.6-luna`, reasoning `max`, and a required web-search call for current RBA FX. Authenticated
`/api/estimates` cross-checks showed 10 positive anchors, 19 planner fields, complete v1.1 provenance, and RBA
25 August FX at `1.398601` AUD/USD for every active row. The final baseline passed: TypeScript, production build,
40 Vitest files / 180 tests, memory mirror, deterministic formula/FX checks, and unchanged live CSV hash
`0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`.

**Planner/model-picker evidence (26 August 2026):** The Add Itinerary Leg dialog now keeps Cancel, Add City, and Add
Leg together, gives the active and selected city options dark high-contrast treatments, and reveals all legs after
either existing-city or generated-city leg creation. Both city-generation surfaces show model suggestions in a
four-column desktop grid with a two-column narrow-screen fallback. Playwright verified the dialog actions and exact
selected-city color, and provider-specific mocked
discovery verified Anthropic and Google Gemini model selection plus Refresh Models resetting each provider default.
The browser suite now pins one hostname, development PIN, and NextAuth environment and waits for the credential
response, preventing unrelated local secrets or a hostname split from invalidating authentication. The checkpoint
baseline passed TypeScript, production build, 41 Vitest files / 184 tests, memory mirror, and deterministic v1.1 checks.

### Completed checks — COMPLETE

- [x] Fast-forward the complete v1.1 history into `main`, push it to origin, and pass the post-merge baseline:
  typecheck, production build, 36 Vitest files / 161 tests, memory mirror check, and deterministic v1.1 check.
- [x] Improve Add Itinerary Leg selection contrast and actions, reveal all legs after either city-add path, compact
  model suggestions into four desktop columns, and verify Anthropic/Google Gemini selection and Refresh Models behavior.
- [x] Define cumulative dashboard chart lines in the rendered legend and tooltip: actual spend, actual spend on legs
  still marked planned, planned estimate, and total trip budget; distinguish dashed estimates/budget from solid spend.
- [x] Align single-leg and bulk intercity transport model pickers with city generation: discovered model lists,
  four-column desktop layout, and Refresh Models resetting the selected provider default; verify Anthropic and Google.
- [x] Extend intercity transport estimation with the city-generation reasoning-effort selector, provider-native
  effort parameters, and full-width model grids across both transport and new-city surfaces; verify the OpenAI,
  Anthropic, and Gemini request mappings plus the focused browser geometry.
- [x] Support selecting multiple Wise CSV exports, parse each file independently into the existing import pipeline,
  and show a safe in-page error when the import endpoint returns non-JSON; verify preview and confirmation submission
  with two files.
- [x] Remove obsolete v1.1, v4, and v5 branch pointers only after proving their tips remain reachable from `main` or
  the protected v6 archive; preserve `feat/city-cost-methodology-v6` and
  `city-cost-v6.1-research-final-2026-08-18` locally and on origin.
- [x] Add new cities with a user-entered OpenAI key and verify the default path is methodology `v1.1`, source
  `llm_city_generation_v1_1`, and exactly one generation call containing the required current-FX web search.
- [x] For the generated cities, verify ten finite positive anchors and all 19 deterministic planner fields, including
  direct drink inputs, are available and usable when adding a planner leg.
- [x] Verify generated-city persistence survives reload and does not modify
  `data/reference/city_costs_app_aud.csv`.
- [x] Verify `/dataset` generation-history labelling shows methodology, source type, provider/model, reasoning effort,
  prompt and formula versions, FX snapshot/rate/as-of date, anchors, request context, confidence notes, and evidence
  basis without presenting modelled values as observed prices.
- [x] Cross-check the generated rows and labels through `/api/estimates`; confirm persisted database values and
  API provenance agree with `/dataset`.
- [x] Complete the separately deferred Tottori, Toowoomba, and Brno owner-key smoke and provenance checks from
  Phase 5.

### Remaining authenticated checks — TO DO

- [ ] Confirm `/`, `/plan`, `/plan/compare`, `/track`, `/dataset`, `/estimates`, and `/settings` render without
  unexpected console-visible or user-visible errors.
- [ ] Add a new trip leg in `/plan`, select its city, dates, accommodation, food, drink, and activity tiers, and save.
- [ ] Reload `/plan` and verify the new leg, selected tiers, traveller scaling, overrides, and calculated totals
  persist correctly.
- [ ] Add, edit, and remove an intercity transport item; verify transport stays separate from city-cost methodology
  and survives save/reload.
- [ ] Create or update a saved plan snapshot and verify `/plan/compare` shows consistent summary totals, cumulative
  series, country allocation, and category allocation.
- [ ] In `/dataset`, verify the city library/database table loads, existing and generated rows are distinguishable,
  labels and filters are understandable, and edit controls target the intended row.
- [ ] Exercise representative `/track` behavior: add, edit, tag, exclude/reinclude, reassign, and delete a manual
  expense, and verify planned-versus-actual views respond correctly.
- [ ] Verify settings changes that affect traveller count persist and rescale planner totals without rewriting city
  base costs.
- [ ] Exercise relevant empty, validation, provider-failure, and retry states; verify failures leave no partial city,
  estimate, leg, or expense records.
- [ ] Record defects with route, action, expected result, actual result, browser surface, and reproducible evidence;
  fix and rerun affected checks before marking this phase complete.

### Next-session implementation TODO — IN PROGRESS

- [x] Call transport LLMs concurrently for multiple legs.
  - When more than one destination leg is selected in the bulk transport dialog, dispatch one estimate request per
    city/leg concurrently instead of awaiting the current sequential loop.
  - Preserve each leg's route, dates, traveller count, provider, model, reasoning effort, allowed modes, and context;
    keep success/error state attached to the correct leg so one failed request does not hide the others.
  - Use bounded, provider-aware concurrency and confirm rate-limit behavior. Keep the single-leg path and the later
    apply step unchanged.
  - Acceptance: requests overlap for N selected legs, every response is matched to its city, partial failures remain
    visible, and no transport row is duplicated or applied to the wrong leg.
  - Verified by focused Vitest coverage (12 tests across the scheduler, transport adapter, and planner UI regression);
    the single-leg path and apply loop remain unchanged.

- [ ] Document and roughly test how transport costs are estimated.
  - Current pipeline, to verify against the implementation before testing:
    1. The authenticated route loads the origin and destination legs, travel date, city/country metadata, traveller
       count, allowed modes, reference date/booking context, and route facts such as same/different country or region.
    2. It sends those inputs through the frozen `llm_prompt_intercity_transport_1.md` contract, which asks for
       one-way, standard-adult costs for the supplied travellers, with explicit assumptions and source basis.
    3. The selected OpenAI, Anthropic, or Gemini adapter tries web-grounded estimation first (web search or Google
       Search where supported), passing the selected provider-native reasoning effort. The prompt asks for live
       pricing when available and conservative model knowledge when it is not; it does not call a paid fare API or
       apply a deterministic fare formula.
    4. If the browse call fails, the adapter makes a strict JSON, non-search fallback call and records the fallback
       reason. A missing key or provider failure fails the request rather than inventing a value.
    5. The server extracts and schema-validates JSON, keeps at most four genuinely plausible modes, removes duplicate
       modes, cleans labels/notes, and rounds each `total_aud` to whole AUD. The row draft cost must equal that total.
    6. The UI shows assumptions, confidence, source basis, notes, and any citations for review; the user chooses an
       option (or the bulk flow applies the selected top option), and only then is the transport row saved.
  - Accuracy smoke test for the next session: select a small fixed fixture of short/long, domestic/international
    routes with different plausible modes; record date, traveller count, search/fallback path, provider, model, and
    all returned options/assumptions/citations; compare one-way totals with same-assumption operator or aggregator
    quotes captured on the same day; report absolute and relative error, median/range, and notable outliers by route.
    Keep the check explicitly directional rather than a scientific benchmark, use mocked responses or saved quote
    fixtures for repeatability, and decide an initial tolerance plus whether more routes are needed.
  - [x] Documented the runtime pipeline, estimation boundary, provider grounding/fallback behavior, JSON validation,
    review/apply flow, and known limitations in `docs/product/transport-estimation.md`.
  - [x] Added `buildTransportAccuracyReport` with a four-route mocked adapter smoke and deterministic coverage for
    matched/missing modes, absolute and relative error, median/range summaries, provenance retention, and outlier
    flagging. The focused run passed 7 tests on 26 August 2026; the full suite passed 49 files / 214 tests, TypeScript
    passed, and the production build completed (with the existing handled `/api/export` dynamic-server diagnostic).
  - [x] Exercised one authenticated planner route end to end with OpenAI `gpt-5.6-luna` at Maximum effort; the
    corrected web-search path returned two review-only options with visible citations and no itinerary mutation.
  - [x] Performed one directional aggregator sanity check: the A$24 standard-coach option versus an independent
    two-seat redBus reference of A$19.76 produced A$4.24 absolute / 21.4% relative error, inside a provisional 25%
    tolerance. This is not a calibrated benchmark because the route date is historical and the sample is one route.
  - [ ] Capture same-day operator/aggregator quotes under the same route, date, traveller-count, mode, and fare
    assumptions; run the directional report and decide whether the initial tolerance or route set needs adjustment.
    Synthetic fixtures remain explicitly excluded from accuracy claims.

- [x] Add an opt-in API-key save checkbox everywhere an LLM key is entered.
  - Add the same clearly labelled checkbox to every OpenAI, Anthropic, and Gemini key input, including city-cost and
    single/bulk transport dialogs. Persist a key only in the browser when the user opts in; clearing the checkbox or
    removing the key must clear the stored value. Never send keys to logs, the repository, or the database.
  - Acceptance: the choice and key behavior are consistent across all provider inputs, and a fresh unchecked input
    does not silently restore a previously saved key.
  - Verified across city generation, planner import, and single/bulk transport inputs with shared storage utility tests,
    focused UI-source coverage, and TypeScript validation.

- [x] Place reasoning effort beside the model picker.
  - In both transport-estimate dialogs and both city-cost estimate dialogs, put the reasoning-effort control next to
    the model picker at desktop widths, with a sensible stacked layout on narrow screens. Preserve the four-column
    full-width model grid and provider-specific supported-effort behavior.
  - Acceptance: the two controls remain visually associated for every provider, are usable at narrow widths, and the
    selected effort still reaches the correct provider request.
  - Verified by focused UI-source coverage for all four city/transport dialogs, provider request mapping tests for
    OpenAI, Anthropic, and Gemini, and TypeScript validation.

- [x] Keep repeated dashboard country visits as separate chronological rows.
  - Change Country Comparison grouping to coalesce only uninterrupted consecutive itinerary legs with the same
    country. If the itinerary leaves a country and later returns, emit a second row at the later position instead of
    merging totals across the trip; retain the existing totals and category calculations within each block.
  - Acceptance: `A, A, B, A` renders as `A, B, A` in itinerary order, while `A, A, B, B` remains `A, B`, with
    regression coverage for totals and repeated-country labels.
  - Implemented with itinerary-ordered country-block IDs; actual expenses follow their resolved leg block, and
    unmatched actuals remain appended as country/unassigned rows. Focused country-block totals/order tests and
    TypeScript validation pass.

## Phase 8 — Webapp performance remediation — IN PROGRESS

The owner reported the app as extremely slow. Investigation on 3 September 2026 found the Phase 7A evidence invalid
and produced a corrected authenticated baseline.

### Corrected evidence (3 September 2026)

Measured authenticated as `dev-local-user`, the owner of all 1,300 expenses, 62 legs and 62 saved plans.

- `scripts/check-webapp-performance.mjs:34` fetches with `redirect: 'follow'` and no session cookie. Every route 307s
  to `/login?callbackUrl=…` and the script never inspects `response.redirected`, so all seven recorded route numbers
  describe the login page. The 26-byte spread across seven "different" page sizes at `PLAN.md:207` is the length delta
  of the `callbackUrl` value.
- Development serves **14.04 MB** of JavaScript for `/` (10.14 / 9.48 / 9.18 MB for `/plan`, `/dataset`, `/track`).
  The equivalent production first-load JS is **263 kB / 177 kB / 154 kB / 146 kB** — a 53–63× difference.
- Route documents are ~28–30 KB empty shells with no server-rendered data. `/estimates`, the only server-rendered
  page, ships 174 KB of real content.
- Warm API latency is **13–82 ms**, so server compute is not the bottleneck at current data volumes.
- Observed in the owner's own session: six dashboard requests all completed within 46 ms of each other after
  **~7,005 ms**. They did not each perform 7 s of work; they blocked on one shared resource and released together.
  This is the synchronous module-scope migration block in `src/db/index.ts` (≈465 lines before `export const db` on
  line 486) plus the argon2 native module loaded transitively through `src/lib/auth.ts`.
- Payload waste: `/api/countries` returns 166,194 bytes where `?includeCities=false` returns 5,508;
  `/api/estimates?view=dataset` returns 434,234 bytes largely discarded by the client; unpaginated `/api/expenses`
  returns 613,933 bytes.
- Duplicate requests in the dev log are React StrictMode's dev-only double-invoke, not a defect.
  `src/app/page.tsx:630` is a single `useEffect` with `[]` deps. This must not be "fixed".
- The repository is at `C:\Dev\holiday-spend` and is **not** inside OneDrive. The OneDrive section of `CLAUDE.md` is
  obsolete. An orphaned pre-move copy remains at `C:\Users\chawi\OneDrive\projects\holiday-spend`.

### Step 0 — Get the webapp running and keep it running — COMPLETE

- [x] Separate development and production build directories (`.next-dev` vs `.next`) in `next.config.mjs`. They
  previously shared one directory and wiped each other, forcing full cold recompiles and surfacing as
  `ChunkLoadError: Loading chunk app/layout failed`. `scripts/prepare-next-dev.mjs` and `.gitignore` follow.
- [x] Set `NEXTAUTH_URL` in `.env.local`, clearing the repeated `[next-auth][warn][NEXTAUTH_URL]`.
- [x] Document the development-versus-production startup path in `CLAUDE.md`, including that `npm start` disables the
  development PIN and that all data belongs to `dev-local-user`.
- [x] Verified: a cold dev start writes only `.next-dev` and leaves `.next` untouched; a production build run while
  the dev server is live preserves both trees and the dev server keeps serving. Authenticated walk of `/`, `/plan`,
  `/plan/compare`, `/track`, `/dataset`, `/estimates`, `/settings` returned HTTP 200 for all seven.

Committed as `06f0120`.

### Step 1 — Attribute the ~7-second cold stall — COMPLETE (original premise disproved)

The stall was reproduced exactly and then attributed by direct in-process instrumentation. The planned remedy —
gating the `src/db/index.ts` migration block — would have recovered about five milliseconds and is therefore not
worth doing for performance.

Reproduction: a cold dev server whose readiness was polled over TCP only, so no HTTP request could warm a module,
served its first `/api/dashboard/summary` in **7,225 ms**, matching the owner's reported 7,005 ms. The second request
took 72 ms.

Temporary instrumentation inside `src/db/index.ts` and `src/lib/auth.ts` measured:

```
[perf] new Database():         5.5 ms
[perf] db migration block:     4.8 ms
✓ Compiled /api/dashboard/summary in 880 ms (925 modules)
GET /api/dashboard/summary 200 in 7225 ms
```

Independent probing confirmed SQLite is not involved: opening the database costs 3.9 ms, both pragmas 1.6 ms, the
first real query 0.1 ms, and counting all 1,300 expenses 0.1 ms. The migration block is idempotent and effectively
free.

With webpack compilation at 880 ms and database work at roughly 10 ms, the remaining ~6.3 seconds is Node
instantiating the route's 925-module graph, where development serves every module as a separate file read.

The dev-versus-production A/B on the identical cold request confirms it. `/login` is `force-dynamic` and calls
`getServerSession`, so it exercises the same auth and database module graph without needing a session:

| Cold first request to `/login` | Warm |
| --- | --- |
| `npm run dev` — **7.404 s** | 0.036 s |
| `npm start` — **2.659 s** | 0.305 s |

- [x] Reproduced the stall deterministically and attributed it by measurement rather than inference.
- [x] Established that the `src/db/index.ts` migration block costs 4.8 ms and is not a performance problem.
- [x] Ran `wal_checkpoint(TRUNCATE)`, reclaiming the 4.1 MB WAL to 0 bytes. Retain as a startup pragma in Step 6 for
  hygiene, not as a speedup.

**Superseded (3 September 2026):** the planned remedy of gating the `src/db/index.ts` migration block is dropped. The
cold stall is inherent to development mode and is fixed by running production, not by changing application code. This
made Step 5 the critical path rather than deferred work.

Two earlier figures in this investigation were measurement artifacts and are recorded here so they are not reused: a
1,734 ms "module load" was `tsx` compiling TypeScript, and an 830 ms "cold" dashboard reading came from a readiness
probe against `/login`, which imports auth and the database and so warmed what was being measured.

Committed as `2c13f48`.

### Step 2 — Fix the measurement harness — COMPLETE

- [x] `scripts/check-webapp-performance.mjs` signs in over the NextAuth credentials endpoint, using
  `WEBAPP_AUTH_PIN` against a dev server or `WEBAPP_AUTH_EMAIL` and `WEBAPP_AUTH_PASSWORD` against a production
  build, with a small cookie jar because Node's `fetch` does not persist cookies.
- [x] `assertNotRedirectedToLogin` fails whenever a response was redirected or lands on `/login`. It runs whether or
  not credentials are configured, because it is the assertion that makes every other number trustworthy.
- [x] Records decompressed JavaScript bytes per route, plus authenticated API latency and payload bytes.
- [x] Every route and endpoint is sampled `WEBAPP_SAMPLES` times (default 3) and reported as a median instead of a
  single reading.
- [x] `WEBAPP_REQUIRE_BUILD=false` allows the same harness to measure `npm run dev`.
- [x] Three regression tests added: routes redirecting to `/login` fail the check, the development mode runs without a
  production build, and repeated samples report a median. The suite is 49 files / 220 tests.

**Verified against the running app.** With credentials the check passes and reports the corrected baseline below. With
credentials removed — the exact configuration that produced the invalid Phase 7A numbers — all seven routes now report
`redirected to /login … would describe the login page, not the route` and the run exits 1.

### Corrected baseline (3 September 2026, authenticated production build)

| Route | Shell | JavaScript, decompressed | Files |
| --- | --- | --- | --- |
| `/` | 27,289 B | **1,068,839 B** | 15 |
| `/plan/compare` | 28,397 B | **1,015,023 B** | 14 |
| `/plan` | 27,943 B | 763,642 B | 17 |
| `/settings` | 27,594 B | 658,654 B | 16 |
| `/track` | 27,921 B | 653,380 B | 14 |
| `/dataset` | 27,734 B | 615,956 B | 15 |
| `/estimates` | 167,151 B | 518,309 B | 10 |

Route shells respond in 4-12 ms. Authenticated API medians: `/api/countries?includeCities=false` 3 ms / 5,508 B;
`/api/itinerary` 7 ms / 42,901 B; `/api/expenses?view=track` 10 ms / 29,947 B; `/api/dashboard/summary` 13 ms / 757 B;
`/api/dashboard/burn-rate` 15 ms / 79,776 B; `/api/estimates?view=dataset` 9 ms / 132,011 B.

Assets are gzipped but chunked with no `content-length`, so the figure recorded is the decompressed size — roughly
four times the transferred bytes, and the amount the engine actually parses. The budget is 1.25 MiB per route.

**New finding:** `/plan/compare` is the second-heaviest route at 1,015,023 B and had not appeared in any earlier
analysis. It carries the comparison charts. Worth including when the Recharts dynamic-import item in Step 4 is done.

### Step 3 — Payload and navigation — COMPLETE

- [x] `/settings` and `/track/add` now request `?includeCities=false`. Both read only scalar country fields, so the
  payload falls from **166,194 to 5,508 bytes** on each, a 96.7% reduction. `/plan` already used this variant.
- [x] `/api/estimates?view=dataset` no longer assembles 203 full rows, attaches history to each, and sorts them only
  to discard the result; the lightweight shape is built directly and the summary derives from the query rows so both
  views agree.
- [x] Heavy provenance blobs (`anchors`, `inputSnapshot`, `sources`, `fx`, `evidenceGrades`, `intervals`,
  `collectionTelemetry`, `missingness`) are no longer sent for every city and every history row. They accounted for
  **91%** of that response — 201,528 bytes across 203 rows plus 194,137 across 59 history rows — while the page renders
  them for one selected city at a time. A new `?cityId=` mode serves the full record on demand (about 25 KB), and
  `/dataset` fetches it when a city is selected. `toListProvenance` names the retained scalar fields explicitly so a
  new blob field cannot silently start shipping in the list payload.
- [x] `/api/countries` groups cities with a `Map` instead of an O(71x203) filter per country.
- [x] Prefetch restored: `DesktopSidebar` and `MobileNav` use `next/link` instead of `router.push`, which had disabled
  Next's viewport prefetching for all nav items. The pending-state spinner is preserved.

Measured on a production build, authenticated:

| Payload | Before | After |
| --- | --- | --- |
| `/settings` and `/track/add` country fetch | 166,194 B | **5,508 B** |
| `/api/estimates?view=dataset` | 434,234 B | **132,011 B** |
| `/dataset` initial JSON total | 600,428 B | **298,205 B** |

The plan's sub-100 KB target for `/dataset` was **not** met and is not reachable this way: the remaining 166,194 bytes
are `/api/countries`, which supplies the dataset table itself. The page filters and sorts all rows client-side, so
trimming it further requires server-side search rather than a payload change. Recorded rather than quietly dropped.

Verification: 49 Vitest files / 217 tests pass, including three new route tests covering the slim list shape, the
`?cityId=` full-provenance mode, and an unknown city. TypeScript, the production build, the memory mirror and the
deterministic v1.1 check all pass; all seven core routes returned HTTP 200 authenticated.

Committed as `3c791ca`.

### Step 4 — Render hot paths — IN PROGRESS

Verified by `npx tsc --noEmit`, `npx next lint` (no warnings or errors), 49 Vitest files / 217 tests, and a
production build. The dashboard items below remain open, so the step is not complete.

The original entry estimated the `/plan` country-option cost as "~28,400 NFKD-normalise plus four-regex operations per
render". That estimate is superseded by direct measurement: 5.037 ms per render, recorded below.

- [x] Memoized `canonicalCountryOptions` in `src/app/plan/page.tsx`. It was rebuilt on every render, including every
  keystroke, at a measured **5.037 ms**, because `getSelectedCountryPreview` re-scanned every saved country for each
  of the 245 `KNOWN_COUNTRIES` and `findKnownCountryMetadata` runs `slugifyId` — an NFKD normalise plus four regex
  replaces — on every call. Each saved country is now resolved once into a `Set` of canonical ids, and the result is
  wrapped in `useMemo` keyed on `countries`. Measured **0.045 ms**, a **112x** improvement. Outputs were verified
  byte-identical between the old and new implementations before the change was kept.
- [x] Built one shared `cityOptions` array with `useMemo` in `src/app/plan/page.tsx` and passed it to every `LegCard`
  and the Add Leg dialog. Each of up to 12 leg cards previously built its own ~200-object array inline during render,
  which also handed `SearchableSelect` a new `options` identity every time and so permanently defeated the `useMemo`
  at `src/components/ui/searchable-select.tsx:44`, re-sorting ~200 options with `localeCompare` per card per render.
- [x] Loaded `TransportEstimateDialog` (675 lines) through `next/dynamic` and mounted it only after first open,
  latched so its state survives close and reopen. It was previously mounted unconditionally inside every leg card —
  roughly a dozen instances — for dialogs the user had not opened, each with its own hooks and a `localStorage` read.
- [x] Applied the same dynamic-import and mount-on-first-open treatment to `BulkTransportEstimateDialog` (785 lines)
  and `PlannerNewCityDialog` (516 lines) in `src/app/plan/page.tsx`, and to `CityGenerationPanel` (455 lines) and the
  dataset `PlannerNewCityDialog` in `src/app/dataset/page.tsx`. `CityGenerationPanel` already rendered only for a
  selected city, so it needed the bundle split rather than a mount gate.
- [x] Memoized the `legs.map(...)` array passed to `BulkTransportEstimateDialog`, which defeated that component's
  internal `useMemo` by identity in the same way `cityOptions` did.

First-load JavaScript after these splits, from the production build:

| Route | Before | After |
| --- | --- | --- |
| `/dataset` | 154 kB | **127 kB** |
| `/plan` | 177 kB | **169 kB** |
- [x] Memoized the dashboard derivation chain in `src/app/page.tsx`. `categoryChartData`, `barData`, `chartBurnData`,
  `staggeredCountryBands` and the cumulative maxima previously recomputed on every render, so toggling
  `showCountryDailySpend`, `categoryMode` or `expandedChart` re-mapped and re-sorted the whole category list, country
  list and burn series. These had to move above the loading early-return, because hooks cannot be called after a
  conditional return. `staggeredCountryBands` matters most: a new array each render re-ran
  `BurnCountryHeaderStrip`'s `useLayoutEffect`, which calls `getBoundingClientRect` per band and forces a synchronous
  layout during commit.
- [ ] Extract the three inline chart render functions in `src/app/page.tsx` — `renderCountryChart`,
  `renderCategoryChart`, `renderBurnChart` — into `React.memo` components. **Corrected rationale:** the earlier claim
  that calling them as functions makes Recharts rebuild and re-measure its subtree was overstated. React reconciles by
  element type, so the charts are not remounted. The real benefit is skipping the chart subtree entirely when
  unrelated state changes, which is now worthwhile precisely because the data arrays above are memoized and stable.
  Lower priority than originally recorded.
- [x] Applied `next/dynamic` to the three Recharts components on `/plan/compare`, behind fixed-height placeholders
  that reserve the same space so the layout does not shift. That route's decompressed JavaScript fell from
  **1,015,023 to 538,967 bytes**, a 47% reduction, and its first-load figure from 236 kB to **104 kB**.
- [ ] Deferred: the same split on `/`. Recharts is imported directly into `src/app/page.tsx` rather than through
  extracted components, so splitting it requires first extracting roughly 200 lines of chart JSX that closes over a
  dozen values — the same refactor as the `React.memo` item below, and the riskiest remaining change on a page whose
  correct rendering was only just verified in a browser.

  Note the interaction: splitting `/plan/compare` moved Recharts out of the shared chunk, so `/` now carries it alone
  and its route chunk grew from 26.4 kB to 147 kB while its first-load total barely moved (263 kB to 266 kB). The
  case for splitting `/` is that its charts cannot render until three API calls return, so the chart bundle could
  load in parallel with those fetches rather than before them. The case against is that they are core
  above-the-fold content, so the split trades a smaller initial bundle for a visible loading placeholder.
- [x] Ran the Step 4 baseline: `npx tsc --noEmit`, `npx next lint` (clean), 49 Vitest files / 217 tests, production
  build, and the memory mirror. Authenticated production walk returned HTTP 200 for all eleven routes.

**Browser verification (3 September 2026, Chrome, authenticated production build).** The gap recorded above is now
closed.

- `/` renders after hydration with no console messages at all. Both bar charts and the cumulative line chart draw:
  60 `.recharts-rectangle` nodes with non-zero widths across three `.recharts-bar` layers, plus three
  `.recharts-line` series. An earlier screenshot appeared to show empty charts; that was an artifact of downscaling a
  1709 px viewport to a 1400 px JPEG, which renders the 4 px-tall bars as almost nothing. The DOM was checked
  directly rather than trusting the image.
- `/plan` renders 62 legs with the 12-leg initial bound intact and no console errors.
- `BulkTransportEstimateDialog` opens correctly from its `next/dynamic` chunk on first click, reporting 61
  estimatable legs with 3 selected by default, which also confirms the memoized `bulkTransportLegs` prop.
- The Add Leg dialog opens and its city picker lists all **203** options in correct alphabetical order, confirming
  the shared `cityOptions` array and that `SearchableSelect` still sorts.
- `/dataset` renders with the provenance card populated, including the anchor grid and FX snapshot. The network trace
  shows exactly the intended two calls: `/api/estimates?view=dataset` for the slim list, then
  `/api/estimates?cityId=medellin` when a city is selected. This confirms the Step 3 on-demand provenance design end
  to end in the browser.

One pre-existing accessibility warning surfaced and is **not** caused by this work: `Missing 'Description' or
'aria-describedby={undefined}' for {DialogContent}`, a Radix warning about the dialog component itself. Worth fixing
separately.

### Step 5 — Production as the normal run mode — COMPLETE

Step 1 established that the cold stall is a development-mode cost. Production serves the same cold request in 2.659 s
against 7.404 s, and ships 263 kB of first-load JavaScript for `/` against 14.04 MB. Running production is therefore
the single largest available improvement, and this ownership question is the only thing preventing it.

All itinerary, expense and saved-plan rows belong to `dev-local-user`, and `claimLegacyDataForUser`
(`src/lib/user-data.ts:53-58`) adopts only `userId IS NULL` rows, so no other account inherits them.

The owner configured a development password of `1234`. Testing confirmed it authenticates in development and resolves
to `dev-local-user`, but it cannot reach production:

| | `npm run dev` | `npm start` |
| --- | --- | --- |
| `pin=1234` | HTTP 200, session `dev-local-user` | **HTTP 401, anonymous** |
| `/` | renders | 307 to `/login` |
| Development PIN field | rendered | not rendered |

Three conditions must hold before `dev-local-user` can sign in to a production build, and none currently do:

1. `src/lib/auth.ts:20` sets `devPin` to `undefined` when `NODE_ENV === 'production'`, so the PIN path does not exist
   there at all.
2. `user_passwords` has no row for `dev-local-user`, and `verifyEmailPasswordCredentials` returns `invalid` without
   one.
3. `dev-local-user.emailVerified` is `null`, and `src/lib/native-auth.ts` returns `unverified` in that case, so a
   password alone is still refused.

`1234` also cannot be the production password: `validatePasswordStrength` (`src/lib/password.ts`) requires at least
ten characters and rejects all-digit values.

- [x] Added `npm run auth:set-local-password` (`scripts/set-local-password.ts`). It prompts for a password with echo
  suppressed, never accepts one as an argument or environment variable so it cannot reach shell history or logs,
  reuses `hashPassword` and `validatePasswordStrength` from `src/lib/password.ts` rather than inventing a policy, and
  offers to mark the local address verified. It refuses to run under `NODE_ENV=production`, and refuses cleanly with
  no database write when no interactive terminal is present.
- [x] Under explicit owner authorization, a short local development credential was set directly for `dev-local-user`
  and the address was marked verified. This deliberately bypassed `validatePasswordStrength`, which rejects values
  under ten characters and all-digit values, and was done with a throwaway script deleted immediately afterwards. The
  credential exists only in the gitignored, untracked `data/travel.db`; no value was written to any tracked file, and
  the committed tool retains the strict policy for normal use.
- [x] Production sign-in confirmed end to end on a clean, uninstrumented build.

### Step 5 result — production is now usable

Signed in as `dev-local-user` against `npm start`, all seven core routes returned HTTP 200:

| Route | Time | Bytes |
| --- | --- | --- |
| `/` | 1.603 s (first request, includes warm-up) | 27,311 |
| `/plan` | 0.569 s | 27,885 |
| `/plan/compare` | 0.274 s | 28,342 |
| `/track` | 0.265 s | 27,940 |
| `/dataset` | 0.265 s | 27,931 |
| `/estimates` | 0.271 s | 167,096 |
| `/settings` | 0.239 s | 27,613 |

Authenticated API latency was 0.218-0.263 s across the three dashboard endpoints, `/api/itinerary` and the paginated
`/api/expenses`. Against development this replaces a 7.4-second cold start and 14.04 MB of JavaScript for `/` with a
1.6-second first request and 263 kB.

Two diagnostic notes. Earlier production sign-in attempts returned `CredentialsSignin` and created no rate-limit row;
a clean rebuild resolved it, so the cause was a stale standalone bundle rather than the credential, which verified
correctly against the stored hash throughout. And `emailPasswordEnabled` was wrongly suspected first: the login page
renders `hasEmailPassword` from the same flag and was rendering email and password fields, which already disproved
that hypothesis before instrumentation confirmed the flag was true.

Committed as `deb299c` (the interactive password tool) and `6227449` (the verified production run mode).

### Step 6 — Deferred cleanup — TO DO

- [ ] Indexes on `expenses(user_id, date)`, `expenses(leg_id)`, `itinerary_legs(user_id, sort_order)`,
  `itinerary_leg_transports(leg_id)`, `saved_plans(user_id)`, `cities(country_id)`, `city_estimates(city_id)`. The
  schema currently declares none, and with `foreign_keys=ON` every delete scans referencing tables. Record this as
  correctness and headroom, not as a speedup.
- [ ] Cache `tokenVersion` with a short TTL in `src/lib/auth.ts:228`.
- [ ] Server-render initial data for `/`, `/track`, `/dataset`, `/settings`, and consolidate the three dashboard
  endpoints behind one shared resolver — only if the Step 2 harness still shows a real gap.

### Step 7 — Test suite audit — COMPLETE (no tests removed; the premise was wrong)

The audit ran and removed **no tests**. Recording why, because the conclusion contradicts the plan that set it up.

**Method.** Rather than judging by name, module reachability was computed transitively from the real entry points
(`src/app`, `src/components`, `src/middleware.ts`). Sixteen of seventy `src/lib` modules are unreachable from the
running app, carrying roughly 2,400 lines of tests — apparently the retired v3/v4/v5 research the plan targeted.

**Why they stay.** Those modules are the readers of retained methodology evidence, not dead code. `data/reference/`
still holds `accommodation_property_panels_2026_2027.json` (1.9 MB), `accommodation_reference_windows_2026_2027.json`,
`city_cost_collection_batches.json`, `city_cost_pilot_enrichment.json`,
`hanoi_accommodation_classification_reconciliation_2026.json`, and 42 files under `observations/`. Each unreachable
module parses or validates part of that corpus, and its `npm run methodology:*` entry point still works —
`methodology:batches:validate` and `methodology:accommodation-windows:validate` were run and pass.
`CLAUDE.md` states directly: *"Do not move or rename files under `data/reference/` without updating their readers."*

So "unreachable from the app" was the wrong test for "useless". These modules are unreachable **by design**: they are
offline validators for evidence the project deliberately retains for audit and reproducibility. Deleting them would
have looked like decisive cleanup while orphaning 2.2 MB of retained evidence and breaking its audit path.

Two further exclusions: `city-cost-v1-1-guard` is the live-CSV guard behind `npm run methodology:v1.1:check`, which
the plan's own rules protect; and `transport-estimation-accuracy` is the harness for the still-deferred transport
accuracy task, so removing it would delete in-progress work.

**Quality check.** The suite contains no tautological assertions — no `expect(true).toBe(true)` or equivalent — and no
tests that merely restate the implementation. It is better written than the audit assumed.

- [x] Computed module reachability transitively rather than trusting file names.
- [x] Established that the retired-research tests guard retained evidence and must stay; validators re-run and pass.
- [x] Confirmed no tautological or framework-only tests exist.
- [x] Removed four dependencies that are declared but imported nowhere in the repository: `swr`, `date-fns`,
  `shadcn` (a scaffolding CLI listed as a runtime dependency) and `tw-animate-css` (absent from every stylesheet).
  Verified against `git grep` across the tree and against the lockfile, which showed each as a direct dependency with
  no dependents.
- [x] Removed `src/app/fonts/GeistMonoVF.woff` (67,864 bytes), referenced nowhere; only `GeistVF.woff` is loaded.
- [x] Renamed `tests/playwright/performance-bounds.spec.ts` to `render-bounds.spec.ts` and its describe block to
  `initial render bounds`. Its three tests assert row counts and never a duration; calling them "performance" implied
  a timing guarantee they never made, which matters more now that `npm run performance:check` measures timings for
  real. The tests themselves are sound and are kept.

Counts unchanged at 49 Vitest files / 220 tests, because nothing was removed from the suite. Verified with
TypeScript, `next lint`, a clean production build from an emptied `.next`, the memory mirror, and the deterministic
v1.1 check with the live CSV hash unchanged.

### Step 8 — Documentation — TO DO

- [x] Add the requested line verbatim to `CLAUDE.md` and mirror it into `AGENTS.md`.
- [ ] Replace the obsolete OneDrive section of `CLAUDE.md`; note the orphaned OneDrive copy; retire or shrink
  `scripts/prepare-next-dev.mjs`.

## Phase 9 — README for a public audience — COMPLETE

`README.md` should let a potential employer reading the repository cold understand what the app is, what problem it
solves, and what it looks like, before it asks them to install anything. The current file does not do that. It opens
with two sentences of description, then moves through the product model and stack into `.env` setup, `npm ci`,
`npm run db:seed` and `npm run dev` — developer setup occupies the middle of the document, above anything
product-facing. There are no screenshots and no `docs/images/` directory. There is no architecture summary and no
description of how city costs are actually derived, only a pointer to `/estimates` as a route name. `Useful Commands`
lists retired v3/v4/v5 research entry points (`methodology:pilot`, `methodology:batches:validate`,
`methodology:observations:validate`) and omits the active verification baseline, `npm run docs:check-memory` and
`npm run methodology:v1.1:check`. `npm run build && npm start` is listed as a bare command with no indication that it
is the normal way to run the app, and `NEXTAUTH_URL` is not mentioned. Nothing states that this is a private personal
project, so the sign-in flow reads as an invitation.

- [ ] Open with a jargon-free explanation of what the app is and the problem it solves — planning and tracking spend
  across a long multi-city trip — placed above the product model, stack and any setup instructions.
- [ ] Capture screenshots of the main routes: `/` (planned versus actual dashboard), `/plan` (planner), `/plan/compare`
  (plan comparison), `/track` (expense tracking) and `/dataset` (city-cost library). Do not reference any image until
  it exists.
- [ ] Store the captured images under `docs/images/` and reference them from `README.md` with relative paths.
- [ ] Add a short feature overview covering itinerary planning, budget modelling across accommodation, food, drinks and
  activities, planned-versus-actual tracking, Wise CSV import, and LLM-backed city-cost generation.
- [ ] Add a brief, honest technical section: the stack, how the app is put together, and the city-cost methodology in a
  few sentences, linking to the `/estimates` route and to `docs/product/`.
- [ ] Move developer setup below the product-facing content and correct it: install, `npm run dev` for editing code
  versus `npm run build && npm start` for using the app, the environment variables actually required (including
  `NEXTAUTH_URL`), and the active verification baseline from `CLAUDE.md`.
- [ ] Replace the `Useful Commands` block's retired research entry points with the commands a reader would actually
  run, keeping the baseline commands together.
- [ ] State plainly that this is a private personal project and that there is no public sign-up.
- [ ] Verify every relative link and image path in `README.md` resolves in the repository before marking this phase
  complete.

## Phase 10 — Expense CSV export — COMPLETE

- [x] Added an Export button to `/track`, alongside the existing Import. `/api/export?format=csv` already existed but
  was reachable only from Settings and always returned every expense.
- [x] `/api/export` now accepts the same filters as `/api/expenses` — `cat`, `source`, `from`, `to`, `leg`, `tag` — so
  a download matches the list on screen rather than silently returning everything. Settings passes no filters, so its
  full-trip export is unchanged.
- [x] The CSV resolves `city` and `country` from the expense's itinerary leg. Previously it emitted a bare `leg_id`,
  which meant the file could not be read in a spreadsheet without joining a second export.
- [x] URL building lives in `buildExpenseExportHref` (`src/lib/expense-track-page.ts`) rather than inline in the
  component, matching the module's existing pure-helper pattern, with four tests covering no filters, all filters,
  `'all'` treated as unset, and one-sided date ranges.

Verified against the production build with real data: an unfiltered export parsed to exactly 1,300 rows with zero
parse errors and a resolved city on every row, `cat=food` returned 88, and a ten-day range returned 61.

## Definition of done

- [x] The existing 121-city v1 CSV is unchanged.
- [x] v6.1 cannot be activated in the product.
- [x] v6.1 history remains available through its branch and immutable tag.
- [x] New cities default to one-call v1.1 generation.
- [x] v1.1 uses the exact v1 formulas with deterministic server-side arithmetic and FX.
- [x] Explicit v1 rollback remains operational.
- [x] All current planner fields remain supported.
- [x] Provider, model, reasoning, anchors, formula, and FX provenance survive persistence and UI display; focused API
  persistence regressions pass and the owner-key smoke is complete.
- [x] No holdout, new methodology collection, lived-spending benchmark, coefficient change, or existing-city migration occurred.
- [x] The tracked active product branch contains none of the v5/v6 experiment bloat; verified local copies are
  quarantined outside the repository and are not part of the branch.

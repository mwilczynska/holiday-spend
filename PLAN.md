# City Cost v1.1 — Restore the Simple, Effective Method

**Status:** Methodology complete; Phase 7A complete; Phase 7 in progress.

**Current phase:** Phase 7 — Functional webapp validation (in progress; remaining route workflows open).

**Branch:** `main` (v1.1 history merged and synchronized with `origin/main`; protected v6 archive retained)

**Last updated:** 26 August 2026

**Latest implementation checkpoint:** `d9673f0` — opt-in browser key saving, aligned model/effort controls,
chronological dashboard country blocks, and a four-route mocked transport-accuracy smoke pipeline.

**Latest plan checkpoint:** `d9673f0` — recorded the mocked smoke while keeping live same-day quote capture open.

**Next action:** Run the directional transport-estimation accuracy smoke using fixed route and quote fixtures, then
record the evidence and any initial tolerance decision.

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

## Phase 7 — Functional webapp validation — IN PROGRESS

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
  - Added `buildTransportAccuracyReport` with a four-route mocked adapter smoke and deterministic coverage for
    matched/missing modes, absolute and relative error, median/range summaries, provenance retention, and outlier
    flagging. Live same-day operator/aggregator quote capture is still pending; no observed fares are fabricated by the
    harness.

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

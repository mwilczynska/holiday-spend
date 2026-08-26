# City Cost v1.1 — current handoff

**As at 26 August 2026.** This is the current cold-start note for the v1.1 simplification workstream. The
authoritative checklist is [`PLAN.md`](../../../PLAN.md); this note names the exact next action and the constraints
that must remain visible during implementation.

## Current state

- The cleanup began from `main` at `40f3c65`, synchronized with `origin/main`; v1.1 history remains merged and
  synchronized with origin.
- v6/v6.1 research is rejected for product cutover and preserved on the archived
  `feat/city-cost-methodology-v6` branch at tag `city-cost-v6.1-research-final-2026-08-18`.
- v1.1 keeps all 19 planner tiers and the exact v1 formulas. One web-enabled call returns the existing ten USD
  anchors plus the latest dated RBA USD/AUD observation; server code validates/inverts the observation and performs
  all arithmetic and conversion. The checked-in July snapshot is retained only as reproducibility evidence.
- The owner-authorized default activation is committed in `14452b5`; explicit `CITY_COST_METHODOLOGY_VERSION=v1`
  remains the rollback. The smoke was deferred at activation and subsequently passed on 26 August 2026.
- The owner-key Tottori, Toowoomba, and Brno smoke passed through Chrome on 26 August 2026. Each active row uses
  `llm_city_generation_v1_1`, OpenAI `gpt-5.6-luna`, reasoning `max`, deterministic v1 formulas, and RBA FX dated
  25 August 2026 at approximately 1 USD = 1.40 AUD. Tottori retained its historical v6.1 row.
- The independent pre-activation and post-activation baselines passed. The archived v6 branch and annotated tag remain
  present locally and on origin, and the tracked product branch contains no retired experiment corpus. The three
  verified local v5 copies were moved to a named quarantine outside the repository; no v5 files remain untracked here.
- v1.1 persistence/API/UI provenance is implemented. v1.1 rows use `llm_city_generation_v1_1`; grades and statistical
  intervals are intentionally absent because these are holistic model estimates, not source observations.
- The historical deterministic verification checkpoint is complete: typecheck, build, 36 Vitest files / 160 tests,
  memory checks, and `npm run methodology:v1.1:check` pass; the post-activation run reported 36 files / 161 tests.
- The current post-hardening baseline passes: typecheck, production build, 39 Vitest files / 177 tests, the memory
  mirror check, and `npm run methodology:v1.1:check`.
- The complete 19-field boundary is explicit: 18 daily/accommodation derivations plus direct `drink_coffee` at cent
  precision; the materializer, API query, tests, and deterministic check cover it.
- v1.1 source maps now include the five direct drink inputs as well as the 18 derived planner fields; v1's historical
  source-map shape is unchanged.
- The live `data/reference/city_costs_app_aud.csv` is unchanged. Existing cities are not migrated. New cities now
  default to v1.1; explicit `CITY_COST_METHODOLOGY_VERSION=v1` remains the rollback.
- `npm run dev` now runs `scripts/prepare-next-dev.mjs`, which removes a OneDrive reparse-point `.next` cache before
  Next starts; it leaves an ordinary cache alone. This prevents the known high-CPU/hung-first-compilation failure.
- The first authenticated Phase 7 browser pass exposed a performance blocker: `/dataset` remained on its loading state
  during a 10-second navigation attempt, and the port-owning local Next process reached approximately 1.65 GB while
  core routes were exercised. `/settings` eventually rendered and `/estimates` rendered, so this is a bounded runtime/
  payload problem rather than a universal route failure. Do not run keyed generation until Phase 7A is complete.
- The Phase 7A checkpoints added planner/dataset API views, bounded planner, dataset/history, and expense rendering,
  deterministic standalone startup/static-asset checks, explicit production performance budgets, a reusable dashboard
  expense-leg resolver, and regression coverage. The local launcher now stages required standalone static/public assets
  and skips unchanged staging by build ID.
- Phase 7A is complete. Fresh standalone authenticated Chrome measurements put dashboard data readiness at `1.96s` and
  track data readiness at `4.03s`, both within the 5-second budget. `/track` now transfers one joined 50-row expense
  page plus exact full-filter totals/IDs, and requests a lightweight assignment-only itinerary view. Its cold expense
  payload fell from `456,140` to `29,391` bytes and itinerary from `45,078` to `7,350` bytes.
- On the final run, PID `43316` owned port 3000, cold `/` was 2.714s, all seven core routes returned HTTP 200, the
  route-shell check passed, and steady RSS was 87.6 MiB. The exact server PID was stopped immediately after testing.
- On 25 August 2026, the current baseline was rerun successfully: TypeScript, production build, 37 Vitest files / 171
  tests, the memory mirror check, and `npm run methodology:v1.1:check`. The build emitted the existing handled
  `/api/export` dynamic-route diagnostic and exited successfully.
- The deterministic check again confirmed 19 planner fields, 121 live CSV rows across 58 countries, and live CSV
  SHA-256 `0e273cef4b80c1ce39d467316888e4d40159fc4ff0d389f9e9203adb9fa0aee8`. `npm run performance:check` also passed
  against a temporary `npm start`; all seven route shells returned HTTP 200. The temporary server was stopped and
  port 3000 is closed. The later authenticated Chrome pass rendered all seven core routes and verified initial bounds of
  12 planner legs, 25/20 dataset rows, and 50 expense rows.

## Exact next action

Run the complete verification baseline, update the plan/log checkpoint, and commit and push the Luna/max,
standalone-prompt, and generation-time FX implementation. The city-generation smoke is complete; the remaining Phase 7
planner, saved-plan, tracking, settings, and failure-state workflows are separate open checks. Continue to avoid browser
storage, cookies, passwords, and provider keys.

The earlier browser/dev incident remains important evidence: the port-owning dev process reached approximately 1.65 GB
while `/dataset` was loading. A clean production process baseline was approximately 74 MB. The owner-reported app-off
control had port 3000 closed, no app-owned Node server, CPU around 6–8%, disk near idle, and roughly 16.7 GB RAM free.
The exceptionally long resumed Codex/Windows Terminal session separately showed intermittent rendering bursts while the
app was off; restarting Chrome helped substantially but did not remove all lag. Keep that interactive-session observation
separate from application performance attribution.

For development use `npm run dev`, which runs the OneDrive `.next` recovery guard. For a stable smoke use `npm run build`
followed by `npm start`; do not run keyed generation while the local runtime is unstable. The selector defaults new-city
generation to v1.1; use explicit `CITY_COST_METHODOLOGY_VERSION=v1.1` for the owner-key smoke if a local override is
present. The owner enters the provider key in the browser, and it must never be read, copied, logged, committed, or
stored by the agent.

For each city, verify through the UI and `/api/estimates` that:

1. all ten returned anchors are finite and positive;
2. deterministic tiers are present for all 19 planner fields;
3. exactly one city-generation provider call occurred, containing one required web search for current RBA FX and no
   separate metadata call;
4. the persisted source is `llm_city_generation_v1_1` and methodology is `v1.1`;
5. model, reasoning effort, prompt/formula versions, FX snapshot, anchors, request context, and confidence notes
   survive the API/UI provenance path;
6. the live CSV is untouched.

This is an operational boundary smoke, not an accuracy benchmark. It passed on 26 August 2026; do not interpret that
as validation of city-price accuracy or tune formulas/edit the live CSV from these three examples.

## Guardrails

- No holdout access, new methodology collection, benchmark, coefficient fitting, or accommodation refit.
- Do not bulk-migrate existing cities or replace/regenerate `data/reference/city_costs_app_aud.csv`.
- Do not reintroduce v6/v6.1 collectors, priors, staged migration artifacts, or search contracts.
- Provider keys remain browser-only. Generated values are model estimates and must not be described as observed prices.
- Update `PLAN.md` at task start/end and before every commit/push. Commit and push each sizeable checkpoint.

## Verification

Run `npm run performance:check` only after the built app is running with `npm start`; without a local server, its fetch
failures only mean the check had no target and do not indicate an application regression.

```text
npx tsc --noEmit
npm run build
npm test -- --run
npm run docs:check-memory
npm run methodology:v1.1:check
npm run performance:check
```

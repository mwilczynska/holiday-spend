# City Cost Methodology v6.1 — Coherent Library Migration

**Status:** Phase 7H lifecycle/evaluator repair and experiment 014 are complete; the active canary passed 20/20 and Phase 8 is in progress

**Owner decisions:** 10 August 2026 (reachable v6.1 design); 12 August 2026 (migrate the existing 121-city library; repair the failed canary before another run)
**Branch:** `feat/city-cost-methodology-v6`

This is the active implementation plan. It supersedes the unreachable all-19 independent-validation
objective in `docs/dev/plans/city-cost-methodology-v6.md` and the earlier recommendation to leave the
existing CSV indefinitely on v1. Historical v6.0 evidence and dated conclusions remain valid records and
must not be deleted or rewritten.

## 1. Decisions and finish line

Keep all **19 existing planner fields**. v6.1 uses a deliberately small production method:

- Expedia measures one 3-star accommodation level;
- BudgetYourTrip supplies three food and three activity daily-spend tiers;
- Numbeo supplies cappuccino and domestic draft beer;
- deterministic code applies the banked accommodation ladder, scales BYT values to two people and
  composes the remaining presets;
- every output carries an evidence basis, A/B/C/D grade, interval, source IDs and explicit fallback.

The owner has now approved migrating the existing 121-city library as part of this workstream. The final
state is one coherent v6.1 library for existing and newly generated cities, not an indefinite mixture of
v1 existing cities and v6.1 new cities.

The replacement principle remains:

> Measure source-native city/category spending where it is systematically published. Model the remaining
> product presets explicitly. Never present a preset or fallback as an observed city price.

Migration does not turn v6.1 into ground truth. It is a controlled refresh using a cheaper, reproducible
method with better provenance. The v1 comparison is an operational impact check, never a target to tune
against.

## 2. Banked work — preserve it

- The v6.1 three-call extractor/materializer behind `CITY_COST_METHODOLOGY_V6=true`.
- Explicit v1, historical v6.0 and v6.1 persistence/API/UI handling.
- The 25/25 deterministic development replay and generated v6.1 priors.
- The spent holdouts. No holdout is reopened, rescored or replaced for this migration.
- Expedia 3-star extraction and the Expedia-to-Booking multiplier `0.9361`.
- Accommodation development median APE: 3-star 8.27%, 4-star 13.12%, private 15.97%, 2-star
  16.74%, 1-star 21.49%, dorm 25.46%.
- The accommodation ladder and disclosures, including the private rollback.
- One direct → regional → global category-tier fallback, decoupled from the live CSV.
- Current 25-city direct category coverage after FX repair: accommodation 80%, food 96%, drinks 68%,
  activities 96%.
- The unchanged v1 CSV and flag-off path as the pre-cutover rollback baseline.

Do not refit accommodation, manufacture independent food/drink/activity validation or revive v5's
unreachable gates.

## 3. Frozen v6.1 production shape

| Call | Source | Extract | Maximum searches |
| --- | --- | --- | ---: |
| A | Expedia | one 3-star room level for two adults | 4 |
| B | BudgetYourTrip | food budget/mid/high and activity budget/mid/high, per person/day | 4 |
| C | Numbeo | cappuccino and domestic draft beer | 2 |

Total: **three calls and at most ten searches per city**. Production uses search snippets, no direct
page reads, no source account, no paid API and explicit source-level missingness.

The 19-tier derivation remains the shipped library implementation:

- six accommodation tiers use the calibrated Expedia anchor and banked ladder;
- `food_budget`, `food_mid_range` and `food_high_end` are twice the matching BYT per-person/day tier;
- `food_street_food = 0.5331 × food_budget`, grade D ±45%, as a compatibility preset;
- five drink tiers compose cappuccino, beer and a modelled cocktail; wine remains excluded;
- `activities_free = 0`; the other three activity tiers are twice the matching BYT daily tier.

Generated coefficients are the authority for numeric fitted relations. As at 12 August 2026,
`coefficients-v6.json` contains `cocktail_1 = 2.4838 × cappuccino_1`, n=14, grade C, interval ±64%.
The v6.1 manifest now declares that same contract and the release validator fails closed if the declaration
drifts from the generated artifact.

## 4. Evidence interpretation

- Accommodation has genuine development accuracy evidence and a spent conditional holdout result.
- BYT food and activities are source-backed product estimates, not independent validation truth.
- Drinks are source-priced behavioural presets without independent full-basket truth.
- Runtime ≥95% coverage is **unmeasured** and is now an operational SLO, not a claim that a 19/20 sample
  can establish statistically. The 25/25 fixture replay proves deterministic replay. The first attempted
  provider canary made zero provider calls and is a credential preflight failure, not 0% source coverage.
- The 25-city rollout preview is operational impact evidence only. Across 450 non-zero comparable
  city/tier rows, 82 lie above 2× or below 0.5× v1; `food_high_end` is above 2× v1 in 18/25 cities.
  Representative basket median changes are +36.65% budget, +11.53% mid-range and +31.90% high-end.
  These differences do not establish that v6.1 is wrong because v1 is not ground truth, but they make a
  staged migration and explicit review mandatory.

## 5. Completed phases

### Phases 1–5 — implementation and release hardening — **complete**

- Added v6.1 response contracts and three versioned source prompts.
- Implemented the deterministic 19-tier materializer and category fallback.
- Built generated priors and 25-city fixtures without reading the live CSV.
- Fixed v6.1 persistence, API and UI provenance while preserving v1 and v6.0 replay.
- Made release gates computed or explicitly external/unmeasured.
- Added SGD, TWD, ZAR and PEN to the frozen FX snapshot, taking drink direct coverage from 52% to 68%
  and prior exclusions from 34 rows to zero.
- Generated the read-only 25-city v1-versus-v6.1 rollout preview.

The earlier “complete for new cities; M4 separate” conclusion is superseded by the 12 August owner
decision. The implementation is banked; the library migration is not complete.

## 6. Active phases

### Phase 6 — reconcile the release contract — **complete 12 August 2026**

1. Reconciled `validation-manifest-v6-1.json`, the generated reports and active documentation with the
   generated cocktail coefficient (`2.4838`, n=14, ±64%).
2. Extended `scripts/validate-city-cost-v6-1-release.ts` so the manifest coefficient key, source anchor,
   value, grade, interval, authority and relation text are compared with generated coefficients. A stale
   declaration now fails `--check`; the negative regression was confirmed with the old `2.6`, ±75% values.
3. Superseded the generated report's “new-city-only ready” recommendation with the owner-approved sequence:
   controlled runtime canary → staged full-library migration → owner-reviewed cutover.
4. Regenerated the release validation and rollout artifacts through scripts without network calls.
5. The full baseline for this phase passed; the live CSV and holdouts were untouched.

### Phase 7 — repair and test the collection boundary

**Phase 7A complete 12 August 2026; Phase 7B attempted 12 August 2026 and failed its 19/20 gate. Experiment 010 remains immutable history.**

`data/reference/v6/experiments/010-v6-1-runtime-canary/` is retained unchanged as history. It made zero
provider calls because no server-side key was configured. More importantly, the audit found that the
ordinary JSON provider client used by city-cost collection does not enable provider web-search tools even
though all three prompts require search snippets. It also renders Expedia arrival and departure from the
same `referenceDate`, producing a zero-night window. Supplying a key would therefore not make the frozen
experiment a valid source canary.

Phase 7 is split into three evidence boundaries:

#### Phase 7A — fix the production collection contract

- Completed 12 August 2026. The v6.1 spine now uses the strict provider-search route shared with the
  instrumented transport adapters; it rejects a response without provider-observed search activity,
  records provider envelopes separately from parsed responses, preserves partial/error calls, and keeps
  per-source/provider telemetry. The ordinary JSON client remains available for v1 and transport's own
  documented fallback behaviour.
- The collection contract now carries distinct `arrivalDate`, `departureDate` and `referenceDate` values.
  The Expedia regression proves `2026-09-17` → `2026-09-18` is a one-night window.
- The pure canary evaluator and regression suite now enforce source-call cardinality, schema/city identity,
  source and city search ceilings, zero direct reads, retry limits, 19-tier completion, provenance equality,
  date integrity and the 30% all-prior artifact threshold.
- Anchors and input snapshots are now exposed through the API provenance parser so persistence/API checks can
  compare the complete record, not only grade/interval counts. Development materializations no longer embed
  duplicate unedited provider envelopes; those remain in collection experiment artifacts.
- Verification for this phase is recorded in the commit and includes the existing fixture regeneration. No
  provider call, holdout access or live CSV write occurred.

- Route all three v6.1 calls through a real search-enabled provider adapter, reusing the instrumented
  transport search adapters where practical rather than trusting model-reported searches.
- Pass distinct arrival and departure dates to Expedia and retain the one-night frozen window.
- Preserve every attempted call, raw provider response, provider-observed search telemetry, retry and error,
  including partial city failures.
- Make blocked/not-found source responses distinguishable from a source-complete city even though the
  materializer may still produce 19 grade-D fallback tiers.
- Extract and unit-test a pure canary evaluator. Enforce exactly three call records per city, per-source and
  per-city search ceilings, zero direct reads, the 30% artifact threshold and field-by-field provenance
  equality through persistence/API parsing.
- Keep raw collection artifacts out of the generated development materialization bundles unless the
  artifact explicitly needs them; avoid duplicating the same spine payload in every fixture.

Production users continue to supply their own provider key through the web app. Codex/ChatGPT session
authentication is not application provider authentication and must never be copied into the app.

#### Phase 7B — delegated 20-city operational canary

Experiment 011 was created from the registered 20-city frame, preregistered with the corrected hashes/window,
and run through delegated Stage A plus the real deterministic Stage B. It produced 17/20 complete cities, two
artifact candidates (10%, below the 30% ceiling), and failed the hard 19/20 completion gate. Dubai had city/country
identity drift in all three responses; Cape Town and Lima supplied schema-invalid null source metadata for blocked
measures. The exact result is retained in
`data/reference/v6/experiments/011-v6-1-delegated-operational-canary/results.json` and `verdict.md`.

Experiment 011 is immutable failed history. The owner has authorized exactly one corrected delegated canary after
the Phase 7D repairs below; do not mutate or rerun 010/011, tune coefficients, or start Phase 8 before that new
experiment passes its registered gates.

Create a fresh experiment after the Phase 7A fixes; do not mutate experiment 010. Reuse its representative
20-city frame, but freeze a valid one-night window and the corrected prompt/tooling hashes. Codex subagents
may perform Stage A under the exact production prompts and limits: search snippets only, exactly three
source calls, at most ten searches, zero direct page reads, unedited raw responses and explicit missingness.
Stage B must validate those responses and run the shipped `materializeCityCostV61`, persistence adapter and
API provenance parser.

The delegated canary passes only when at least 19/20 cities have three schema-valid call records and a
complete 19-tier deterministic bundle; all contract limits and provenance equality checks pass; and artifact
candidates affect no more than 30% of the batch. Report source-found, partial, blocked and fallback rates
separately. A city materialized entirely from priors is operationally available but is not source coverage
and counts as an artifact candidate for the batch-proportion rule.

This establishes search-contract feasibility and deterministic application behaviour. It is not labelled
as provider-runtime reliability or holdout accuracy.

#### Phase 7D — repair the delegated boundary exposed by experiment 011

Before experiment 012, make the following contract corrections and regression-test them against 011's exact
failure shapes:

- share one canonical country/city identity comparator between production collection and the canary evaluator;
- normalize null documentary fields only for non-observed measures, while retaining unedited raw responses;
- preserve all three response and telemetry records when one source response is invalid;
- accept Numbeo's exact canonical `Domestic Draft Beer (0.5 Liter)` or `Domestic Draft Beer (1 Pint)` row,
  with no unit conversion and no bottled/imported substitute;
- report attempted/valid/invalid calls, retries, source statuses, observed measures, grades, fallback categories,
  all-prior cities, artifact signatures and persistence/API equality;
- make completed experiment directories immutable and make the release validator consume an explicit hashed
  canary result artifact. Before 012, the generated release record must say 011 **failed 17/20**, not pending.

The repeated canonical-beer rejection in more than 30% of a batch is an artifact signature and fails the canary
even if the materializer can produce finite fallback tiers. These repairs change no coefficient or accommodation
fit and do not reopen a holdout.

#### Phase 7E — one fresh corrected delegated canary — **failed 12 August 2026; immutable**

Create experiment 012, using the registered 20-city frame, corrected prompt/implementation hashes, the 17–18
September 2026 one-night window, exactly three calls, 4/4/2 source search ceilings, ten searches per city and
zero direct page reads. Codex subagents may supply Stage A; Stage B must use the shipped schemas,
`materializeCityCostV61`, persistence adapter, API provenance parser and pure evaluator. Retain one raw response
and telemetry record per city/source. Pass requires at least 19/20 complete cities and no more than 30% artifact
candidates. If either gate fails, commit the immutable result and stop; if it passes, update the manifest from its
hashed result and proceed to Phase 8. Do not claim delegated success proves the post-release runtime SLO.

#### Phase 7F — resumable collection lifecycle — **complete 12 August 2026**

Phase 7F corrected the orchestration defect exposed by experiment 012 without mutating that experiment:

- every registered city/source slot is inspected independently, preserving raw-only, telemetry-only, invalid,
  terminal-error and absent states;
- inventory reports pending, terminal, reusable, invalid, orphan, actual-call, retry, search and direct-read counts;
- finalization refuses to write an immutable result while any registered call slot is pending;
- incomplete source evidence is never converted into source-level `not_found`, and missing slots are not artifact
  candidates;
- canary output now includes call-frame, source/category fallback, grade, all-prior and provenance round-trip
  accounting;
- regression fixtures cover Lisbon/Prague partial pairs, Colombo/Dubai raw-only evidence, an absent city and an
  invalid response surrounded by valid siblings.

Experiment 012 remains immutable incomplete-frame evidence. Its original 10/20 result is not promoted to a clean
canary result; independent inventory finds 32 reusable raw+telemetry pairs and 28 pending slots. Experiment 013 is
the next authorized action, but it was not created or collected in this phase. Experiment 012 has no assignment ledger;
the inventory therefore reports assignment attempts as unrecorded while separating source-call records from provider
attempts.

#### Phase 7G — resumable delegated canary — **failed 12 August 2026; immutable**

Experiment 013 reused 32 independently validated experiment-012 raw/telemetry pairs and collected the remaining
28 registered slots. All 60 slots reached a terminal auditable state; 58 were reusable and two Prague slots were
invalidated after an unintended duplicate subagent assignment. The frozen result records 19/20 complete source
contracts, 20/20 deterministic 19-tier materializations and persistence/API round-trips, zero artifact candidates,
62 actual provider calls, 11 assignment attempts, two retries and zero direct page reads. The standard evaluator
reports 167 searches; `collection-incidents.json` records four searches from the overwritten first Prague attempt,
making the actual total 171.

The immutable result remains `pass: false`. Prague's BYT and Numbeo calls exceeded the call/search lifecycle
contract, and the evaluator also exposes an unreachable aggregate predicate: it requires
`problems.length === 0` even though the registered batch gate explicitly permits one incomplete city. Thus the
numeric 19/20 and 30% thresholds were met, but the recorded experiment did not pass. Do not restate it as a pass
or mutate it. Phase 7H is complete; the next canary and Phase 8 remain gated on the fresh immutable result.

The implemented repair adds an exclusive write-once call-slot claim before spawning work and separates per-city
diagnostics from batch-failing conditions in the evaluator. Experiment 014 subsequently reused the 58 valid
experiment-013 calls and recollected only the two invalid Prague sources. Experiment 013 remains immutable and is not
adjudicated or rescored.

#### Phase 7H — repair the canary lifecycle and batch decision — **complete 12 August 2026**

The post-013 audit separates two defects that must not be conflated:

1. The duplicate Prague assignment was a collection lifecycle defect. The assignment ledger only enforced unique
   assignment IDs; it did not reserve city/source slots before a delegated worker started. A thread-limit report could
   therefore arrive after a worker had already begun, and a later assignment could overwrite the same raw files.
2. `evaluateV61CanaryBatch` treated every per-city diagnostic as a batch-fatal problem through
   `problems.length === 0`. That contradicts the registered 19/20 rule: one terminal city may be incomplete while the
   batch still passes, provided global call/search/read/provenance gates and the 30% artifact threshold pass.

Phase 7H added an atomic write-once slot claim for new experiments and split tolerated per-city diagnostics from
true batch-fatal violations. Historical experiments 010–013 remain byte-for-byte immutable and are validated under
their recorded rules. Experiment 014 is the new immutable canary created after this repair; its 60-slot frame is
terminal/reusable, 20/20 cities are complete, zero artifact candidates were found and all persistence/API provenance
round-trips are field-identical. Phase 8 is therefore active.

#### Phase 7C — user-key provider transport smoke and runtime SLO

After the search-enabled adapter exists, retain a small 3–5-city end-to-end smoke using a user-supplied key
to test authentication, provider-specific search execution and the deployed database/API boundary. This is
external/manual until a key is supplied and does not block Phase 8 or Phase 9 staging. It must pass before
the Phase 11 cutover. Post-release complete-generation coverage is monitored against a ≥95% operational SLO;
a 19/20 pre-release sample must not be described as statistically proving that population rate.

### Phase 8 — build resumable migration tooling and a dry run — **active after experiment 014 pass**

Create a deterministic migration protocol under `data/reference/v6/migration-v6-1/` containing:

- a pre-registration and frozen city frame;
- SHA-256 of the input 121-city CSV;
- one frozen FX snapshot and one declared collection/reference window;
- raw response and telemetry files per city/source call;
- a checkpoint/status ledger so interrupted work resumes without recollecting completed calls;
- normalized spine bundles and deterministic 19-tier materializations;
- a staged CSV with exactly the existing schema and row identity;
- a provenance sidecar carrying methodology version, source facts, grades, intervals, missingness,
  telemetry, prior basis and input snapshot for every city;
- a deterministic seed/import path that writes that sidecar into `city_estimates` and links each seeded
  city through `cities.estimation_id` so existing-city provenance is visible at runtime;
- deterministic validation and `--check` regeneration.

The live CSV must not be used to derive v6.1 priors. Existing experiment 003/006 responses for 25 cities
may be reused only if each response validates against the current schema and conforms to the frozen
migration window/source policy; otherwise recollect it. Record reuse at the call level—never mix snapshots
silently.

Before any bulk collection, dry-run the pipeline on the canary and prove that it is resumable, idempotent
and cannot partially overwrite the live CSV. Commit and push the tooling.

### Phase 9 — collect and materialize the 121-city frame

Process fixed batches of 10–20 cities. For each batch:

1. collect or validly reuse the three schema-constrained spine responses;
2. validate source/search limits and explicit missingness;
3. materialize through the real `materializeCityCostV61` implementation;
4. update the checkpoint, staged CSV and provenance sidecar deterministically;
5. run batch substance checks and the verification baseline;
6. record coverage/fallback counts, commit and push.

The upper bound is 363 primary source calls and 1,210 searches. If all 25 existing fixture cities qualify
for reuse, 288 new calls remain. These are planning bounds, not a promise; the protocol must report actual
calls, retries, searches and reuses.

Delegated Codex subagents are the approved Stage-A route for development and migration when app-provider
credentials are unavailable. Every call must use the production prompt verbatim, retain an unedited raw
response and telemetry, and record `collectionMode`. Provider mode remains available for users supplying a
key. Stage B must always be the shipped deterministic materializer. No plausible substitute may be inserted
by the collector.

### Phase 10 — staged impact review and cutover decision

Generate, from the complete staged artifact:

- 121-city and 19-tier v1-versus-v6.1 differences;
- category subtotals and representative budget/mid/high daily baskets;
- median, p10/p90 and tail changes by tier and region;
- every >2× or <0.5× flag;
- ordering, non-negativity, duplicate, missing-row and schema checks;
- source-direct/fallback/grade distributions by category and region;
- ranking-change diagnostics and a list of all batch artifact candidates;
- the exact staged CSV and provenance hashes.

This report is not ground-truth validation. Do not tune v6.1 to resemble v1. **Stop for owner review
before replacing `data/reference/city_costs_app_aud.csv` or changing the default flag.**

### Phase 11 — atomic cutover and rollback — requires owner approval after Phase 10

After explicit approval:

1. replace the live CSV from the generated staged artifact—never by hand;
2. import the generated provenance sidecar into `city_estimates`, link `cities.estimation_id`, and update
   the seed/import source label from `base_csv_apr_2026` to a versioned v6.1 migration label;
3. prove `/api/estimates` and `/dataset` expose v6.1 grades, intervals and provenance for seeded existing
   cities, not only newly generated cities;
4. make v6.1 the coordinated default for newly generated cities;
5. retain the old CSV hash/artifact and v1 generation path as one documented rollback unit;
6. test seed/bootstrap, planning, comparison and generation provenance;
7. regenerate documentation and release artifacts, run the full baseline, commit and push.

Rollback must restore **both** the previous CSV and the v1 new-city default. Reverting only the feature
flag after migrating the CSV would recreate a mixed-method library and is not a complete rollback.

## 7. Definition of Done

The workstream is complete only when:

1. all contract declarations agree with generated coefficients and validator checks enforce that agreement;
2. the corrected 20-city delegated operational canary reaches at least 19/20 complete source contracts and
   proves the exact deterministic materialization/provenance round-trip;
3. the migration protocol is frozen, resumable, deterministic and independent of the live CSV;
4. all 121 existing cities have complete staged v6.1 values and provenance, or an explicit owner-approved
   exclusion that does not silently retain v1 values;
5. the full operational impact report has been reviewed by the owner;
6. the approved staged artifact atomically replaces the live CSV and its provenance sidecar is imported
   and linked for all seeded existing cities;
7. v6.1 is the consistent default for existing and new cities;
8. the coordinated v1 rollback is tested and documented;
9. no holdout was read or rescored and no accommodation coefficient was refit;
10. a user-key 3–5-city transport/database/API smoke passes before cutover, while ≥95% complete-generation
    coverage is explicitly monitored as a post-release operational SLO rather than claimed from 19/20;
11. the verification baseline passes, the tree is clean and the branch is pushed.

M5 improvements to weak individual tiers are not required for M4 unless the runtime canary reveals a
batch-level implementation artifact. They remain later evidence improvements.

## 8. Guardrails and stop rules

- Do not read, rescore, freeze or replace any holdout.
- Do not refit accommodation or tune any coefficient against v1.
- Do not add a fourth production source call or exceed ten searches per city.
- Do not use direct page reads in production collection.
- Do not derive priors from the current or staged shipping CSV.
- Do not hand-edit generated coefficients, priors, materializations, reports or the staged/live CSV.
- City-price collection is authorized only for the Phase 7 canary and Phase 9 migration under the frozen
  three-call contract.
- Preserve explicit source missingness; category priors are applied only by the materializer.
- Commit and push after each phase and each bulk batch.
- Stop on a delegated canary gate failure, a batch-level artifact signature affecting >30% of a batch, exhaustion of
  the declared source route, or before the Phase 11 cutover. Do not stop for individual outliers.
- Preserve historical v6.0 replay and all dated superseded conclusions.

## 9. Verification baseline

Run after every phase and migration batch:

```text
npx tsc --noEmit
npm run build
npm test -- --run
npm run docs:check-memory
node scripts/fit-city-cost-ladder-v6.mjs --check
node scripts/test-city-cost-v6-ground-truth-warnings.mjs
node scripts/validate-city-cost-v6-ground-truth.mjs --require-complete
node scripts/build-city-cost-v6-1-priors.mjs --check
node scripts/materialize-city-cost-v6-1-development.mjs --check
node scripts/validate-city-cost-v6-1-release.mjs --check
node scripts/generate-city-cost-v6-1-rollout-preview.mjs --check
node scripts/run-v6-1-delegated-canary.mjs --experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check
node scripts/inventory-v6-1-delegated-canary.mjs --experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check --summary
node scripts/reuse-v6-1-delegated-canary.mjs --target-experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check
node scripts/record-v6-1-canary-assignment.mjs --experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check
node scripts/test-v6-1-canary-assignment.mjs
```

Add migration-specific `--check` commands when Phase 8 creates them. If the full test suite fails, rerun
it once before investigating because this OneDrive checkout has a known transient temp-file failure.

## 10. Current stopping point — Phase 8 active after experiment 014 pass

Experiment 013 is finalized and immutable failed history. Experiment 014 is the authorized fresh canary: all 60 slots
are terminal/reusable, 20/20 cities completed, zero artifact candidates were found, 167 searches were recorded, and
all 20 persistence/API provenance round-trips were field-identical. The active manifest and generated release report
point to its hashed result. Phase 8 is now active. The exact next action is to create and dry-run the frozen,
resumable migration protocol under `data/reference/v6/migration-v6-1/` using experiment 014 as its fixture. Do not
read a holdout or touch the live CSV.

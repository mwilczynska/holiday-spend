# Holiday Spend

Canonical project memory. `AGENTS.md` must stay a byte-for-byte mirror — after editing this file run
`npm run docs:sync-memory`, and verify with `npm run docs:check-memory`.

**This file describes what the project is and how it currently works.** It is deliberately free of
change history.

| For | Read |
| --- | --- |
| What is planned next, milestone status, open decisions | **[PLAN.md](PLAN.md)** |
| What was built, what methodologies were tried and what they produced, dataset inventory | **[LOG.md](LOG.md)** |
| The active city cost methodology workstream | `docs/dev/plans/city-cost-methodology-v6-1.md` |
| How to resume that workstream cold | `docs/dev/handoffs/city-cost-v6.md` |
| Prior methodology evidence | `docs/product/methodology-v4.md`, `data/reference/v5/` |

---

## What the app is

A **private travel budget and spend-tracking app for long multi-city trips**, built for two travellers.

It combines itinerary planning by city and date, budget modelling across accommodation / food / drinks /
activities, manual and imported expense tracking, planned-vs-actual dashboards, and a city cost library
that can be edited by hand or generated for new cities with an LLM.

City base costs are stored **in AUD for 2 people** and scaled at runtime for the traveller group size and
the selected budget tiers.

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Planned vs actual across the trip and by country |
| `/plan` | Build the trip city-by-city — dates, tiers, overrides, intercity transport |
| `/plan/compare` | Compare saved plan snapshots side by side |
| `/track` | Record actual spend manually or by importing Wise CSV exports |
| `/dataset` | The city cost library — editor, planner-facing dataset, generation history |
| `/estimates` | Methodology documentation (currently describes v2.1/v3 — see PLAN.md) |
| `/settings`, `/settings/account` | Traveller count, display name, password, sign-in method |

---

## Aims and constraints

The city cost system exists to answer: *what will two people spend per day in this city?* Three
constraints shape every design decision:

1. **Accuracy needs to be reasonable, not exact.** Someone choosing between Lisbon and Copenhagen needs
   the right order of magnitude and the right ranking, not a quote.
2. **Refresh must be cheap.** Prices drift, and a method costing thousands of lookups per refresh will
   never be re-run. A stale dataset is worse than an approximate one.
3. **Users add cities on demand.** The 122nd city must cost roughly what each of the first 121 cost, not
   require a research programme.

Constraints 2 and 3 rule out approaches that are accurate but unrepeatable. **This is a cost-per-refresh
problem as much as an accuracy problem.**

**No paid data APIs.** Everything is a page fetch or a provider web search.

---

## Tech stack

Next.js 14 App Router · TypeScript · Tailwind · shadcn/Radix UI · Drizzle ORM + better-sqlite3 · Zod v4 ·
Recharts · NextAuth · Vitest + Playwright

---

## Project layout

| Path | Contents |
| --- | --- |
| repo root | App code |
| `docs/dev/plans/city-cost-methodology-v6-1.md` | **The active methodology workstream** |
| `LOOP-PROMPT-V6.md` | The autonomous work prompt for v6, including its stopping rules |
| `docs/product/methodology-v4.md` | Prior methodology evidence; not integrated |
| `docs/dev/plans/`, `docs/dev/handoffs/` | **Only current** workstream documents |
| `docs/prompts/` | Versioned LLM prompt contracts — see its `README.md` for status |
| `docs/ops/` | Deployment runbooks |
| `data/reference/` | Canonical datasets and methodology evidence — see its `README.md` for the inventory |
| `scripts/` | Tooling — see its `README.md`; about two thirds is v3 tooling kept for reproducibility |
| `*/archive/` | Superseded material, banner-marked. Nothing here describes current behaviour |
| `data/travel.db` | SQLite (gitignored) |
| `sample-data/`, `.local/` | Local imports, scratch files (gitignored) |

**Status convention.** Every archived document opens with a `> **SUPERSEDED**` / `**ABANDONED**` /
`**COMPLETE**` banner naming what replaced it. **A document with no banner is current.** Prompt files are
the exception — several are read verbatim and sent to a model, so their status lives in
`docs/prompts/README.md` rather than inside the files.

> **Do not move or rename anything under `data/reference/`** without updating its readers. Scripts and six
> Vitest test files reference those paths as string literals.

### Environment

- `AUTH_DEV_PIN` — optional local dev auth fallback
- `ENABLE_EMAIL_PASSWORD` — enables public email/password flows in dev without mail delivery
- `APP_URL` — builds absolute verification/reset links
- `RESEND_API_KEY`, `MAIL_FROM` — required for production email; without the key, dev logs links to console

---

## City cost system

### What ships today

The canonical dataset is **`data/reference/city_costs_app_aud.csv`** — 121 cities, 58 countries, AUD for
2 people, tagged `base_csv_apr_2026`. `src/db/seed.ts` imports it.

New cities use the **v1 path by default**: `docs/prompts/llm_prompt_new_cities_1.md` asks a model for ten
anchor prices and asserted multipliers derive 19 tiers. Setting `CITY_COST_METHODOLOGY_V6=true` switches
new-city generation to the v6.1 three-call extractor/materializer path; the flag remains opt-in while the
search-capable provider boundary, delegated operational canary and staged M4 library migration are completed.

> **Known defect, deliberately still shipping by default.** v1 anchors come from model memory rather than a live
> source, and its multipliers were never calibrated. `accom_4_star = hotel_3star × 1.80` has been
> measured and refuted — it overpredicts 14 of 16 tested cities with a median absolute error of 38.8%.
> The v6 replacement is integrated behind `CITY_COST_METHODOLOGY_V6=true`; the 121-city CSV remains on v1
> until M4.

### The v6 design boundary

Documented in full in `docs/product/methodology-v4.md`. v4 was never integrated, but its governing
principle is the basis of the active v6 workstream:

> **Measure what is systematic. Model the remaining product presets. Never disguise a model or fallback
> as observed evidence.**

Three properties behave differently: **level** is measured from a current source; **structure** is modelled
in deterministic code; **behavioural presets** express traveller choices rather than independently
observable market prices. Fitted relationships are preferred where useful evidence exists. A documented,
correctly graded product assumption is an acceptable completion state where it does not.

The second architectural rule: **the LLM is a structured extractor, never an estimator.** It searches,
reads, and reports numbers with their sources and an explicit basis. It does no arithmetic, no currency
conversion, and never emits a tier. All derivation is a pure server-side function.

**Determinism is achieved at three layers**, confining non-determinism to a single moment:

| Layer | Deterministic? | How |
| --- | --- | --- |
| Collection | No — bounded instead | Fixed versioned prompt, rigid schema, source/search ceiling and explicit missingness |
| Derivation | **Fully** | Pure function from anchors to 19 tiers, server-side |
| The dataset | **By persistence** | Anchors stored with provenance; a city never changes until a deliberate refresh |

**`docs/prompts/llm_prompt_city_anchors_v4.md` is generated from methodology-v4.md §9.1.** Never edit it
directly — edit the methodology and regenerate, or the two will drift.

### v5 — closed, and why it matters

**v5 ran 95 experiments and mapped zero product fields.** Its acceptance rule required evidence public
sources do not publish (explicit occupancy, tax basis and one-room wording in a single snippet) plus 30
matched cities per relationship, and it forbade shipping until those gates passed. All its evidence is
retained under `data/reference/v5/` and every experiment verdict is still accurate — only the acceptance
rule is superseded. **Do not re-run its experiments or reinstate its gates.** The full diagnosis is
`docs/dev/plans/city-cost-methodology-v6.md` §1, and the trap it teaches is recorded in `PLAN.md`:
*an unreachable gate is a defect in the gate, not a reason to collect more.*

### v6.1 — the active workstream

**13 August 2026 Phase 10.5 release hardening:** Phase 10 has completed the 121-city staged migration and impact
report; the artifact remains review-only. The non-live provenance importer now canonicalizes country aliases, prefers
the frozen city ID, rejects ambiguous identities and duplicate migration imports, and reuses matching rows on replay.
Its temporary-database rehearsal verifies 121 inserts, 121 idempotent reuses, API-visible v6.1 provenance, rollback
fidelity and an unchanged live CSV. `food_high_end` means `2 x` BudgetYourTrip's high/luxury daily food tier; its
large staged difference from v1 is a semantic impact finding, not a tuning target. The exact next action is the full
verification baseline, then the external 3-5-city user-key provider/database/API smoke and owner approval before
Phase 11. Holdouts, the live CSV and the global/default flag remain untouched.

**13 August 2026 Phase 9/10 completion:** The final Cairns batch completed the frozen migration frame at 121/121
cities. Phase 10 generated `data/reference/v6/migration-v6-1/impact-report.{json,md}`; it is an operational v1 versus
v6.1 comparison, not ground-truth validation. Budget, mid-range and high-end representative baskets are +26.0%,
+7.9% and +14.4% versus v1; food high-end is +126.0% with 69/121 >2x flags, and basket rank correlations are
0.8839/0.8960/0.8683. Two Cairns delegated assignments stalled and were closed without counting calls; a bounded
Codex search fallback produced the three retained raw/telemetry pairs. The exact next action is owner review of the
impact report before Phase 11. The live CSV, holdouts and global/default feature flag remain untouched.

**13 August 2026 status correction:** Phase 9 batch 010 is complete: 120/121 cities are staged and one city,
Cairns, remains for fixed delegated batch 011. Batch 010 materialized 10/10 cities with 30 calls, 100 searches,
zero retries/direct reads, zero artifact candidates, and direct coverage accommodation 7/10, food 8/10, drinks 0/10
and activities 8/10. This supersedes older 110/121 and batch-010-next wording below. The live CSV, holdouts and
Phase 11 remain untouched.

13 August 2026 status: experiment 014 passed 20/20, Phase 8 migration tooling is complete, and Phase 9 is
active. The frozen protocol and dry run are under `data/reference/v6/migration-v6-1/`; migration batches 001 through
007, 008 and 009 added 90 cities, so 110/121 are staged and 11 remain. Batches 001 and 002 each had one
all-prior candidate at 10%; batch 003 had two (Santa Fe (Bantayan) and Siargao, 20%); batch 004 had none; batch 005
had one (Aomori, 10%); batch 006 had one (Hong Kong, 10%); batch 007 had one (Porto, 10%); batch 008 had two (Berlin and Vienna, 20%); batch 009 had one (Reykjavik, 10%). All remain below the batch stop rule. Batch 004 had 0/10
direct drink categories, which is carried as an operational Phase 10 finding; batch 005 had 4/10, batch 006 had
2/10, batch 007 had 4/10, batch 008 had 1/10 and batch 009 had 1/10 direct drink categories. Two workers reported Budapest, but one assignment claim and
one final persisted raw/telemetry set exist; this is an orchestration incident, not an extra call. The next exact
action is fixed delegated batch 010. The live CSV and
holdouts remain untouched.

Phase 7F lifecycle repair is complete. Experiment 013 is now immutable failed evidence: 32 validated experiment-012
calls were reused, all 28 pending slots were collected, and the frame reached 60/60 terminal records with 19/20
complete cities. A duplicate Prague assignment invalidated two calls; the result remains failed even though the
numeric 19/20 and 30% thresholds were met. Phase 7H is complete: new experiments use write-once city/source slot
claims and the evaluator separates tolerated per-city diagnostics from batch-fatal failures. Experiment 014 then passed
the fresh immutable canary at 20/20 complete cities, zero artifact candidates, 60/60 terminal/reusable calls and full
persistence/API provenance equality. Phase 8 is complete and Phase 9 is active at 110/121 staged; batches 007–009
are complete and batch 010 is next.
The live CSV and holdouts remain untouched.

The v6.1 source contract, deterministic materializer, generated priors, 25-city fixture replay,
feature-flagged new-city path and persistence/API provenance boundary are implemented. The release
validator computes the measured gates, records runtime >=95% coverage as unmeasured, and records the
verification baseline as external evidence. Phase 4 FX coverage and the read-only rollout preview are
complete. On 12 August 2026 the owner approved M4 migration of the existing 121-city library; this
supersedes the preview's new-city-only recommendation. Phase 6 contract reconciliation is complete. The
first provider canary attempt made zero calls and is retained as a credential preflight; later attempts exposed
and repaired search, date, identity, missingness and partial-file lifecycle defects. Experiment 013 reached a full
frame but exposed an unguarded duplicate assignment and an aggregate evaluator predicate that is stricter than the
registered one-city tolerance. Phase 7H repair and its full baseline are complete. The active manifest now points to
the hashed experiment-014 pass. The exact next action is fixed delegated migration batch 010 through the completed
Phase 8 protocol; no holdout or live CSV access is authorized.
A small user-key provider smoke remains required before cutover; ≥95% runtime coverage is monitored as an operational
SLO.

v6.1 keeps all **19 existing planner tiers** and simplifies new-city generation to exactly three bounded
source calls: Expedia for a 3-star room, BudgetYourTrip for three food and three activity daily-spend tiers,
and Numbeo for cappuccino and domestic draft beer. Deterministic code applies the banked accommodation
ladder, doubles BYT's per-person/day values for the two-person product, composes the five drink presets, and
models street food and cocktail with disclosed coefficients. New collection is capped at ten searches and
zero direct page reads per city.

Every value carries **A** observed / **B** source proxy / **C** laddered / **D** fallback or compatibility
evidence, an interval and provenance. Missing category data uses one direct → regional → global tier-vector
fallback; it never reads or algebraically inverts the live CSV. Food and activities are BYT source-backed
product estimates, drinks are source-priced consumption presets, and none is described as independently
validated. The six accommodation tiers retain genuine development median APE from **8.27% to 25.46%**.

The active implementation and migration contract is `docs/dev/plans/city-cost-methodology-v6-1.md`; reachable gates are
in `data/reference/v6/validation-manifest-v6-1.json`; the loop is `LOOP-PROMPT-V6.md`; the cold-start handoff
is `docs/dev/handoffs/city-cost-v6.md`. Existing experiment 003 and 006 evidence supplies the 25-city
development fixtures. All holdouts are spent and remain closed. The live CSV and default new-city path are
still v1 until the staged M4 artifact is reviewed; migration collection is authorized only under the
frozen three-call contract. The intended finish is one coherent v6.1 library, with CSV and generation
default cut over or rolled back together. Because the CSV stores numbers only, the generated migration
sidecar must also be imported into `city_estimates` and linked from `cities.estimation_id`; otherwise
existing-city grades and intervals would not reach the API/UI.

### Transport is out of scope

Transport estimation was removed from the city cost methodology. The planner supports a manual
`transportOverride` and repeatable per-leg `intercityTransports`, plus a **separate** LLM-backed intercity
transport feature with its own prompt and provider adapters. City cost generation and methodology pages
must continue to treat transport as manual-only.

---

## LLM generation

Three providers: **OpenAI**, **Anthropic**, **Google Gemini**. Defaults are centralized in
`src/lib/city-generation-config.ts` (currently `gpt-5.4-mini`, `claude-sonnet-4-6`, `gemini-2.5-flash`).

**API keys entered in the UI are stored only in browser `localStorage`** — never in the repo or database.
Production users supply that key for new-city collection. Development and migration may use Codex subagents
for schema-constrained Stage A, then the shipped deterministic parser/materializer/persistence path for
Stage B. Codex session authentication is separate from application provider authentication and is never
forwarded into the web app. Model names are editable so a stale default cannot hard-block the UI.

**Model discovery runs three tiers:** live provider API (browser key, else server env key) → no-key
aggregator (OpenRouter, then models.dev) → generated curated snapshot at
`src/lib/data/curated-models.generated.json`, refreshed by `npm run models:refresh`.

Provider quirks already handled — OpenAI switches between `max_tokens` and `max_completion_tokens` by
model family; Gemini sets `thinkingBudget: 0` to reduce truncated JSON and surfaces a clearer truncation
error; aggregator fetches parse defensively so gateway HTML becomes a friendly warning rather than a raw
parse error.

---

## Product behaviour worth knowing

### Planner
Accommodation tiers run hostel dorm, private room, and 1–4 star; drinks tiers are none / light / moderate
/ heavy. Legs can be reordered and edited inline with date validation. Traveller count persists per user
in `user_preferences.planner_group_size`; **city base costs stay stored for 2 and are scaled at runtime**.
Saved plan snapshots live in the user-owned `saved_plans` table.

### Comparison
`/plan/compare` computes planned costs server-side from snapshot tier selections plus current city base
rates. **One canonical allocation engine backs summary totals, cumulative series, and country/category
groupings**, so all four reconcile by construction — this is a load-bearing invariant with test coverage,
not an incidental detail.

### Tracking
Expense CRUD, tagging, exclusion, reassignment, bulk operations. Wise CSV import handles both
transaction-history and balance-statement exports, repeated IDs, multiple date formats, and leg assignment
by date. **When an expense is manually assigned to a leg**, tracking UI keeps the original transaction date
visible but timeline calculations clamp the reporting date into the leg window.

### Dashboard
11 summary cards with info popovers explaining each calculation. Spend views are constrained to the trip
window rather than all historical account activity, and missing AUD conversions are excluded rather than
being treated as zero.

---

## Conventions

- **Commit and push after each sizeable chunk of work and after each milestone.**
- Record superseded decisions as superseded — mark and date them rather than deleting, so the reasoning
  that replaced them stays legible.
- Fail closed. An unsupported value stays missing rather than being filled with a plausible substitute.
- A modelled value must never be presentable as observed evidence. Materialized city-cost tiers carry
  `evidenceBasis`, `evidenceGrade`, `interval`, and `imputedMeasures` to enforce this.

### Verification baseline

```
npx tsc --noEmit          # expected to pass
npm run build             # expected to pass
npm test -- --run         # expected to pass
npm run docs:check-memory # AGENTS.md mirrors CLAUDE.md
node scripts/fit-city-cost-ladder-v6.mjs --check   # v6 coefficients match their evidence
node scripts/test-city-cost-v6-ground-truth-warnings.mjs # legacy warning replay tripwire
node scripts/validate-city-cost-v6-ground-truth.mjs --require-complete # zero errors and zero pending slots; warnings do not block
node scripts/build-city-cost-v6-1-priors.mjs --check
node scripts/materialize-city-cost-v6-1-development.mjs --check
node scripts/validate-city-cost-v6-1-release.mjs --check
node scripts/generate-city-cost-v6-1-rollout-preview.mjs --check
node scripts/generate-v6-1-migration-impact-report.mjs --check (only after all 121 staged rows exist)
node scripts/rehearse-city-cost-v6-1-cutover.mjs --check # non-live temporary database only
node scripts/run-v6-1-delegated-canary.mjs --experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check
node scripts/inventory-v6-1-delegated-canary.mjs --experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check --summary
node scripts/reuse-v6-1-delegated-canary.mjs --target-experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check
node scripts/record-v6-1-canary-assignment.mjs --experiment-dir data/reference/v6/experiments/013-v6-1-resumable-delegated-canary --check
node scripts/test-v6-1-canary-assignment.mjs
```

`/api/export` is dynamic because it reads request headers — this build note is expected.

---

## Gotchas

**The repo lives inside OneDrive.** Files On-Demand dehydrates idle files into cloud placeholders that
carry a reparse-point attribute. Node reports those as symlinks, so Next's `recursiveDelete` calls
`readlink()` on them and dies:

```
Error: EINVAL: invalid argument, readlink '...\.next\server\app\estimates'
```

`next dev` then exits 0 and looks like an app crash with no application code involved. Fix: delete
`.next`, then `attrib +P -U /s /d` at the repo root to pin everything local. The pin is a filesystem
attribute, not a repo setting, so a fresh clone or a OneDrive reset brings it back.

**UI component baseline.** Actively used components were rewritten onto Radix-style primitives rather than
relying on incompatible newer shadcn/base-ui output. Some unused shadcn v4-style files still exist and
should only be touched if those components are actually introduced.

**Database bootstrap.** `src/db/index.ts` performs runtime bootstrap/backfill for schema changes on older
local DBs, including derived itinerary leg dates and `itinerary_leg_transports`.

**Account linking.** Google and email/password accounts are **not** auto-linked on matching email. The
login page shows provider-specific guidance instead.

---

## Key files

| Path | Purpose |
| --- | --- |
| `docs/dev/plans/city-cost-methodology-v6-1.md` | Active v6.1 implementation plan and Definition of Done |
| `docs/dev/plans/city-cost-methodology-v6.md` | Historical v6.0 methodology and v5 diagnosis |
| `docs/dev/handoffs/city-cost-v6.md` | Cold-start handoff — names the exact next action |
| `data/reference/v6/validation-manifest-v6-1.json` | Active three-call source contract and reachable release gates |
| `data/reference/v6/` | v6 contracts, generated coefficients/priors and retained evidence |
| `data/reference/v6/ground-truth/` | M3 development ledger, per-measure holdout extension, one-time score files and lock marker |
| `scripts/validate-city-cost-v6-ground-truth.mjs` | Deterministic development-ledger audit; checks seal metadata but never reads holdout values |
| `scripts/fit-city-cost-ladder-v6.mjs` | Fits the v6 accommodation ladder and Booking/Expedia calibration; `--check` verifies determinism |
| `scripts/validate-city-cost-v6-1-release.mjs` | Reachable 25-city × 19-tier release validator/report generator |
| `scripts/generate-v6-1-migration-impact-report.mjs` | Complete staged 121-city v1-versus-v6.1 operational impact report; refuses incomplete staging |
| `scripts/inventory-v6-1-delegated-canary.mjs` | Independent per-call inventory; finalization remains closed while slots are pending |
| `data/reference/v6/v6-1-development-release-report.md` | Generated v6.1 development release report |
| `scripts/freeze-city-cost-v6-candidate.mjs` | Hashes the coefficients/offset/grade/interval candidate into the seal before holdout access |
| `scripts/score-city-cost-v6-holdout.mjs` | One-time gate 2–6 score against the frozen holdout; refuses a second pass |
| `scripts/score-city-cost-v6-holdout-all-tier.mjs` | One-time per-measure all-tier read; refuses old revealed measures and records explicit not_evaluable reasons |
| `docs/product/methodology-v4.md` | Prior methodology evidence; §9.1 is the v4 prompt's source of truth |
| `data/reference/city_costs_app_aud.csv` | The live 121-city dataset |
| `src/lib/city-generation-config.ts` | Provider/model defaults, migrations, validation |
| `src/lib/city-generation.ts`, `city-llm-client.ts` | v1 generation plus the v6 feature-flag switch |
| `src/lib/city-cost-methodology-v6.ts` | Deterministic v6 ladder, grades, intervals and regional priors |
| `src/lib/city-cost-v6-collection.ts` | Three v6 spine extractors, FX conversion, retry telemetry |
| `scripts/generate-v6-prediction-bundle.mjs` | Exact production-path prediction bundle generator for the development panel |
| `scripts/build-city-cost-v6-priors.mjs` | Generates direct-evidence regional/band priors without reading the live CSV |
| `scripts/score-v6-development-panel-in-sample.mjs` | Development-only prediction/truth scorer; labels blocked and in-sample results explicitly |
| `src/lib/provider-model-discovery.ts` | Three-tier model discovery |
| `src/lib/country-metadata.ts` | Canonical country resolution |
| `src/lib/plan-comparison.ts` | The canonical planned-allocation engine |
| `src/lib/city-cost-methodology-v3.ts` | `evidenceBasis`, FX, `money`/`quantile` helpers — candidates for v5 reuse |
| `src/lib/transport-estimation.ts` | Web-search wiring, prompt versioning, JSON parse fallbacks, retry |
| `src/lib/wise-csv-parser.ts`, `wise-import.ts` | Wise import |
| `scripts/fit-city-cost-ratios.mjs` | Deterministic ratio fitting — reproduces methodology-v4.md §6–§7 |
| `src/db/seed.ts`, `src/db/index.ts` | Seeding and runtime bootstrap |

# Holiday Spend

Canonical project memory. `AGENTS.md` must stay a byte-for-byte mirror — after editing this file run
`npm run docs:sync-memory`, and verify with `npm run docs:check-memory`.

**This file describes what the project is and how it currently works.** It is deliberately free of
change history.

| For | Read |
| --- | --- |
| What is planned next, milestone status, open decisions | **[PLAN.md](PLAN.md)** |
| What was built, what methodologies were tried and what they produced, dataset inventory | **[LOG.md](LOG.md)** |
| The active city cost methodology workstream | `docs/dev/plans/city-cost-methodology-v6.md` |
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
| `docs/dev/plans/city-cost-methodology-v6.md` | **The active methodology workstream** |
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
new-city generation to the v6 three-call extractor/materializer path; the flag is opt-in while M1 is being
validated.

> **Known defect, deliberately still shipping by default.** v1 anchors come from model memory rather than a live
> source, and its multipliers were never calibrated. `accom_4_star = hotel_3star × 1.80` has been
> measured and refuted — it overpredicts 14 of 16 tested cities with a median absolute error of 38.8%.
> The v6 replacement is integrated behind `CITY_COST_METHODOLOGY_V6=true`; the 121-city CSV remains on v1
> until M4.

### The design v6 executes (v4's principle)

Documented in full in `docs/product/methodology-v4.md`. v4 was never integrated, but its governing
principle is the basis of the active v6 workstream:

> **Measure what is cheap to measure. Model only the gaps. Never assert a constant.**

Three properties behave differently and must be treated differently — **level** drifts slowly and is
measured cheaply; **structure** (ratios between tiers) is very stable and is modelled from data; **drift**
is handled by re-measuring level and leaving structure alone.

The second architectural rule: **the LLM is a structured extractor, never an estimator.** It searches,
reads, and reports numbers with their sources and an explicit basis. It does no arithmetic, no currency
conversion, and never emits a tier. All derivation is a pure server-side function.

**Determinism is achieved at three layers**, confining non-determinism to a single moment:

| Layer | Deterministic? | How |
| --- | --- | --- |
| Collection | No — bounded instead | Fixed versioned prompt, rigid schema, hard validation gates, multi-sample median |
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

### v6 — the active workstream

When enabled, v6 measures one level per category (Numbeo food/drink, Expedia 3-star, BudgetYourTrip
activities), derives the rest from ratios fitted in `data/reference/v6/coefficients-v6.json`, and grades
every value **A** observed / **B** source proxy / **C** laddered / **D** regional prior, each with an interval.
Every field always produces a number; no number is ever presented as better-evidenced than it is. The v6
collector records source currency, missingness, bounded retries and per-call telemetry. Contracts are frozen
under `data/reference/v6/`; the loop is `LOOP-PROMPT-V6.md`; the cold-start document is
`docs/dev/handoffs/city-cost-v6.md`.
M3 was reopened by owner decision to fit and validate all 19 product tiers. The manifest-driven development
ledger now has 25 cities x 18 measures with 280 found rows and zero pending slots; the street-food relation
is independently audited; the initial reset note's generated 0.5 reasoned constant was superseded when the
minimum fitted-relation threshold. The original six-measure holdout and the later 18-measure extension are
spent; all 18 measures are `revealed_once` and must not be reopened. The exact production prediction-bundle
generator exists, but its initial provider-mode run materialized 0/25 cities because no local provider credential was
configured. BYT tier evidence and an Expatistan drink cross-check are recorded for development, while
activity evidence remains circular when sourced from BYT. The development scorer is therefore correctly
blocked until predictions exist; the current paired development score is recorded separately. A fresh 15-city proposal is page-verified and coverage-gated at 72/90 rows;
it awaits owner approval. The 121-city CSV remains on v1 until M4.

**Current M3 pairing result (10 August 2026).** Experiment 006 now supplies 75 delegated, schema-validated
spine responses and 75 telemetry records for the 25-city development panel, reusing 15 Expedia responses
byte-for-byte from experiment 001. The default generator runs those responses through the real
`materializeCityCostV6` implementation and produces 25/25 full 19-tier bundles. The development score is
explicitly IN-SAMPLE: 10 evaluable tiers, one definitional tier and 8 blocked tiers. Gates 3–6 are
`not_evaluable` because the independent development truth is not a complete daily basket. The street-food
coefficient is the measured paired `k=0.3248` with grade C and a ±336% LOO-p90 interval; the former 0.5
reasoned constant is superseded. `priors-v6.json` records all 34 frozen-FX exclusions. The spent holdout and
the proposed fresh holdout remain untouched; owner approval is required before any new holdout action.

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
Model names are editable so a stale default cannot hard-block the UI.

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
npm test -- --run         # 153 tests
npm run docs:check-memory # AGENTS.md mirrors CLAUDE.md
node scripts/fit-city-cost-ladder-v6.mjs --check   # v6 coefficients match their evidence
node scripts/test-city-cost-v6-ground-truth-warnings.mjs # legacy warning replay tripwire
node scripts/validate-city-cost-v6-ground-truth.mjs --require-complete # zero errors and zero pending slots; warnings do not block
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
| `docs/dev/plans/city-cost-methodology-v6.md` | Active v6 methodology, the v5 diagnosis, milestones |
| `docs/dev/handoffs/city-cost-v6.md` | Cold-start handoff — names the exact next action |
| `data/reference/v6/` | Frozen v6 contracts: data dictionary, validation manifest, coefficients |
| `data/reference/v6/ground-truth/` | M3 development ledger, per-measure holdout extension, one-time score files and lock marker |
| `scripts/validate-city-cost-v6-ground-truth.mjs` | Deterministic development-ledger audit; checks seal metadata but never reads holdout values |
| `scripts/fit-city-cost-ladder-v6.mjs` | Fits the v6 accommodation ladder and Booking/Expedia calibration; `--check` verifies determinism |
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

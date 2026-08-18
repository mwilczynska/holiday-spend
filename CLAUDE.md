# Holiday Spend

Canonical project memory. `AGENTS.md` must stay a byte-for-byte mirror — after editing this file run
`npm run docs:sync-memory`, and verify with `npm run docs:check-memory`.

This file describes what the project is and currently does. It is deliberately free of change history.

| For | Read |
| --- | --- |
| What is planned next, milestone status, open decisions | **[PLAN.md](PLAN.md)** |
| What was built, what was tried, and what the evidence showed | **[LOG.md](LOG.md)** |
| Active city-cost implementation plan | **[PLAN.md](PLAN.md)** |
| Retired v6.1 research history | archived `feat/city-cost-methodology-v6` branch and tag `city-cost-v6.1-research-final-2026-08-18` |
| Prior methodology evidence | `docs/product/methodology-v4.md`, `data/reference/v5/` |

---

## What the app is

A private travel budget and spend-tracking app for long multi-city trips. It combines itinerary planning,
budget modelling across accommodation / food / drinks / activities, manual and imported expense tracking,
planned-vs-actual dashboards, and a city-cost library that can generate new cities with an LLM.

City base costs are stored in AUD for two people and scaled at runtime for traveller count and selected tiers.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Planned versus actual spending across the trip and by country |
| `/plan` | Build the trip city by city, including tiers, overrides and intercity transport |
| `/plan/compare` | Compare saved plan snapshots |
| `/track` | Record expenses manually or import Wise CSV exports |
| `/dataset` | City-cost library, editor, generation history and provenance |
| `/estimates` | Methodology documentation |
| `/settings`, `/settings/account` | Traveller and account settings |

## Aims and constraints

The city-cost system answers: *what will two people spend per day in this city?* Accuracy should be reasonable
and useful for trip decisions, refreshes must remain cheap, and users must be able to add a new city on demand.
There are no paid data APIs. Provider API keys entered in the UI remain in browser storage and are never written
to the repository or database.

## Tech stack and layout

Next.js 14 App Router · TypeScript · Tailwind · Radix/shadcn UI · Drizzle ORM + better-sqlite3 · Zod · Recharts ·
NextAuth · Vitest + Playwright.

| Path | Contents |
| --- | --- |
| `PLAN.md` | Active v1.1 city-cost plan and checklist |
| `LOG.md` | Append-mostly project and methodology history |
| `docs/prompts/` | Versioned LLM prompt contracts; status is recorded in its README |
| `data/reference/` | Canonical datasets and retained methodology evidence |
| `scripts/` | Build, validation, and reproducibility tooling |
| `src/lib/` | Production methodology, provider, persistence and planning code |
| `data/travel.db` | Local SQLite database; gitignored |

Archived documents open with a `SUPERSEDED`, `ABANDONED`, or `COMPLETE` banner. Do not move or rename files under
`data/reference/` without updating their readers.

## City-cost system

The live dataset is `data/reference/city_costs_app_aud.csv`: 121 cities, 58 countries, AUD for two people,
tagged `base_csv_apr_2026`. `src/db/seed.ts` imports it. Existing cities remain on v1 and are not bulk-migrated.

### v1 rollback path

The historical v1 prompt, `docs/prompts/llm_prompt_new_cities_1.md`, asks one model for ten intuitive USD anchors
and returns all derived tiers. Its formulas include the asserted accommodation, food, drink and activity rules,
including `accom_4_star = hotel_3star × 1.80`. That formula is known to be imperfect but remains unchanged for
the first v1.1 simplification so the lived product behavior is not silently altered.

### v1.1 active implementation target

The active plan in `PLAN.md` replaces the v6.1 source-heavy approach with a small v1.1 path for newly generated
cities only:

- one ordinary schema-constrained LLM call returns the same ten USD anchors;
- the LLM returns no derived tiers and no currency conversion;
- deterministic server code applies the exact v1 formulas and converts with the checked-in FX snapshot;
- anchors, provider/model, reasoning effort, prompt/formula versions, confidence and FX provenance are persisted;
- no grades or intervals are fabricated for holistic model estimates;
- v1 remains an explicit rollback through `CITY_COST_METHODOLOGY_VERSION=v1`;
- `CITY_COST_METHODOLOGY_V6=true` must never activate v6.1.

v1.1 does not rewrite the 121-city CSV, access a holdout, collect a methodology panel, fit coefficients, or
bulk-migrate existing cities. It becomes the default for new cities only after the checklist and functional smoke
pass.

### v6 and v6.1 research history

v6/v6.1 are rejected product approaches retained for audit and reproducibility on the archived
`feat/city-cost-methodology-v6` branch and immutable tag `city-cost-v6.1-research-final-2026-08-18`. This clean product
branch intentionally does not carry their implementation or experiment tree. Do not resume their collection, open
holdouts, import staged rows, run Phase 11, or enable their old three-call/search contract.

## Transport

Transport is outside city-cost methodology. The planner supports manual `transportOverride` and repeatable
`intercityTransports`, plus a separate LLM-backed intercity transport feature with its own prompt and provider
adapters. City-cost generation and methodology pages treat transport as manual-only.

## LLM generation and model discovery

The app supports OpenAI, Anthropic and Google Gemini. Defaults are centralized in
`src/lib/city-generation-config.ts`, but model names are editable so a stale default does not block generation.

Model discovery runs through live provider APIs when a browser/server key is available, then no-key aggregators,
then the generated curated snapshot at `src/lib/data/curated-models.generated.json`.

Provider/model-specific reasoning effort is selectable, persisted through generation, and passed to supported
provider transports. `max` is available when the selected provider/model advertises it. Application provider keys
are never accessed, copied, logged or stored by Codex.

## Product behavior

Accommodation tiers are hostel dorm, private room, and 1–4 star. Drinks are none, light, moderate and heavy.
Traveller count persists per user, while city base costs remain stored for two people. Saved plans store tier
choices rather than frozen city prices.

`/plan/compare` uses one canonical server-side allocation engine for summary totals, cumulative series and country
and category groupings. Manual transport remains separate.

Expense tracking supports CRUD, tagging, exclusion, reassignment, bulk operations, and Wise CSV imports. Dashboard
spending is constrained to the trip window and missing AUD conversions are excluded rather than treated as zero.

## Conventions and verification

- Commit and push after each sizeable chunk and milestone.
- Update `PLAN.md` at task start/end and before every commit or push.
- Record superseded decisions as dated history; do not erase reasoning.
- Fail closed. Unsupported values remain missing rather than becoming plausible substitutes.
- A modelled value must not be presented as an observed source price.
- Do not put provider API keys in the repository, logs or database.

The active baseline is:

```
npx tsc --noEmit
npm run build
npm test -- --run
npm run docs:check-memory
```

The v6-specific checks and experiments remain runnable only from the archived v6 branch for historical replay.

## OneDrive gotcha

The repository lives inside OneDrive. Files-On-Demand can make `.next` entries appear as reparse points and cause
Next cleanup failures. If that occurs, remove `.next` and pin the affected workspace files locally with the project’s
documented OneDrive attribute workaround. This is a filesystem issue, not application behavior.

## Key files

| Path | Purpose |
| --- | --- |
| `PLAN.md` | Active v1.1 implementation and rollout checklist |
| `docs/prompts/llm_prompt_new_cities_1.md` | Frozen v1 rollback prompt |
| `docs/prompts/llm_prompt_new_cities_v1_1.md` | Anchor-only v1.1 prompt; derived tiers and FX stay server-side |
| `src/lib/city-cost-methodology-v1-1.ts` | Pure v1.1 schema, frozen FX provenance and formula-preserving materializer |
| `src/lib/city-generation.ts` | v1/v1.1 generation dispatch and schema validation |
| `src/lib/city-generation-service.ts` | Estimate persistence and city updates |
| `src/lib/city-llm-client.ts` | Provider JSON-completion transports |
| `src/lib/provider-model-discovery.ts` | Provider model discovery |
| `src/lib/city-cost-v1-1-guard.ts` | Refuses any v1.1 output write targeting the live v1 CSV |
| `src/lib/country-metadata.ts` | Canonical country identity and defaults |
| `data/reference/city_costs_app_aud.csv` | Live 121-city v1 dataset |
| `feat/city-cost-methodology-v6` | Retained v6 research branch; not a current product path |

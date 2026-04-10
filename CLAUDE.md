# Wanderledger

## What The App Is
Wanderledger is a private travel budget and spend-tracking app for long multi-city trips.

It combines:
- itinerary planning by city and date
- budget modelling for accommodation, food, drinks, and activities
- manual and imported expense tracking
- planned-vs-actual dashboard views
- a city cost library that can be edited manually or generated for new cities with an LLM

The app stores base city costs in AUD for 2 people, then scales them at runtime for the traveller group size and selected budget tiers.

## Core Product Behaviour
- `/plan` builds the trip city-by-city with dates, tiers, overrides, and intercity transport
- `/track` records actual spend, either manually or by importing Wise CSV exports
- `/` compares planned vs actual spend across the trip and across countries
- `/settings/cities` manages the city cost library and runs new-city cost generation
- `/estimates` documents the current city-cost methodology, shows the dataset, and shows generation history

## Project Location
- App code: repo root
- Planning/docs assets: repo root
- Local sample imports: `sample-data/` (typically untracked)
- DB: `data/travel.db` (SQLite, gitignored)
- Dev PIN: `1234` in `.env.local`

## Tech Stack
- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- shadcn/Radix UI components
- Drizzle ORM + better-sqlite3
- Zod v4
- Recharts

## Important Implementation Notes

### UI Component Baseline
- Actively used UI components were rewritten onto Radix-style primitives rather than relying on incompatible newer shadcn/base-ui output
- The active component set is stable for current pages
- Some unused shadcn v4-style files still exist and should only be touched if those components are actually introduced

### Database And Runtime Bootstrap
- Primary DB is SQLite at `data/travel.db`
- `src/db/index.ts` performs runtime bootstrap/backfill for schema changes on older local DBs
- `city_estimates` now stores richer generation metadata:
  - `prompt_version`
  - `anchors_json`
  - `metadata_json`
  - `sources_json`
  - `input_snapshot_json`
  - `fallback_log_json`

### Verification Baseline
- `npm run build` passes
- `npx tsc --noEmit` is expected to pass in the current state
- Existing build note remains: `/api/export` is dynamic because it uses `request.url`

## Current City Cost System

### Canonical Dataset
- Canonical base dataset is `city_costs_app_aud.csv`
- Dataset covers 121 cities across 58 countries
- App-facing values are AUD for 2 people
- Seed flow now imports the CSV rather than relying on the older smaller JSON-only city dataset

### Methodology Assets
- Methodology doc: `methodology.md`
- New-city prompt template: `llm_prompt_new_cities_1.md`
- `/estimates` now reflects this methodology rather than the older hybrid/Xotelo explanation

### Transport
- Transport estimation has been removed from the city methodology
- Planner still supports manual:
  - `transportOverride`
  - repeatable per-leg `intercityTransports`
- City cost generation and methodology pages should continue to treat transport as manual-only

## Current LLM Generation System

### Supported Providers
- OpenAI
- Anthropic
- Google Gemini

### Current Default Mid-Tier Models
- OpenAI: `gpt-5.4-mini`
- Anthropic: `claude-sonnet-4-6`
- Gemini: `gemini-2.5-flash`

### UI Behaviour
- `/settings/cities` includes provider selection, API key entry, model entry, reference date/context, and generation results
- API keys entered in the UI are stored only in browser `localStorage`
- Keys are not written to the repo or database
- Model names are editable so the UI is not hard-blocked by stale defaults

### Provider-Specific Reliability Fixes Already Applied
- OpenAI payload switches between `max_tokens` and `max_completion_tokens` depending on model family
- Gemini generation disables thinking with `thinkingBudget: 0` to reduce truncated JSON output
- Gemini now surfaces a clearer truncation error when it stops before finishing the JSON
- Provider/model defaults are centralized in `src/lib/city-generation-config.ts`
- Legacy stored browser defaults are migrated forward automatically

### Generation Output Handling
- Generated rows save:
  - provider
  - model
  - prompt version
  - confidence notes
  - anchors JSON
  - estimate history
- Drink unit prices shown in the editable city model are inferred from `anchors_usd` and converted to AUD using the implied AUD/USD rate from the generated tier outputs

## Planner / Tracking / Dashboard State

### Planner
- Accommodation tiers support hostel dorm, private room, and 1-star through 4-star
- Tier descriptions are explicit and planner helper copy explains category logic
- Country and city pickers are searchable
- Legs can be reordered, edited inline, and constrained by date validation
- Intercity transport is now a repeatable per-leg list rather than a single always-open field
- Planner supports saved snapshots plus JSON export/import for comparing alternate itineraries
- Traveller count is configurable in `/settings` and `/plan`, and persists in `app_settings.planner_group_size`
- City base costs remain stored for 2 travellers and are scaled at runtime in planner/dashboard calculations
- Planner totals and summaries are stable and current

### Expense Tracking
- Expense CRUD, tagging, exclusion, reassignment, and bulk operations are implemented
- Wise CSV import supports both:
  - transaction-history export
  - balance-statement export
- Wise import now handles repeated IDs, multiple date formats, better category inference, and itinerary leg assignment by date

### Dashboard
- Dashboard summary, country comparison, planned-vs-actual, and cumulative burn views are implemented
- Actual-spend handling was tightened so missing AUD conversions do not pollute totals
- Spend views are constrained to the trip window instead of entire historical account activity
- Summary cards now use clearer planned-vs-actual terminology and include info popovers that explain each calculation
- Dashboard header and summary now make the selected traveller count explicit
- Country comparison now includes planned/day and actual/day columns using each country's planned itinerary days

## Completed Work

### Phase 1: Core App Foundations
- [x] Next.js app scaffold, auth, layout shell, schema, DB setup
- [x] Itinerary builder with tiered budgeting and live totals
- [x] Fixed-cost management
- [x] Base dashboard navigation and summaries

### Phase 2: Expense Tracking
- [x] Expense CRUD
- [x] Quick-add spend logging
- [x] Tagging system
- [x] Wise CSV import and preview/confirm flow

### Phase 3: Dashboard And Comparison
- [x] Summary cards
- [x] Planned vs actual country comparison
- [x] Category charts
- [x] Cumulative spend/burn views

### Phase 4: Deploy / Export / Provider Plumbing
- [x] Docker and nginx deployment artifacts
- [x] Export endpoints
- [x] Provider plumbing for LLM-backed estimation and generation

### Phase 5: City Cost System Migration
- [x] Replace old city seed dataset with `city_costs_app_aud.csv`
- [x] Add `country-metadata.ts` and CSV-backed seed mapping
- [x] Remove transport estimation from the city methodology
- [x] Replace the old estimate logic page with methodology + dataset + history
- [x] Simplify `/settings/cities` into a city cost library editor
- [x] Add server-side city generation route and UI
- [x] Support user-supplied OpenAI / Anthropic / Gemini keys and model selection
- [x] Add edit/delete actions from `/estimates`
- [x] Add explicit `Save City` flow in `/settings/cities`
- [x] Refresh project memory in `CLAUDE.md`

## Current Known Gaps / Follow-Up Work

### City Cost / LLM Workflow
- [ ] Add provider/model validation or discovery so UI options do not become stale over time
- [ ] Decide whether to keep or remove the older legacy estimate API path and related older estimation code
- [ ] Add a proper methodology-backed rule for `drinkImportBeer`
- [ ] Consider exposing the inferred AUD/USD rate in the generation UI, not just stored metadata

### Settings / Admin UX
- [ ] Add country-creation UI so users do not need a pre-existing country row before adding a city
- [ ] Consider duplicate-city protection beyond id uniqueness, such as fuzzy warnings on similar city names
- [ ] Consider a “clear saved API keys” control in the generation UI

### Data Quality / Cleanup
- [ ] Clean up any locally created duplicate test city rows when encountered
- [ ] Decide whether older historical estimate records need migration or pruning after the methodology switch

### Product Follow-Up
- [ ] Review whether `/estimates` should allow inline editing directly, or remain a jump-off point into `/settings/cities`
- [ ] Consider surfacing city provenance/history more richly in the settings editor
- [ ] Consider adding tests around city generation parsing and Wise import format handling

## Recent Important Changes

### Dataset And Seeding
- `src/db/seed.ts` now imports the new CSV dataset
- `src/lib/country-metadata.ts` maps country ids, currency codes, and regions
- CSV-backed rows are tagged with `base_csv_apr_2026`

### Estimates And Settings UI
- `/estimates` is now a methodology-heavy page with dataset and generation history tables
- `/settings/cities` is now the main city-cost library editor
- The city library now supports explicit save, edit, delete, and deep-linking from the estimates table
- The `/estimates` city-cost table sticky column overlap on horizontal scroll was fixed

### Wise Import Improvements
- `src/lib/wise-csv-parser.ts` was upgraded to support both provided Wise CSV export formats
- `src/lib/wise-import.ts` now does a second-pass AUD conversion lookup for merged non-AUD rows that still lack `amountAud`
- Verified against:
  - `transaction-history_2026-04-06.csv`
  - `data/preeta_wise_balance_statement.csv`
  - `data/statement_88001685_GBP_2026-02-01_2026-04-08.csv`

### Planner And Dashboard Refinements
- Added `itinerary_leg_transports` plus runtime backfill from older single transport fields
- Added `/api/itinerary/snapshot` for plan export/import and browser-saved snapshots
- Added `/api/planner/settings` plus `app_settings` storage for planner traveller count
- Planner tier popovers now show the live scaled per-option costs for the selected traveller count
- Planner leg cards no longer expose a separate split percentage control
- Planner header/sidebar locking and transport input focus handling were tightened
- Dashboard summary calculations and labels were rebuilt around planned-vs-actual clarity
- Dashboard country comparison now exposes planned/day and actual/day values per country

## Useful Files
- `CLAUDE.md`
- `city_costs_app_aud.csv`
- `methodology.md`
- `llm_prompt_new_cities_1.md`
- `src/lib/city-generation.ts`
- `src/lib/city-generation-config.ts`
- `src/lib/country-metadata.ts`
- `src/lib/wise-csv-parser.ts`
- `src/app/api/cities/[id]/generate/route.ts`
- `src/app/settings/cities/page.tsx`
- `src/app/estimates/page.tsx`

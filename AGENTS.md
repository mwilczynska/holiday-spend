# Wanderledger

This is the canonical project memory file. `AGENTS.md` must stay a byte-for-byte mirror of this document. After editing this file, run `npm run docs:sync-memory`, and use `npm run docs:check-memory` to verify they still match.

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
- `/plan/compare` compares saved plan snapshots side-by-side with cumulative spend, country, and category charts plus summary cards
- `/track` records actual spend, either manually or by importing Wise CSV exports
- `/` compares planned vs actual spend across the trip and across countries
- `/dataset` manages the city cost library, shows the planner-facing dataset, and shows generation history
- `/estimates` documents the current city-cost methodology

## Project Location
- App code: repo root
- Public docs: `docs/`
- Developer plans/handoffs: `docs/dev/`
- Canonical reference datasets: `data/reference/`
- Local sample imports: `sample-data/` (typically untracked)
- DB: `data/travel.db` (SQLite, gitignored)
- Local dev auth fallback: optional `AUTH_DEV_PIN` in `.env.local` (current local setup still uses `1234`)
- Native-auth env vars:
  - `ENABLE_EMAIL_PASSWORD` enables the public email/password flows in dev when mail delivery is not otherwise configured
  - `APP_URL` is used to build absolute verification/reset links
  - `RESEND_API_KEY` and `MAIL_FROM` are required for production email delivery
  - without `RESEND_API_KEY` in development, verification/reset links fall back to `console.log`

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
- Canonical base dataset is `data/reference/city_costs_app_aud.csv`
- Dataset covers 121 cities across 58 countries
- App-facing values are AUD for 2 people
- Seed flow now imports the CSV rather than relying on the older smaller JSON-only city dataset

### Methodology Assets
- Methodology doc: `docs/product/methodology.md`
- New-city prompt template: `docs/prompts/llm_prompt_new_cities_1.md`
- `/estimates` now reflects this methodology rather than the older hybrid/Xotelo explanation
- `/dataset` now holds the editable planner dataset and generation-history views

### Transport
- Transport estimation has been removed from the city methodology
- Planner still supports manual:
  - `transportOverride`
  - repeatable per-leg `intercityTransports`
- City cost generation and methodology pages should continue to treat transport as manual-only
- Planner transport estimation is now a separate intercity feature with its own prompt, provider adapters, and planner UI flows

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
- `/dataset` includes provider selection, API key entry, model entry, reference date/context, and generation results
- `/plan` now has a dedicated `Add Leg -> New City` LLM flow that only asks for city name, country name, and nights by default; provider/model/API-key overrides live in an optional advanced section
- API keys entered in the UI are stored only in browser `localStorage`
- Keys are not written to the repo or database
- Model names are editable so the UI is not hard-blocked by stale defaults
- City-generation UIs now surface provider-specific known model suggestions, quick-pick buttons, and non-blocking warnings for custom/unknown model ids
- City-generation UIs now include explicit `Clear This Key` and `Clear All Saved Keys` controls for browser-stored API keys

### Provider-Specific Reliability Fixes Already Applied
- OpenAI payload switches between `max_tokens` and `max_completion_tokens` depending on model family
- Gemini generation disables thinking with `thinkingBudget: 0` to reduce truncated JSON output
- Gemini now surfaces a clearer truncation error when it stops before finishing the JSON
- Provider/model defaults are centralized in `src/lib/city-generation-config.ts`
- Legacy stored browser defaults are migrated forward automatically
- Known city-generation model ids and legacy browser model migrations are centralized in `src/lib/city-generation-config.ts`
- Planner-side metadata inference now reuses the same provider/browser-default plumbing through a shared JSON LLM client rather than duplicating provider-specific request code

### Generation Output Handling
- Generated rows save:
  - provider
  - model
  - prompt version
  - confidence notes
  - anchors JSON
  - estimate history
- Drink unit prices shown in the editable city model are inferred from `anchors_usd` and converted to AUD using the implied AUD/USD rate from the generated tier outputs
- Drink tiers now include an explicit stored `drinks_none` field for the coffee-only basket: 2 coffees total for 2 travellers

## Planner / Tracking / Dashboard State

### Planner
- Accommodation tiers support hostel dorm, private room, and 1-star through 4-star
- Drinks tiers support none, light, moderate, and heavy
- Tier descriptions are explicit and planner helper copy explains category logic
- Country and city pickers are searchable
- Legs can be reordered, edited inline, and constrained by date validation
- Intercity transport is now a repeatable per-leg list rather than a single always-open field
- Planner now supports LLM-backed intercity transport estimation per leg plus a bulk `Estimate Missing Transport` flow for unfilled legs
- Saved plan snapshots are now stored in the `saved_plans` database table (user-owned), replacing the old browser localStorage approach
- Saved plans are surfaced as an inline collapsible panel on `/plan` with load, export, delete, and compare actions
- Plans can be selected for side-by-side comparison at `/plan/compare`, which shows cumulative spend charts and summary cards
- Comparison computes planned costs server-side from snapshot tier selections plus current city base rates
- Compare now uses one canonical planned-allocation model for summary totals, cumulative chart lines, and future country/category grouped outputs
- Compare totals reconcile by design: summary total, final cumulative value, country totals, and category totals all come from the same allocation engine
- The compare page now has a deliberate hierarchy: wider plan-summary cards first, cumulative spend as the hero chart, then country/category breakdown charts below
- Compare-page layout adapts by plan count: 2-3 plans keep the breakdown charts side-by-side, while 4-5 plans stack them vertically for readability
- Planned spend by country now supports canonical `Totals` and `Per Day` modes, defaults to `Per Day`, shows all countries inline with dynamic height, and ranks rows by the maximum displayed daily spend across compared plans
- Planned spend by category now uses grouped horizontal bars in both inline and expanded states so the expanded view mirrors the inline card rather than changing chart type
- Compare-page colors are centralized in `src/lib/comparison-colors.ts` and fixed to the sequence `blue -> purple -> teal -> yellow -> green`
- Snapshot export now includes optional city/country metadata per leg, and snapshot import can pause for a missing-city resolution step before continuing
- That import resolver now asks the user to choose a canonical country from the repo-owned dataset and auto-creates the country row server-side only when needed
- The `/plan` add-leg new-city path now uses a planner-specific server route that checks the DB first, infers currency/region/IDs server-side, creates missing country/city rows, generates costs, and then adds the leg
- Traveller count is configurable in `/settings` and `/plan`, and now persists per user in `user_preferences.planner_group_size`
- City base costs remain stored for 2 travellers and are scaled at runtime in planner/dashboard calculations
- Legacy `splitPct` / split-percentage planner flow has been removed from the active app layer; traveller count is the only current cost-sharing model
- Planner header spacing was tightened, the desktop `Trip Summary` / `By Country` column remains sticky, and planner info popovers now use viewport-clamped portal positioning so tall popups stay visible near the bottom of the page
- Planner totals and summaries are stable and current

### Expense Tracking
- Expense CRUD, tagging, exclusion, reassignment, and bulk operations are implemented
- When an expense is manually assigned to a leg, dashboard reporting keeps the original transaction date visible in tracking UI but clamps the reporting date into the leg window for timeline calculations
- Wise CSV import supports both:
  - transaction-history export
  - balance-statement export
- Wise import now handles repeated IDs, multiple date formats, better category inference, and itinerary leg assignment by date
- `/track/add` still exists as the manual quick-add page, but its old 50/50 split toggle has been removed

### Dashboard
- Dashboard summary, country comparison, planned-vs-actual, and cumulative burn views are implemented
- Actual-spend handling was tightened so missing AUD conversions do not pollute totals
- Spend views are constrained to the trip window instead of entire historical account activity
- Summary cards now use clearer planned-vs-actual terminology and include info popovers that explain each calculation
- Dashboard summary was simplified from 14 cards to 11: removed `Required Daily Pace`, `Planned Legs`, `Fixed Costs`, and `Planned Avg So Far`; added `Planned $/day` (total budget / total nights) and renamed `Actual Avg So Far` to `Actual $/day`
- Dashboard header and summary now make the selected traveller count explicit
- Country comparison now includes planned/day and actual/day columns using each country's planned itinerary days
- Dashboard charts now use explicit mode pickers rather than ambiguous toggles, include axis labels, and can be expanded into larger interactive dialogs
- The spending-by-category view is now a bar chart with percentage labels rather than a pie chart
- The cumulative burn chart now renders country labels in a measured header strip above the plot, preserving the staggered layout while preventing wrapped country names from overlapping plotted lines
- The cumulative burn chart no longer adds the old 30% y-axis buffer above the highest spend/estimate series
- The dashboard no longer exposes a quick-add CTA

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
- [x] Replace old city seed dataset with `data/reference/city_costs_app_aud.csv`
- [x] Add `country-metadata.ts` and CSV-backed seed mapping
- [x] Remove transport estimation from the city methodology
- [x] Replace the old estimate logic page with methodology + dataset + history
- [x] Consolidate the city cost library editor onto `/dataset`
- [x] Add server-side city generation route and UI
- [x] Support user-supplied OpenAI / Anthropic / Gemini keys and model selection
- [x] Add edit/delete actions from `/estimates`
- [x] Add explicit `Save City` flow in the dataset editor
- [x] Refresh project memory in `CLAUDE.md`

### Priority 2B: Native Account Expansion
- [x] Add native email/password accounts alongside Google OAuth rather than replacing Google sign-in
- [x] Treat email as the primary account identifier and keep display name optional instead of introducing username-first auth
- [x] Add dedicated native-auth storage for password hashes plus email-verification and password-reset tokens rather than overloading the base `user` table
- [x] Use strong password hashing such as `argon2id` for native accounts
- [x] Build the public auth flows and pages for sign up, email sign in, verify email, forgot password, and reset password
- [x] Add email delivery for verification and password reset flows before treating native accounts as production-ready
- [x] Require verification, password reset, and basic brute-force / rate-limit protection as part of the native-account rollout rather than shipping raw passwords without the surrounding safety flows
- [x] Decide and document account-linking rules between Google and email/password accounts, and avoid blind auto-linking based only on matching email
- [x] Add signed-in account management follow-up for display name and change password

## Current Known Gaps / Follow-Up Work

### Priority 1: Deployment / Production Readiness
- [x] Keep `README.md` as the GitHub-facing project overview and move operational runbooks into `docs/ops/deployment.md`
- [x] Refresh deployment config and docs for current runtime names and expectations, especially `GEMINI_API_KEY`, SQLite persistence, and required secrets
- [x] Align Wanderledger deployment guidance with the existing `travel-blog` VPS baseline: same server operations model, but a single-app container topology for this repo
- [x] Replace the self-signed nginx setup with a production-ready VPS path such as a reverse proxy plus real TLS
- [x] Add a smoother production bootstrap flow for first deploys, including DB creation/seed expectations and failure troubleshooting

### Priority 2: Auth / Multi-User Foundation
- [x] Replace the current shared PIN gate with real auth for a future 2+ user-facing app
- [x] Choose and implement an auth stack that supports OAuth and user-owned data from day one
- [x] Add user ownership to current persisted trip entities so later saved-plans/comparison work sits on top of user-owned data rather than global shared state

### Priority 3: Saved Plans And Comparison
- [x] Move saved plans from browser `localStorage` into the database
- [x] Surface saved plans directly on `/plan` so they are easy to browse, open, and manage without hiding them behind the current modal-first flow
- [x] Design and build a dedicated multi-plan comparison view
- [x] Start that comparison UI with a cumulative planned spend over time chart, one line per saved plan, plus a small set of summary cards such as planned total and planned average spend per day

### Priority 4: Dashboard Simplification
- [x] Simplify the dashboard summary so it focuses on the most useful trip-level numbers
- [x] Remove low-signal summary stats that currently add clutter, especially `Required Daily Pace`, `Planned Legs`, and `Fixed Costs`
- [x] Add a clearer top-level planned average spend metric in `$ / day`

### City Cost / LLM Workflow
- [x] Add provider/model validation or discovery so UI options do not become stale over time
- [x] Remove the older legacy estimate API path and any now-unused estimation code if it is no longer part of the active product flow
- [x] Consider exposing the inferred AUD/USD rate in the generation UI, not just stored metadata
- [x] Decide whether older historical estimate records need migration or pruning after the methodology switch

### Settings / Admin UX
- [x] Replace manual country creation with canonical-country selection plus automatic DB row creation where needed
- [x] Add duplicate-city protection beyond id uniqueness, such as fuzzy warnings on similar city names
- [x] Add a clear saved API keys control in the generation UI
- [x] Surface city provenance/history more richly in the dataset editor without turning `/dataset` into a second full editor

### Cleanup / Simplification
- [x] Do a legacy-code cleanup pass and remove dead or superseded code paths, especially around older estimation flows and stale deployment scaffolding
- [ ] Review whether transport-estimation caching is worth adding later, but treat it as lower priority than cleanup, auth, saved plans, and comparison

### Testing
- [ ] Add tests around city generation parsing and Wise import format handling
- [ ] Expand Playwright coverage from planner regressions into full add-leg / generation success-path tests with controlled fixture data
- [ ] Add direct provider/model capability validation for planner transport estimation, especially browse-enabled model compatibility
- [ ] Add automated coverage around bulk transport estimation, provider fallback behaviour, and planner apply flows

## Recent Important Changes

### Native Account Expansion
- Added native email/password accounts alongside Google OAuth using dedicated `user_passwords`, `auth_tokens`, and `auth_rate_limits` tables plus `argon2id` password hashing
- Added public auth flows for signup, check-email, verify-email, forgot-password, reset-password, and resend-verification, with verification required before native sign-in succeeds
- Added Resend-backed email delivery for verification and password reset links, with a development fallback that logs links to the server console when `RESEND_API_KEY` is unset
- Added account-collision guardrails so Google and email/password accounts are not auto-linked purely by matching email; the login page now shows explicit provider-specific guidance
- Added signed-in account management at `/settings/account` with display-name editing, change-password, and read-only sign-in method status
- Added Vitest unit coverage for `password`, `auth-tokens`, and `rate-limit`
- `ensureUserRow` no longer upserts on every sign-in, preventing provider logins from clobbering user-edited display names
- `src/middleware.ts` now exempts all public auth pages (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/check-email`) so signed-out users can complete the native-account flow

### Saved Plans And Comparison
- Saved plan snapshots moved from browser `localStorage` to `saved_plans` SQLite table with user ownership
- `saved_plans` table stores full snapshot JSON blob plus denormalized summary columns for fast list queries
- CRUD API at `/api/saved-plans` and `/api/saved-plans/[id]`
- Comparison API at `POST /api/saved-plans/compare` computes canonical planned-allocation results server-side and derives summary, cumulative series, country totals, and category totals from that one model
- Planner page now shows saved plans in an inline collapsible panel instead of a modal dialog
- `SavePlanDialog` replaces `window.prompt()` for naming plans
- `/plan/compare` is a first-class page with its own sidebar entry ("Compare") in both desktop and mobile nav
- Compare page uses a fixed header matching the planner's proportions (sticky, shadow, title/subtitle/action buttons)
- Comparison is persisted in sessionStorage - navigating away and back restores the last comparison
- "Change Plans" button on comparison results returns to selector with current plan IDs pre-checked
- Sidebar `isActive` logic uses `excludePrefix` to prevent `/plan` and `/plan/compare` from both highlighting
- Recharts LineChart cumulative spend chart and summary cards for up to 5 plans
- The old compare-page mismatch caused by `nights`-based totals versus inclusive date enumeration has been removed; the canonical allocation engine now prevents chart overcounting when explicit date spans exceed `nights`
- Playwright E2E tests cover save, persist, delete, compare navigation, chart rendering, sidebar nav, and error states
- Vitest coverage now locks compare reconciliation invariants, fixed-cost allocation behavior, intercity-first-day allocation, and the `nights` versus inclusive-date regression case
- The temporary browser `localStorage` migration shim has now been removed; saved plans are DB-only in the active app model
- Compare-page analytics now include:
  - a wider responsive summary rail for 2-5 plans
  - a planned-by-country chart derived from canonical compare payload fields, with `Per Day` as the default view
  - a planned-by-category grouped bar chart that stays visually aligned between inline and expanded states
  - a centralized compare-page color palette shared across summary cards and all compare charts
- Compare-page country-chart shaping is now centralized in `src/lib/comparison-country-chart.ts`, including the default mode and the max-daily-spend row ordering rule
- Compare-page test coverage now includes:
  - Vitest helper coverage for country-chart data shaping
  - Playwright coverage for 2-plan and 5-plan compare readability plus all compare-chart expand dialogs

### Dataset And Seeding
- `src/db/seed.ts` now imports the new CSV dataset
- `src/lib/country-metadata.ts` now resolves a repo-owned canonical country dataset and shared country-creation defaults
- Canonical country metadata lives in `src/lib/data/country-metadata.generated.json` with app-specific adjustments in `src/lib/data/country-metadata.overrides.json`
- Country creation paths now reuse shared canonical-resolution helpers so `/api/countries`, `/api/cities`, planner new-city creation, and snapshot import all resolve the same metadata
- CSV-backed rows are tagged with `base_csv_apr_2026`

### Dataset And Methodology UI
- `/dataset` is now the main city-cost library page and includes the city editor, dataset table, and generation history
- `/estimates` is now methodology-only
- The city library still supports explicit save, edit, delete, and generated-value refresh from the dataset page
- The methodology page retains the written model details while the planner-facing data now lives separately
- The temporary `/settings/cities` compatibility route has been removed; `/dataset` is now the only canonical city-library route

### Settings / Admin UX
- `/dataset` no longer exposes a standalone Add Country flow; country rows are auto-created from the canonical dataset as a side effect of adding cities or resolving planner/snapshot imports
- The add-city flow now warns on likely duplicate rows, blocks exact same-country duplicate names, and can infer city ids from the city name when left blank
- The selected-city editor now includes an inline provenance panel with active estimate metadata and recent history rows
- City-generation flows in `/dataset`, planner new-city creation, and snapshot-import generation now expose explicit controls to clear browser-stored API keys

### Canonical Country Dataset
- Country metadata is now repo-owned, deterministic, and generated into `src/lib/data/country-metadata.generated.json` with a narrow overrides layer in `src/lib/data/country-metadata.overrides.json`
- Runtime resolution is deterministic across canonical names, aliases, ISO codes, and ids through `src/lib/country-metadata.ts`
- Manual country metadata entry is no longer part of active product flows; planner import, planner new-city creation, and dataset city creation all resolve canonical country metadata server-side
- Added Vitest coverage for canonical dataset integrity, resolver behavior, and `/api/countries` + `/api/cities` creation/reuse paths

### City Cost / LLM Workflow
- Shared provider/model metadata, legacy default migrations, and model validation now live in `src/lib/city-generation-config.ts`
- `/dataset`, `/plan` new-city creation, and snapshot-import generation now reuse the same known-model suggestions and custom-model warnings
- Browser-stored legacy model defaults are automatically migrated forward when these UIs load
- Added Vitest coverage for city-generation model migration and validation helpers in `src/lib/city-generation-config.test.ts`
- Removed the legacy `/api/cities/estimate` route, unused hybrid/Xotelo estimation library, and the inactive anchor-input / legacy estimator components that no longer back any active UI flow
- The generation UI now surfaces the implied AUD/USD rate directly in the result panel, and dataset history exposes the stored inferred rate per estimate record
- Older pre-methodology estimate history is retained as read-only audit history rather than being auto-migrated or pruned; the active city row remains the canonical planner source

### Cleanup And Simplification
- Removed the `/settings/cities` compatibility route and updated tests/docs to use `/dataset` directly
- Removed the saved-plan localStorage migration helper and the legacy planner-group-size fallback from `app_settings`
- Simplified seeding so it no longer depends on `seed-data/cities.json`; seeding now follows the CSV dataset plus canonical country metadata
- Removed old `xotelo` references from the typed/schema and UI surface where they no longer participate in active logic
- Moved handoff notes into `docs/dev/` so they no longer live at the repo root
- Removed the stale repo-managed nginx config artifact; deployment docs continue to treat reverse proxy/TLS as host-level concerns
- Moved active plan docs into `docs/dev/plans/`, handoffs into `docs/dev/handoffs/`, deployment docs into `docs/ops/`, methodology into `docs/product/`, prompts into `docs/prompts/`, and the canonical CSV into `data/reference/`
- Added `docs/README.md` as the docs entry point and a gitignored `.local/` workspace convention for personal imports, notes, scratch files, and screenshots

### Wise Import Improvements
- `src/lib/wise-csv-parser.ts` was upgraded to support both provided Wise CSV export formats
- `src/lib/wise-import.ts` now does a second-pass AUD conversion lookup for merged non-AUD rows that still lack `amountAud`
- Verified against:
  - `transaction-history_2026-04-06.csv`
  - `data/preeta_wise_balance_statement.csv`
  - `data/statement_88001685_GBP_2026-02-01_2026-04-08.csv`

### Planner And Dashboard Refinements
- Replaced the old shared PIN cookie gate with NextAuth-based session auth, Google OAuth support, and a dev-only credentials fallback for local development
- Added Auth.js SQLite tables plus user ownership on itinerary legs, expenses, fixed costs, tags, and planner preferences, with first-sign-in claiming of older single-user data
- Added `itinerary_leg_transports` plus runtime backfill from older single transport fields
- Added derived itinerary leg date backfill so older legs with missing dates still participate in planner, tracking, and dashboard timeline calculations
- Added `/api/itinerary/snapshot` for plan export/import and browser-saved snapshots
- Added `/api/itinerary/snapshot/preflight` plus UI flow in `/plan` to resolve missing cities during custom snapshot import
- Missing-country resolution now defaults to just city name plus country name; country ID, currency, and region are treated as inferred/advanced fields
- The `/plan` add-leg flow now uses a dedicated planner LLM dialog and server route instead of the older import-style missing-city resolver UI
- Planner-side new-city creation now checks the DB first, canonicalizes names, infers currency/region/IDs server-side, handles ID collisions, creates missing rows, generates city costs, and then inserts the leg
- Added `/api/planner/settings` plus `user_preferences.planner_group_size` storage for planner traveller count
- Planner tier popovers now show the live scaled per-option costs for the selected traveller count
- Planner leg cards no longer expose a separate split percentage control
- Legacy `splitPct` wiring was also removed from the current planner schema, snapshot flow, and quick-add split UI
- Planner header/sidebar locking and transport input focus handling were tightened
- Planner new-city typing lag was fixed by moving the LLM add-city dialog into a local-state component instead of keeping the form state at the page root
- Planner info popovers now render through a portal with measured viewport clamping and a max-height fallback so taller cards, especially `Accommodation`, are not cut off at the bottom of the page
- Planner transport estimation now has provider-neutral methodology with provider-specific browse adapters for OpenAI, Anthropic, and Gemini, plus single-leg and bulk estimation dialogs
- Transport estimation now reports whether live search/grounding was actually used, shows search queries/citations when available, and falls back to stricter JSON-only estimation when browse responses do not parse cleanly
- Anthropic and Gemini transport estimation now use lower token budgets, retry/backoff handling for rate limits, and paced bulk estimation to reduce provider TPM/RPM failures
- Bulk `Estimate Missing Transport` targets only eligible legs with no transport rows yet and applies the top estimated option per successful leg
- Added Playwright planner regression coverage for sticky summary behaviour, new-city dialog typing responsiveness, and bottom-edge accommodation popover visibility
- Dashboard summary calculations and labels were rebuilt around planned-vs-actual clarity
- Dashboard country comparison now exposes planned/day and actual/day values per country
- Dashboard category spend now renders as a labeled bar chart, chart mode controls are explicit, and each dashboard chart can be expanded into a larger interactive dialog
- Dashboard burn-chart country labels were moved above the plot into a measured staggered strip so wrapped names cannot collide with spend lines
- Dashboard burn-chart y-axis now uses the actual series/budget maximum rather than the older extra 30% headroom
- Dashboard quick-add shortcuts were removed from the home page

## Useful Files
- `CLAUDE.md`
- `docs/README.md`
- `data/reference/city_costs_app_aud.csv`
- `docs/product/methodology.md`
- `docs/prompts/llm_prompt_new_cities_1.md`
- `docs/prompts/llm_prompt_intercity_transport_1.md`
- `src/lib/city-generation.ts`
- `src/lib/city-llm-client.ts`
- `src/lib/city-generation-config.ts`
- `src/lib/country-metadata.ts`
- `src/lib/data/country-metadata.generated.json`
- `src/lib/data/country-metadata.overrides.json`
- `src/lib/planner-city-resolution.ts`
- `src/lib/transport-estimation.ts`
- `src/lib/wise-csv-parser.ts`
- `src/app/api/cities/[id]/generate/route.ts`
- `src/app/api/itinerary/legs/create-with-city/route.ts`
- `src/app/api/itinerary/legs/[id]/estimate-transport/route.ts`
- `src/components/itinerary/BulkTransportEstimateDialog.tsx`
- `src/components/itinerary/TransportEstimateDialog.tsx`
- `src/components/itinerary/PlannerNewCityDialog.tsx`
- `src/components/itinerary/InfoPopover.tsx`
- `src/app/api/auth/change-password/route.ts`
- `src/app/api/user/profile/route.ts`
- `src/app/settings/account/page.tsx`
- `src/components/auth/AccountSettings.tsx`
- `src/lib/password.ts`
- `src/lib/auth-tokens.ts`
- `src/lib/rate-limit.ts`
- `src/app/dataset/page.tsx`
- `src/app/estimates/page.tsx`
- `src/lib/country-metadata.test.ts`
- `src/lib/country-routes.test.ts`
- `tests/playwright/planner-regressions.spec.ts`
- `src/lib/plan-comparison.ts`
- `src/lib/plan-comparison.test.ts`
- `src/lib/comparison-country-chart.ts`
- `src/lib/comparison-country-chart.test.ts`
- `src/lib/comparison-colors.ts`
- `src/components/itinerary/SavedPlansList.tsx`
- `src/components/itinerary/SavePlanDialog.tsx`
- `src/components/itinerary/ComparisonChart.tsx`
- `src/components/itinerary/ComparisonCountryChart.tsx`
- `src/components/itinerary/ComparisonCategoryChart.tsx`
- `src/components/itinerary/ComparisonSummaryCards.tsx`
- `src/app/plan/compare/page.tsx`
- `src/app/api/saved-plans/route.ts`
- `src/app/api/saved-plans/[id]/route.ts`
- `src/app/api/saved-plans/compare/route.ts`
- `tests/playwright/saved-plans.spec.ts`
- `tests/playwright/plan-comparison.spec.ts`
- `docs/dev/plans/saved-plans-comparison.md`
- `docs/dev/plans/compare-planned-allocations.md`
- `docs/dev/plans/compare-page-ui-analytics.md`
- `docs/dev/plans/country-dataset.md`
- `docs/dev/plans/cleanup-simplification.md`
- `docs/dev/README.md`
- `docs/dev/handoffs/cleanup-simplification.md`
- `docs/dev/handoffs/country-dataset.md`

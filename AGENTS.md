# Holiday Spend

This is the canonical project memory file. `AGENTS.md` must stay a byte-for-byte mirror of this document. After editing this file, run `npm run docs:sync-memory`, and use `npm run docs:check-memory` to verify they still match.

## What The App Is
Holiday Spend is a private travel budget and spend-tracking app for long multi-city trips.

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

## Development Workflow
- Commit and push after each sizeable chunk of work and after each milestone

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
- Existing build note remains: `/api/export` is dynamic because it reads request headers

## Current City Cost System

### Canonical Dataset
- Canonical base dataset is `data/reference/city_costs_app_aud.csv`
- Dataset covers 121 cities across 58 countries
- App-facing values are AUD for 2 people
- Seed flow now imports the CSV rather than relying on the older smaller JSON-only city dataset

### Methodology Assets
- Methodology doc: `docs/product/methodology.md`
- New-city prompt template: `docs/prompts/llm_prompt_new_cities_1.md`
- First accommodation reference schedule: `data/reference/accommodation_reference_windows_2026_2027.json`
- Accommodation property-panel collection (currently Barcelona, Copenhagen, Da Nang, Lisbon, and Prague): `data/reference/accommodation_property_panels_2026_2027.json`
- Accommodation quote-attempt ledger: `data/reference/accommodation_quote_attempts/`
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
- All current LLM pickers now also support live provider model discovery through an authenticated `/api/llm/models` route, with a shared `Refresh models` action and explicit live-vs-fallback status copy
- Model discovery runs through a three-tier pipeline: Tier 1 is the live provider API (when a browser key or server env key is present), Tier 2 is a no-key aggregator fetch against OpenRouter with models.dev as a secondary source, and Tier 3 is a generated curated snapshot
- Live discovery uses the browser-supplied API key when present, otherwise the server-side env key for that provider when available
- When neither live discovery nor any aggregator is usable, the UI falls back cleanly to the generated curated snapshot rather than blocking custom model ids
- The curated snapshot lives at `src/lib/data/curated-models.generated.json` and is refreshed by `npm run models:refresh` (with a dry-run `npm run models:check` variant); the refresh script reuses the runtime filters so the committed snapshot never contains ids that runtime would reject
- Aggregator fetches read the body as text, inspect content-type, and parse inside a try/catch so gateway HTML or truncated responses surface as a friendly "Aggregated sources temporarily unavailable" warning rather than leaking raw engine parse errors into the UI
- City-generation UIs now include explicit `Clear This Key` and `Clear All Saved Keys` controls for browser-stored API keys

### Provider-Specific Reliability Fixes Already Applied
- OpenAI payload switches between `max_tokens` and `max_completion_tokens` depending on model family
- Gemini generation disables thinking with `thinkingBudget: 0` to reduce truncated JSON output
- Gemini now surfaces a clearer truncation error when it stops before finishing the JSON
- Provider/model defaults are centralized in `src/lib/city-generation-config.ts`
- Live provider model discovery is centralized in `src/lib/provider-model-discovery.ts` with a shared client hook in `src/lib/use-provider-model-discovery.ts`
- Live model discovery uses a lightweight in-memory TTL cache keyed by provider plus credential fingerprint rather than a background sync job
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

### Phase 6: Observed-First City Cost Methodology And Validation (In Progress)

Phase 6 replaces the current anchor-and-derive city costs with directly observed, source-attributed evidence and only uses a validated missing-data model where observation is not possible. Progress is gated: later milestones must not begin merely because an earlier research pass exists; they begin only when the earlier milestone's completion criteria are met.

**Current position:** methodology and evidence tooling are complete; pilot collection and accommodation validation are active. Model selection, 121-city recollection, and product migration remain blocked on adequate pilot coverage.

#### Phase 6A: Freeze The Methodology And Acceptance Rules (Complete)
- [x] Assess the original anchor-and-derive methodology against the supplied external accuracy audit
- [x] Define version 3 estimands for accommodation, food, drinks, and activities; keep intercity transport manual and outside city costs
- [x] Freeze observation provenance, source precedence, validation metrics, provisional accuracy gates, and fail-closed missing-data behaviour before model fitting
- [x] Document the redesign in `docs/dev/plans/observed-first-methodology.md` and add the reproducible `accuracy_audit.csv` baseline

#### Phase 6B: Build The Reproducible Evidence Pipeline (Complete)
- [x] Add the versioned observation contract, source-access matrix, JSONL store, extraction-batch manifest, and bounded provider-neutral research runner
- [x] Add batch validation, deterministic local-currency aggregation, frozen source-attributed FX, and v3-alpha basket materialization
- [x] Retain secondary evidence, flag cross-channel medians differing by more than 25%, and keep research output unreviewed until evidence review
- [x] Enforce fail-closed publication: unsupported cells remain missing and no incomplete wide city row is published

#### Phase 6C: Build A Model-Ready 36-City Pilot (In Progress)
- [x] Select a deterministic pilot spanning every region and the current cost range, then complete bounded first-pass research for all 36 candidates
- [x] Retain explicit source-gap outcomes rather than substituting nearby cities, country averages, unlabeled prices, guest nights, or mixed day/overnight totals
- [ ] Complete observation collection for food, drinks, and activities, prioritizing required-measure coverage, independent source overlap, freshness, and documented sparse-city exceptions
- [x] Complete the population matching pass with 29 reviewed records and seven explicit unmatched or non-single-city outcomes
- [ ] Complete comparable tourism intensity using same-geography overnight arrivals and resident population
  - [x] Measure 11/36 cities and both registered predictors for 10/36
  - [ ] Resolve more of the remaining 25 cities without accepting geography or estimand mismatches
- [x] Publish the deterministic baseline profile: 32/36 cities represented, 151/684 required tier cells materialized (22.08%), and zero complete cities
- [ ] Reach sufficient city/category/source coverage to calculate cross-channel disagreement, source-age, robust-outlier, seasonal-completeness, and systematic-missingness diagnostics
- [ ] Freeze the pilot dataset and its missingness report; document every unresolved cell before any model comparison begins

#### Phase 6D: Complete Observed-First Accommodation Panels (In Progress)
- [x] Use official registers or destination directories for price-blind frames and direct property sites for quotes; exclude Booking.com and Hostelworld from LLM extraction
- [x] Pre-register exact-90-day low/shoulder/high windows and require five accepted quotes per measure and season plus at least 60% cross-season property overlap
- [x] Freeze reproducible Barcelona, Copenhagen, Da Nang, Lisbon, and Prague frames and add an append-only quote-attempt ledger
- [x] Complete Copenhagen's 4-star shoulder checkpoint with five accepted quotes from ten rank-ordered attempts
- [ ] Clear or replace every reference window through the event screen while preserving an auditable replacement history
- [ ] Complete Copenhagen low/high seasons; collect eligible Barcelona, Da Nang, Lisbon, and Prague panels; resolve defensible hostel inventory; and expand reproducible property frames to the remaining pilot cities
- [ ] For every materialized accommodation measure, obtain at least five accepted direct-property quotes in each season and at least 60% cross-season property overlap
- [ ] Materialize and independently validate the first annualized accommodation measures; leave any measure that fails a gate explicitly missing

#### Phase 6E: Freeze Validation Design And Independent Holdout (Blocked On 6C-6D)
- [ ] Confirm that pilot target coverage, regional representation, destination types, cost range, and independent-source overlap support defensible evaluation
- [ ] Pre-register primary and subgroup metrics, provisional acceptance gates, uncertainty methods, and failure/remediation rules
- [ ] Freeze a region/cost/source-density-stratified city holdout before fitting; prevent all holdout cities from influencing feature engineering, model choice, or tuning
- [ ] Version and hash the training/validation split plus the frozen pilot artifact so later evaluation is reproducible

#### Phase 6F: Compare And Freeze The Missing-Data Method (Blocked On 6E)
- [ ] Benchmark transparent baselines before more complex methods, including regional/category medians and shrinkage or hierarchical alternatives
- [ ] Use whole-city cross-validation so observations or derived tiers from one city cannot leak between training and validation folds
- [ ] Compare accuracy, bias, subgroup failure, stability, and interval calibration; prefer the simplest method that materially improves the registered metrics
- [ ] Freeze the selected fallback, deterministic tier rules, features, hyperparameters, and uncertainty method before the holdout is opened
- [ ] Evaluate the holdout once; disclose failed gates and start a newly protected validation cycle if material remediation is required

#### Phase 6G: Recollect And Validate All 121 Cities (Blocked On 6F)
- [ ] Recollect direct observations for all 121 cities in versioned, checkpointed, auditable batches using the frozen source and review contracts
- [ ] Materialize observed tiers deterministically, apply the frozen fallback only to eligible missing cells, and publish calibrated uncertainty plus evidence-quality scores
- [ ] Report achieved overall and subgroup metrics with city-cluster uncertainty intervals and run full-itinerary backtests against the current dataset
- [ ] Produce a versioned data card containing coverage, provenance, missingness, model use, limitations, validation results, and rollback inputs

#### Phase 6H: Product Migration And Ongoing Monitoring (Blocked On 6G)
- [ ] Replace the version 1 prompt with source-first observation extraction and deterministic server-side tier calculation, validation, provenance, fallback logging, and uncertainty
- [ ] Migrate the canonical CSV/database only after the validation gates pass; retain the prior dataset, methodology, and a tested rollback path
- [ ] Publish achieved rather than aspirational coverage, accuracy, bias, subgroup, and uncertainty metrics on `/estimates`
- [ ] Add category-aware freshness checks and monitor actual-trip residuals for drift by region, category, and destination type

#### Phase 6 Completion Gate
- [ ] Phase 6 is complete only when the 121-city observed-first dataset is validated, product generation uses the source-first deterministic path, `/estimates` publishes achieved metrics and limitations, and the prior production dataset can be restored safely

#### Detailed Phase 6 Progress Log
- [x] Assess the original anchor-and-derive methodology against the supplied external accuracy audit
- [x] Define version 3 estimands, observation-level provenance, validation metrics, and provisional acceptance gates
- [x] Document the observed-first redesign in `docs/dev/plans/observed-first-methodology.md`
- [x] Add reproducible baseline audit code for `accuracy_audit.csv`
- [x] Define the versioned observation contract, validation command, and source-access matrix
- [x] Generate a deterministic 36-city candidate pilot spanning every region and the current cost range
  - [x] Constrain collection to free, checkpointed LLM web-research calls with no paid data APIs or project-imposed daily cap
  - [x] Add an observation-level JSONL store and extraction-batch manifest
  - [x] Add a provider-neutral source-research runner that renders bounded assignments, validates saved free-call JSON, requires explicit measure coverage, and keeps all returned rows unreviewed pending evidence review
  - [x] Add extraction-batch validation plus deterministic local-currency aggregation, frozen FX, and v3-alpha basket materialization
  - [x] Add source-channel-aware aggregation that retains secondary evidence and flags cross-channel medians differing by more than the provisional 25% review threshold
  - [x] Review accommodation source access, exclude Booking.com/Hostelworld from LLM extraction, and route the new panel through official registers plus direct property sites
  - [x] Pre-register and validate 27 exact-90-day accommodation reference windows across the first nine observed cities
  - [x] Require five direct property quotes per low/shoulder/high season and 60% cross-season panel overlap before an accommodation measure can materialize
  - [x] Freeze the first official-register property frame for Barcelona: 344 active standard hotels, 322 in-radius candidates, 48 price-blind primary selections, and 274 ordered reserves
  - [x] Generalize the property/ranking contract and freeze Copenhagen: 201 eligible national Hotelstars records, 29 hotels within 5 km, and 13 VisitCopenhagen hostel candidates pending inventory/location verification
  - [x] Freeze Prague after collapsing 225 eligible Hotelstars rows to 148 physical properties: 25 distinct in-radius properties, two ten-property hostel panels, five 3-star and nine 4-star hotels, explicit absent 1-/2-star classes, and one geolocated inventory-pending hostel
  - [x] Freeze Lisbon from same-day official RNET/RNAL snapshots: 254 geolocated 1-4-star hotels, 242 within 5 km across four frozen hotel panels, and 113 explicit hostel registrations collapsed to 106 physical candidates with 97 in radius pending website/inventory verification
  - [x] Reject Lisbon's original 22-29 October shoulder window after its capture-day official event screen and move the stay and capture exactly seven days forward with the rejected dates, evidence, and reason retained in replacement history
  - [x] Reject Bangkok's original 22-29 October low-season window because it contains the official Friday 23 October public holiday, then move the stay and capture exactly seven days forward pending a fresh 31 July screen
  - [x] Add an explicit blocking `inconclusive` event-review state and record source-attributed 24 July outcomes for Hanoi, Pu Luong, San Francisco, and Da Nang rather than treating incomplete official-calendar coverage as clearance
  - [x] Freeze and validate Da Nang's official source universe: 423 unique government-managed 1-4-star hotels across 29 hashed register pages, with all records held out of ranking until auditable geolocation is available
  - [x] Freeze Da Nang's property frame after a cached policy-limited geolocation pass: 50 deduplicated accepted coordinates, 49 hotels within 5 km across all four star classes, and 371 rows visibly unranked for missing, coarse, ambiguous, or boundary-pending location evidence
  - [x] Freeze Hanoi's 330-record government-managed 1-4-star search universe across 24 hashed pages, but block all ranking until those historical-looking results reconcile to the official February 2026 count of 37 currently valid properties
  - [x] Collect the first batch-zero checkpoint: 12 directly inspected Numbeo food/drink observations plus three official paid-attraction prices across Lisbon, Prague, and Hanoi
  - [x] Collect batch-zero day 02 across Copenhagen, Bangkok, and Pu Luong, bringing the store to 27 accepted direct observations across six cities while retaining sparse-city missingness
  - [x] Collect pilot wave 1 across Barcelona, San Francisco, and Da Nang, bringing the store to 42 accepted direct observations across nine cities
  - [x] Extend pilot wave 1 across Zanzibar, Shanghai, and Auckland, bringing the store to 61 accepted direct observations across 12 cities while adding Africa, East Asia, and Oceania coverage
  - [x] Continue pilot wave 1 across Nairobi, Fukuoka, and Queenstown, bringing the store to 76 accepted direct observations across 15 cities
  - [x] Add Medellin, Istanbul, and Goa, bringing the store to 91 accepted direct observations across 18 cities and establishing evidence coverage in every pilot region
  - [x] Add Havana, Dubai, and Delhi, bringing the store to 105 accepted direct observations across 21 cities while retaining Havana's August 2025 freshness limitation and explicit missing official attraction price
  - [x] Add Sendai, Sofia, and Vancouver, bringing the store to 120 accepted direct observations across 24 cities while retaining Sendai's sparse source context and correcting Bulgaria's post-euro-adoption canonical currency
  - [x] Add Seoul, Budapest, and Mexico City, bringing the store to 135 accepted direct observations across 27 cities while retaining Mexico City's temporary direct-page access limitation
  - [x] Add Tokyo, Split, and Can Tho, bringing the store to 149 accepted direct observations across 30 cities while retaining Can Tho's four-contributor estimated-data warning and explicit missing paid attraction
  - [x] Add Dubrovnik and Chiang Rai evidence and a fail-closed Ubud source-gap audit, bringing the store to 158 accepted direct observations across 32 cities; no Ubud numeric value is inferred from an unlabeled menu scale
  - [x] Add Da Lat and Yangon, bringing the store to 168 accepted direct observations across 34 cities while retaining Da Lat's sparse source context and Yangon's city-page USD quotation plus attributed CBM market-rate conversion
  - [x] Complete bounded first-pass source research for all 36 pilot candidates: add three Vang Vieng menu/activity observations and retain Don Det, Santa Fe (Bantayan), and Ubud as explicit source-gap outcomes rather than substituting nearby cities or national averages
  - [x] Add a validated 36-city pilot-enrichment artifact with frozen city-size and tourism-intensity estimands plus evidence-derived public-source-density bands
  - [x] Populate a region-stratified first tranche of nine comparable 2025 city populations from UN WUP File 21, retaining DEGURBA spatial units, source city codes, and original labels; keep the other 27 population and all 36 tourism fields explicitly pending
  - [x] Complete the UN WUP population matching pass with 29 reviewed records and seven explicit unmatched/non-single-city outcomes; reject fuzzy substitutes before beginning tourism enrichment
  - [x] Add the measured tourism-intensity contract and first same-geography record for Prague: 8,063,367 official 2024 collective-accommodation guests / 1,397,880 residents = 5.77 arrivals per resident (`high`), with the lower-bound coverage limitation retained
  - [x] Add Barcelona as the second measured tourism-intensity record: 12,726,360 official 2024 tourists in available city accommodation series / 1,702,814 municipal residents = 7.47 (`high`), retaining the report's data-availability limitation
  - [x] Add Mexico City as the first non-European tourism-intensity record: 14,403,349 official 2023 hotel tourists / 9,221,637 projected mid-year residents across the same 16-borough federal entity = 1.56 (`medium`), retaining the hotel-only lower-bound limitation
  - [x] Add Fukuoka and Budapest tourism-intensity records: Fukuoka's rounded/modelled 2023 overnight-tourist count produces 3.51 arrivals per resident (`medium`), while Budapest's broad 2024 registered-accommodation count produces 3.99 (`medium`)
  - [x] Add Sofia as the first measured `low` tourism-intensity record: 1,185,345 official 2024 accommodation arrivals / 1,295,931 residents = 0.91, retaining the 10-or-more-bed establishment threshold
  - [x] Add Istanbul as the second measured `low` tourism-intensity record: 13,212,666 official 2023 accommodation arrivals / 15,655,924 province residents = 0.84, retaining repeat-entry and registered-establishment limitations
  - [x] Add Dubrovnik and Split tourism-intensity records from official 2024 eVisitor and municipal-population evidence: Dubrovnik = 33.25 (`very_high`) and Split = 6.62 (`high`), retaining the repeat-registration limitation
  - [x] Add San Francisco tourism intensity from the published 2023 overnight-visitor model and Census population: 8.00 million / 808,988 = 9.89 (`high`), retaining rounded/modelled precision; reject Tokyo guest-night and mixed-visit substitutes
  - [x] Add Lisbon tourism intensity from the bilingual official municipal profile: 6,460,430 accommodation guests / 567,131 residents = 11.39 (`high`) for the same municipality and year, retaining registered-accommodation and repeat-stay limitations
  - [x] Add a deterministic pilot-wide missingness profile: 32/36 pilot cities represented, 151/684 tier cells materialized (22.08%), zero complete cities, and three non-pilot batch-zero rows explicitly excluded
  - [x] Add a validated accommodation attempt ledger and complete the Copenhagen shoulder checkpoint: ten rank-ordered official-site attempts, five accepted 4-star quotes, one no-availability result, and four booking-path failures
  - [x] Materialize the current fail-closed research artifact from 171 direct observations: 166 of 665 tier cells across 35 represented cities, one incomplete accommodation measure, and zero incomplete wide rows published
- [ ] Continue the category-level pilot collection, accommodation panels, enrichment, diagnostics, model selection, 121-city recollection, validation, and product migration through the gated milestones above

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
- [x] Align Holiday Spend deployment guidance with the existing `travel-blog` VPS baseline: same server operations model, but a single-app container topology for this repo
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
- `/dataset`, `/plan` new-city creation, snapshot-import generation, single-leg transport estimation, and bulk transport estimation now all share the same live model discovery flow and fallback status treatment
- Added authenticated `GET /api/llm/models` plus provider adapters for OpenAI `/v1/models`, Anthropic `/v1/models`, and Gemini `/v1beta/models`
- Live discovery responses now distinguish `source`, `credentialSource`, `liveModels`, `effectiveModels`, `fetchedAt`, `cacheHit`, and `warning` so the UI can explain whether it is showing fresh or fallback suggestions
- Browser-stored legacy model defaults are automatically migrated forward when these UIs load
- Added Vitest coverage for city-generation model migration and validation helpers in `src/lib/city-generation-config.test.ts`
- Added Vitest coverage for provider model normalization, filtering, and cache reuse in `src/lib/provider-model-discovery.test.ts`
- Removed the legacy `/api/cities/estimate` route, unused hybrid/Xotelo estimation library, and the inactive anchor-input / legacy estimator components that no longer back any active UI flow
- The generation UI now surfaces the implied AUD/USD rate directly in the result panel, and dataset history exposes the stored inferred rate per estimate record
- Older pre-methodology estimate history is retained as read-only audit history rather than being auto-migrated or pruned; the active city row remains the canonical planner source
- Phase 6 accommodation collection now uses a deterministic repeated-property panel rather than Booking.com/Hostelworld extraction: official registers or classification directories define the sampling frame and selected property sites provide public dated quotes
- `npm run methodology:research` renders one bounded source-research assignment or validates a saved raw/fenced JSON response from a free web-enabled LLM; assignment mismatches, unaccounted measures, duplicate ids, and self-accepted rows fail closed
- The second pilot checkpoint adds Zanzibar, Shanghai, and Auckland: 12 direct Numbeo food/drink primitives and official paid-attraction prices for Shanghai Tower and Auckland MOTAT; Zanzibar retains explicit attraction missingness and its sparse eight-contributor context
- The third pilot checkpoint adds Nairobi, Fukuoka, and Queenstown: 12 direct Numbeo food/drink primitives and three official paid-attraction prices; localized Numbeo URLs remain explicit where canonical English pages returned temporary 503 responses
- The fourth pilot checkpoint adds Medellin, Istanbul, and Goa: 12 direct Numbeo food/drink primitives and three official paid-attraction prices, establishing evidence coverage in Latin America, the Middle East, and South Asia; Goa's December 2025 freshness date remains explicit
- The fifth pilot checkpoint adds Havana, Dubai, and Delhi: 12 direct Numbeo food/drink primitives and official paid-attraction prices for Dubai and Delhi; Havana's August 2025 Numbeo date and 31-contributor context remain explicit, and its official attraction price remains missing rather than substituting a private guide
- The sixth pilot checkpoint adds Sendai, Sofia, and Vancouver: 12 direct Numbeo food/drink primitives and three official paid-attraction prices; Sendai's low 19-contributor density and wide ranges remain explicit, Vancouver retains its April 2026 page date, and Sofia uses EUR after Bulgaria's 1 January 2026 euro adoption
- The seventh pilot checkpoint adds Seoul, Budapest, and Mexico City: 12 direct Numbeo food/drink primitives and three official paid-attraction prices; Mexico City's exact 12 June 2026 update and temporary canonical-page 503 remain explicit rather than being hidden by the indexed-page fallback
- The eighth pilot checkpoint adds Tokyo, Split, and Can Tho: 12 direct Numbeo food/drink primitives and official paid-attraction prices for Tokyo and Split; Can Tho retains its four-contributor estimated-data warning, 25 February 2026 source date, and explicit missing official paid attraction
- The ninth pilot checkpoint adds eight direct Numbeo food/drink primitives across Dubrovnik and Chiang Rai plus the official Dubrovnik Museums adult ticket; Dubrovnik's April 2025 freshness limitation and Chiang Rai's low-contributor estimated-data warning remain explicit, while Ubud stays numeric-missing because the inspected menu does not label its currency scale
- The tenth pilot checkpoint adds eight direct Numbeo food/drink primitives and official attraction prices across Da Lat and Yangon; Da Lat retains its 13-contributor warning, while Yangon's source-quoted USD values use a dated CBM bank-customer market-rate cross-rate rather than an informal or unattributed currency conversion
- The eleventh pilot checkpoint completes first-pass source research for all 36 candidate cities: Vang Vieng adds one current restaurant-menu meal plus directly priced half-day and full-day operator products; Don Det and Santa Fe remain zero-observation outcomes because their genuine local pages expose no retrievable numeric prices
- Pilot enrichment has a versioned schema and deterministic builder: retained evidence yields three `none`, one `sparse`, 32 `moderate`, and zero `dense` public-source-density bands; the Dubai `UAE`/`United Arab Emirates` evidence-key alias is regression-tested
- The first city-size tranche retains 2025 UN WUP File 21 DEGURBA populations for Nairobi, Tokyo, Lisbon, Mexico City, Dubai, Vancouver, Auckland, Hanoi, and Delhi, including source city codes and original labels; 27 population and all 36 tourism-intensity fields remain pending
- The completed UN WUP match pass raises comparable city-size coverage to 29 of 36 pilot destinations; Dubrovnik, Queenstown, Don Det, Pu Luong, Vang Vieng, and Santa Fe (Bantayan) have explicit no-match outcomes, while Goa is retained as a non-single-city destination rather than assigned an arbitrary city population
- Tourism-intensity enrichment now stores the numerator, denominator, definitions, source URLs, common geography, reference year, derived ratio, and deterministic band; Prague is the first measured city and the other 35 remain explicitly pending
- Barcelona is the second measured tourism-intensity city and Mexico City is the third and first non-European record; Auckland remains unaccepted because its official destination report supplies international-only visitor arrivals and total guest nights rather than total overnight arrivals
- Fukuoka and Budapest raise measured tourism-intensity coverage to five of 36 pilot cities; Fukuoka retains its rounded modelled-numerator limitation and Budapest covers commercial, private, and other registered accommodation
- Sofia raises measured tourism-intensity coverage to six of 36 and adds the first `low` case; its NSI numerator excludes categorized establishments with fewer than 10 bed places
- Istanbul raises measured tourism-intensity coverage to seven of 36 and adds a second `low` case; its official 2023 numerator counts registered-establishment entries rather than unique visitors and excludes out-of-frame stays
- Dubrovnik and Split raise measured tourism-intensity coverage to nine of 36 and add the first `very_high` case; both use same-boundary 2024 eVisitor arrivals and official municipal populations while retaining eVisitor's repeat-registration limitation
- San Francisco raises measured tourism-intensity coverage to ten of 36 and adds the first North American record; its 2023 numerator is a rounded model estimate covering hotels, rentals, and friends/family stays rather than an administrative registration count
- Lisbon raises measured tourism-intensity coverage to 11 of 36 and measured-both-predictors coverage to ten; its official 2023 municipal profile supplies both the guest numerator and resident denominator on one boundary while retaining registered-accommodation and repeat-stay limitations
- `data/reference/materialized/city_cost_pilot_profile.json` now joins enrichment and materialized evidence across the full 36-city denominator, reports coverage by region/city-size/tourism/source-density strata, and records that fallback-model selection is not yet defensible
- Bulgaria's canonical country metadata now resolves to EUR rather than the retired BGN code, with generated metadata and tests refreshed from the explicit override
- The frozen 22 July 2026 FX snapshot now covers CNY, NZD, JPY, TRY, INR, CAD, KRW, HUF, and MXN through ECB euro cross-rates, TZS through the Bank of Tanzania's published AUD mean rate, KES through the latest retained official CBK USD quote, COP through Banco de la Republica's 21 July TRM crossed with frozen USD/AUD, AED through the Central Bank of the UAE's published AUD mid-rate, CUP through the Banco Central de Cuba natural-person reference, MMK through the CBM bank-customer market rate published by Myanmar's Central Statistical Organization, and LAK through the latest Bank of the Lao P.D.R. reference preceding the snapshot
- `data/reference/accommodation_reference_windows_2026_2027.json` freezes 27 low/shoulder/high seven-night windows for nine cities, each with an exact 90-day quote lead and capture-day event-screen gate
- `data/reference/accommodation_property_panels_2026_2027.json` now uses a generic version 2 property/ranking contract and freezes Barcelona, Copenhagen, Da Nang, Lisbon, and Prague; one verified hostel can enter both dorm and private-room panels without duplicating the establishment
- Lisbon's 24 July 2026 official RNET/RNAL frame retains 242 in-radius classified hotels and 97 in-radius physical hostel candidates; hotel selection excludes price/brand/capacity/website visibility, while hostels remain unranked until direct sites prove dorm/private inventory
- Barcelona joins the Catalonia Tourism Register to Barcelona City Council coordinates on the `HB` registration id; the full SHA-256 rank retains primary, reserve, missing-coordinate, and out-of-radius rows
- The Barcelona frame has four frozen hotel panels but zero verified websites or accepted quotes; its hostel measures remain explicitly unavailable because `Hostal o pensió` is not treated as youth-hostel inventory
- Copenhagen uses the public no-key Hotelstars Union Denmark directory: after excluding conference and 5-star products, 201 eligible hotel records produce 29 in-radius properties (3 two-star, 11 three-star, 15 four-star), no one-star class, and a two-star panel below the five-quote gate
- VisitCopenhagen supplies 13 hostel candidates with direct property links; inventory, address, radius eligibility, and website ownership remain pending
- Copenhagen's completed shoulder capture attempted the first ten frozen 4-star properties in order: Andersen, Hotel Alexandra, Wide Hotel, Hotel Skt. Annæ, and The Huxley produced accepted public official-site quotes; Absalon had no availability; four other booking paths failed exact-date or mandatory-charge verification
- The accepted Copenhagen nightly prices are DKK 1,178.36, DKK 1,365.29, DKK 1,417.43, DKK 1,652.57, and DKK 1,738.93; the DKK 1,417.43 median passes the five-property shoulder sample gate but remains non-materializable until low/high coverage and 60% repeated-property overlap are complete
- `src/lib/accommodation-quote-attempt.ts` and `data/reference/accommodation_quote_attempts/` retain quote, no-availability, and technical-failure outcomes separately, including tax, cancellation, meal-basis, and official-site evidence
- Prague's reusable Hotelstars deduplicator collapses repeated rows by physical identity, requires class/city agreement, and refuses to choose between duplicate coordinates more than 0.25 km apart; the frozen Czech snapshot has 225 eligible rows, 148 physical properties, 76 duplicate groups, and four coordinate-conflict exclusions
- Prague City Tourism's official 12-property hostel directory and detail pages yield two ten-property ranked hostel panels; combined with five 3-star and nine 4-star hotels, the Prague frame has 25 distinct eligible in-radius properties, while 1-/2-star remain absent and one geolocated hostel remains inventory-pending
- Calculator `city-cost-v3-alpha-3` retains partial seasonal evidence but requires at least five quotes per season plus 60% cross-season property overlap before materializing a direct accommodation measure

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
- `data/reference/methodology_page.md`
- `data/reference/accuracy_audit.csv`
- `docs/dev/plans/observed-first-methodology.md`
- `scripts/audit-city-cost-accuracy.mjs`
  - `data/reference/city_cost_collection_pilot.json`
  - `data/reference/city_cost_collection_batches.json`
  - `data/reference/accommodation_reference_windows_2026_2027.json`
  - `data/reference/accommodation_property_panels_2026_2027.json`
  - `data/reference/accommodation_quote_attempts/copenhagen-shoulder-2026-07-24.jsonl`
  - `data/reference/observations/accommodation-copenhagen-shoulder-2026-07-24.jsonl`
  - `data/reference/observations/batch-zero-accommodation-copenhagen-shoulder-report.json`
  - `data/reference/observations/batch-zero-day-01-food-drinks.jsonl`
  - `data/reference/observations/batch-zero-day-01-activities.jsonl`
  - `data/reference/observations/batch-zero-day-01-report.json`
  - `data/reference/observations/batch-zero-day-02-food-drinks.jsonl`
  - `data/reference/observations/batch-zero-day-02-activities.jsonl`
  - `data/reference/observations/batch-zero-day-02-report.json`
  - `data/reference/observations/pilot-wave-01-day-01-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-01-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-01-report.json`
  - `data/reference/observations/pilot-wave-01-day-02-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-02-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-02-report.json`
  - `data/reference/observations/pilot-wave-01-day-03-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-03-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-03-report.json`
  - `data/reference/observations/pilot-wave-01-day-04-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-04-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-04-report.json`
  - `data/reference/observations/pilot-wave-01-day-05-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-05-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-05-report.json`
  - `data/reference/observations/pilot-wave-01-day-06-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-06-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-06-report.json`
  - `data/reference/observations/pilot-wave-01-day-07-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-07-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-07-report.json`
  - `data/reference/observations/pilot-wave-01-day-08-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-08-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-08-report.json`
  - `data/reference/observations/pilot-wave-01-day-09-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-09-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-09-report.json`
  - `data/reference/observations/pilot-wave-01-day-10-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-10-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-10-report.json`
  - `data/reference/observations/pilot-wave-01-day-11-sparse-markets.jsonl`
  - `data/reference/observations/pilot-wave-01-day-11-report.json`
  - `data/reference/city_cost_pilot_enrichment.json`
  - `data/reference/city_cost_pilot_enrichment_inputs.json`
  - `data/reference/observations/pilot-wave-01-day-09-food-drinks.jsonl`
  - `data/reference/observations/pilot-wave-01-day-09-activities.jsonl`
  - `data/reference/observations/pilot-wave-01-day-09-report.json`
- `docs/dev/plans/city-cost-source-access.md`
- `docs/prompts/llm_prompt_city_cost_observations_1.md`
- `src/lib/city-cost-observation.ts`
- `src/lib/city-cost-pilot-enrichment.ts`
- `scripts/build-city-cost-pilot-enrichment.ts`
- `src/lib/accommodation-reference-window.ts`
- `src/lib/accommodation-property-panel.ts`
- `src/lib/accommodation-quote-attempt.ts`
- `scripts/build-barcelona-accommodation-property-panel.ts`
- `scripts/build-copenhagen-accommodation-property-panel.ts`
- `scripts/validate-accommodation-property-panels.ts`
- `scripts/validate-accommodation-reference-windows.ts`
- `scripts/validate-accommodation-quote-attempts.ts`
- `scripts/run-city-cost-research.ts`
- `src/lib/city-cost-research-response.ts`
- `scripts/select-city-cost-pilot.mjs`
- `scripts/validate-city-cost-observations.ts`
- `src/lib/city-cost-methodology-v3.ts`
- `scripts/materialize-city-cost-v3.ts`
- `data/reference/fx/city_cost_fx_aud_2026-07-22.json`
- `data/reference/materialized/city_costs_v3_alpha.json`
- `src/lib/city-generation.ts`
- `src/lib/city-llm-client.ts`
- `src/lib/city-generation-config.ts`
- `src/lib/provider-model-discovery.ts`
- `src/lib/use-provider-model-discovery.ts`
- `src/lib/country-metadata.ts`
- `src/lib/data/country-metadata.generated.json`
- `src/lib/data/country-metadata.overrides.json`
- `src/lib/planner-city-resolution.ts`
- `src/lib/transport-estimation.ts`
- `src/lib/wise-csv-parser.ts`
- `src/app/api/cities/[id]/generate/route.ts`
- `src/app/api/llm/models/route.ts`
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

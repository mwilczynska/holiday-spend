# Holiday Spend

Canonical project memory, read by Codex directly and by Claude Code through the `@AGENTS.md` import in `CLAUDE.md`.
Edit only this file.

This file describes what the project is and currently does. It is deliberately free of change history.

| For | Read |
| --- | --- |
| What is planned next, milestone status, open decisions | **[PLAN.md](docs/dev/PLAN.md)** |
| What was built, what was tried, and what the evidence showed | **[LOG.md](docs/dev/LOG.md)** |
| Active city-cost rollout (v1.2) | **[PLAN.md](docs/dev/PLAN.md)** |
| City-cost accuracy research behind v1.2, and how to continue it | `docs/research/city-cost-accuracy.md`; branch `research/city-cost-accuracy`, tag `city-cost-research-r3-2026-10-17` |
| Cold-start handoff and exact next action | `docs/dev/handoffs/city-cost-v1-1.md` |
| Retired v5 and v6.1 research history | archived `feat/city-cost-methodology-v6` branch and tag `city-cost-v6.1-research-final-2026-08-18` |
| Retired v1 audit, v3 and v4 research tooling and data | tag `city-cost-v3-v4-research-final-2026-10-21`; written record in `docs/product/archive/methodology-v4.md` |
| Current city-cost methodology | `docs/product/city-cost-methodology.md` |
| Transport and climate methods | `docs/product/transport-estimation.md`, `docs/product/trip-climate.md` |

---

## What the app is

A private travel budget and spend-tracking app for long multi-city trips. It combines itinerary planning,
budget modelling across accommodation / food / drinks / activities, manual and imported expense tracking,
planned-vs-actual dashboards, and a city-cost library that can generate new cities with an LLM.

City base costs are stored in AUD for two people and scaled at runtime for traveller count and selected tiers.
Display currency is an account preference, selectable beside traveller count on dashboard/planner and in Settings.
Totals, chart labels/tooltips, saved-plan summaries, Dataset prices and cost inputs use the selected currency at the
latest available daily Frankfurter rate, with an hourly refresh. The existing exchange-rate table caches observations
under their actual date. Input is converted back to AUD for persistence; switching currency never rewrites amounts.
Original transaction currencies, stored FX provenance and fixed methodology examples retain their stated units.
Missing, invalid or older-than-seven-day rates leave conversions unavailable with Retry; failed selections retain
the requested currency as a draft and keep the saved display. AUD needs no network request.

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

## Product analytics and private plan history

Product analytics is first-party and self-hosted. `/admin/analytics` provides overview, journeys, funnels/retention,
private plan revisions, LLM attempts and health. `AUTH_ANALYTICS_ADMIN_EMAILS` defines an optional separate admin role;
otherwise the library administrators have access. Page, API, private revision and export access are checked server-side.

Behavioral collection is enabled by default, with a disable control in Settings and below signed-out account forms.
The account preference is enforced on ingestion and outbox delivery; disabling clears pending browser behavior.
Private plan history and necessary operational diagnostics continue. There is no scheduled expiry. `/privacy`
describes collection and access. Product records exclude raw IP identity, credentials, free-text inputs, uploads,
provider prompts/responses and screen recordings. LLM metadata records individual provider attempts, usage when
reported, retries, timing, search evidence and outcomes; unavailable usage/cost remains unavailable.

`travel.db` owns preferences, transactional plan revisions and a durable analytics outbox. The separate
`analytics.db` beside it owns events, daily counts and provider-attempt metadata; it can be relocated with
`HOLIDAY_SPEND_ANALYTICS_DB_PATH` to other persistent private storage. `HOLIDAY_SPEND_RELEASE` labels the deployment.
The Node worker delivers queued events every five seconds with event-ID deduplication. Plan revisions freeze the
plan, underlying city prices, preferences and canonical AUD totals in the same transaction as the mutation.
Saved-plan rename/delete and shared city-price updates preserve prior state. Migration baselines are labelled;
historical restoration is not implemented. Ordinary users cannot inspect other users' revisions.

Reports and export reads run in a bounded read-only thread (16 pending queries, 15-second timeout), keeping large
analytics reads off the product request thread. Exact daily summaries and session membership are maintained by
SQLite triggers alongside raw-event inserts, updates and deletions. Overview and retention use these summaries;
operation-specific reports retain raw-event queries. A generated identity column and covering index support ordered
funnels. Cache schema upgrades rebuild only summaries; raw events remain intact. Database startup locks before
reading schema state so concurrent build/server workers cannot apply the same migration twice.
Event exports persist progress and fix their upper event sequence;
downloads require the requesting administrator's current access. Erasure invalidates existing export jobs.

Full snapshots include analytics when present; catalogue snapshots exclude analytics and all private history.
Erasure tooling removes account analytics/history and keeps a replay-prevention marker; restore of an older backup
requires reapplying subsequent deletion requests. See `docs/analytics/README.md` for events, metrics, controls,
deployment, operational failure modes and verification.

## Aims and constraints

The city-cost system answers: *what will two people spend per day in this city?* Accuracy should be reasonable
and useful for trip decisions, refreshes must remain cheap, and users must be able to add a new city on demand.
There are no paid data APIs. Provider API keys entered in the UI remain in browser storage and are never written
to the repository or database.

## Tech stack and layout

Next.js 16 App Router · React 19 · Node.js 24 · TypeScript · Tailwind · Radix/shadcn UI · Drizzle ORM + better-sqlite3 ·
Zod · Recharts · NextAuth · Vitest + Playwright.

| Path | Contents |
| --- | --- |
| `docs/dev/PLAN.md` | Active plan and checklist |
| `docs/dev/LOG.md` | Append-mostly project and methodology history |
| `docs/prompts/` | Runtime LLM prompt contracts; status is recorded in its README |
| `data/reference/` | Seed city-cost CSV and transport accuracy evidence; its README lists readers |
| `scripts/` | App, operations, analytics and city-library tooling; its README lists each script |
| `src/lib/` | Production methodology, provider, persistence and planning code |
| `data/travel.db` | Local SQLite database; gitignored |

The repository root holds app code, config, `README.md`, `AGENTS.md` and `CLAUDE.md`; other documentation goes under
`docs/`. Research tooling and data do not belong on `main`: retired programmes are kept on tags and branches.
Agent and tool working folders (`.agents/`, `.codex/`, `telemetry/`, `.local/`) are gitignored, and worker logs are
never committed. Archived documents open with a `SUPERSEDED`, `ABANDONED`, or `COMPLETE` banner. Do not move or
rename files under `data/reference/` without updating their readers.

## City-cost system

The canonical seed dataset is `data/reference/city_costs_app_aud.csv`: 121 cities, 58 countries, AUD for two people,
tagged `base_csv_apr_2026`. `src/db/seed.ts` imports it only into an empty library. The local SQLite library contains
529 cities, including later additions. Deployment uses a verified full SQLite/photo snapshot to preserve all cities,
costs, provenance, climate and photos; reseeding is not migration. The owner decided on 18 October 2026 to regenerate
the whole library under v1.2; until a city is regenerated it keeps its v1.1 or v1 values.

### v1 rollback path

The historical v1 prompt, `docs/prompts/llm_prompt_new_cities_1.md`, asks one model for ten intuitive USD anchors
and returns all derived tiers. Its formulas include the asserted accommodation, food, drink and activity rules,
including `accom_4_star = hotel_3star × 1.80`. That formula is known to be imperfect but remains unchanged in v1.1
and v1.2, so 4-star follows the corrected 3-star price (owner decision, 18 October 2026).

### v1.2 active method

v1.2 is the default for new and regenerated cities (`CITY_COST_METHODOLOGY_VERSION` unset or `v1.2`). It keeps the v1.1
contract and adds two changes measured in the city-cost accuracy research (bundle 022):

- one web-enabled LLM call (prompt `docs/prompts/llm_prompt_new_cities_v1_2.md`) returns the same ten USD anchors plus
  the latest dated RBA USD/AUD observation; it may make up to five searches for food and drink prices, and
  accommodation stays a holistic estimate;
- the LLM returns no derived tiers, AUD values, corrections or conversion arithmetic;
- the server multiplies the food, drink, 3-star, 1-star and hostel USD anchors by a fixed per-country correction
  (`src/lib/data/city-cost-corrections-v1-2.json`: country within region, k = 3, fitted on 475 reference cities;
  typical factors 3-star 0.62, 1-star 0.85, dorm 0.77, private room 0.70, food and drink 0.96 to 1.01). Cocktail and
  wine are not corrected. `scripts/recorrect-city-costs.ts [--dry-run]` re-applies a new table to stored raw anchors
  without a model call, keeping hand-edited fields;
- the server then validates and inverts the RBA observation and applies the exact v1 formulas and USD→AUD conversion
  (`materializeCityCostV12` reuses the v1.1 materializer);
- raw and corrected anchors, the per-anchor correction and table version, provider/model, reasoning effort,
  prompt/formula versions, confidence and FX provenance are persisted under source `llm_city_generation_v1_2`;
- no grades or intervals are fabricated for model estimates;
- v1.1 and v1 remain explicit rollbacks through `CITY_COST_METHODOLOGY_VERSION=v1.1` or `v1`;
- `CITY_COST_METHODOLOGY_V6=true` must never activate v6.1.

Measured accuracy (budget-weighted mean absolute log error per city): 0.163 on 333 development cities and 0.190 on 142
held-out cities, against 0.435 for uncorrected v1.1. v1.2 does not rewrite the 121-city CSV.

Exchange rates can be refreshed without a model call for every city that stores USD anchors (v1.1 and v1.2):
`scripts/refresh-city-cost-fx.ts [--dry-run]` or admin `POST /api/cities/exchange-rate-refresh`. The refresh uses the
ECB daily USD/AUD cross rate because the RBA statistics tables refuse automated downloads; it keeps hand-edited fields
and records the previous rate in the estimate's `fxHistory`.

### v6 and v6.1 research history

v6/v6.1 are rejected product approaches retained for audit and reproducibility on the archived
`feat/city-cost-methodology-v6` branch and immutable tag `city-cost-v6.1-research-final-2026-08-18`. This clean product
branch intentionally does not carry their implementation or experiment tree. Do not resume their collection, open
holdouts, import staged rows, run Phase 11, or enable their old three-call/search contract.

## Trip climate

The planner displays 2021–2025 monthly historical mean temperature and precipitation, an annual view, and a whole-trip
graph with separate temperature/rainfall axes. Celsius is the default; shared C/F controls update all weather views.
The trip graph is date-scaled with one point per day: each stay holds its month's mean temperature for the days spent
there, with the month's average daily low–high as a band and rainfall as an area; gaps between stays and missing
climate break the line. Hovering any date shows that day's values. Axes are labelled, and a Today line appears when
today falls inside the plotted range.
Monthly precipitation is the average of the five monthly totals, including snow water equivalent; it is not a
forecast or a stay total.

Weather uses the no-key Open-Meteo historical archive with ERA5-Seamless and country-checked coordinates. Salento,
Colombia explicitly uses ECMWF IFS because its ERA5 rainfall disagrees sharply with official station evidence;
the source model is saved and only that city's prior record is invalidated. Querétaro, Cotopaxi, Tomo, Pingyao, Kaohsiung, Kenting and Sauraha use explicit points
because the geocoder's only match is the wrong place (a Chiapas village; an Esmeraldas village 150 km from the national
park) or none; a saved record that disagrees with an explicit point is recollected. The library spelling "Banatayan"
geocodes through an alias to Bantayan, Cebu, Suzhou is constrained to Jiangsu, Huangshan uses Huangshan City in Anhui rather than the same-named Yunnan settlement, Frankfurt uses Frankfurt am Main in Hesse rather than a Bavarian settlement, and Bandipur and Bhaktapur to their districts.
Saranda and Tromso use the geocoder's Sarandë and Tromsø names; Macau uses the Macao city point rather than its territory record. Hong Kong selects the city rather than its same-named island or territory. San Sebastian uses Donostia / San Sebastian in the Basque Country to avoid an Asturias village. Mykonos selects the island rather than its same-named town; Rhodes selects the city rather than its same-named island. Saved monthly weather and provenance
live in SQLite. Further explicit city aliases cover Corfu Town, Kos Town, Nafplio, Quebec City, Wadi Musa (the geocoder's populated Petra district seat), Puerto Princesa, Ayutthaya, Kuşadası, Guanajuato, Puebla, San Carlos de Bariloche and Luxembourg City. Puebla uses the Puebla City state-capital result rather than a same-named Baja California settlement. Charleston, Palm Springs and Santa Fe are constrained to South Carolina, California and New Mexico. City collection/generation and refresh also collect weather; routine
planner loads read saved records in one request. Existing cities collect once when needed. Provider failures remain
missing, or retain an explicitly labelled prior successful record after a failed refresh. All itinerary cards render;
the former twelve-card limit and load-more controls are removed. The trip chart waits for its initial data load to
settle rather than drawing incomplete lines repeatedly. See `docs/product/trip-climate.md` for the data contract.

## City images

The sidebar logo cross-fades
four drawn scenes (mountains, beach, plains, city), showing only the mountains under reduced motion.

Destinations show a free Wikimedia Commons photo where one can be verified, over the drawn scene, with the
author and licence credit linking to the Commons page. No key and no LLM: `src/lib/city-image-lookup.ts` accepts a
Wikipedia article only within 50 km of the city's coordinates (saved climate location, else the same Open-Meteo
geocoding), or, when the geocoder cannot place it, only if its Wikidata country matches; facility articles are never
chosen, settlement articles rank ahead of same-named municipality articles, and a search drowned by the country name is retried with the place name alone. `src/lib/city-image-service.ts` stores 1280px and 500px copies beside the database (`data/city-images/`,
gitignored) with a `city_images` row recording the city identity, status and credit. New cities collect a photo after
climate on manual add and every generation path; failure never blocks the save. Misses are recorded, renames make a row
stale, and pages fall back to the scene for any missing row or file. Photo metadata rides on itinerary legs and dashboard
city rows, and files are served from `/city-images/<cityId>` outside `/api`. `scripts/collect-city-images.ts` fills
or refreshes the library. See `docs/product/city-images.md`.

## Transport

Transport is outside city-cost methodology. The planner supports manual `transportOverride` and repeatable
`intercityTransports`, plus a separate LLM-backed intercity transport feature with its own prompt and provider
adapters. City-cost generation and methodology pages treat transport as manual-only.

## LLM generation and model discovery

The app supports thirteen providers, described as data in `src/lib/llm-provider-registry.ts`: OpenAI, Anthropic,
Google Gemini, xAI Grok, OpenRouter, Groq, Perplexity Sonar, Mistral, Z.ai GLM, DeepSeek, Together AI, Fireworks AI
and Cerebras. `docs/product/llm-providers.md` lists each one's transport, web search and effort parameter, and what
has been verified. City generation requires a live FX lookup, so its pickers list only the nine providers with
server-side web search (Groq only on gpt-oss models); transport pickers list all thirteen, and a provider without
search gives the labelled ungrounded fallback. Each provider's default is its cheap, fast, recent model, chosen by
`npm run models:refresh` from models.dev release dates and prices under the family rules in
`src/lib/model-default-selection.ts` (newest Luna, Haiku, Flash-Lite, Sonar, Mistral Small, GLM Flash, DeepSeek
Flash; cheapest Grok and gpt-oss), stored in the curated snapshot with the registry values as fallback. A replaced
default is recorded as retired, so browsers that saved it move to the new default; other saved choices are kept.

Models are chosen from a dropdown (`src/components/llm/ModelSelect.tsx`) on every LLM surface; there is no free-text
model entry. A saved model missing from the current list stays selectable and labelled. Model discovery runs through
live provider APIs when a browser/server key is available, then no-key aggregators (OpenRouter or models.dev, per
provider), then the generated curated snapshot at `src/lib/data/curated-models.generated.json`.

Reasoning effort options come from `src/lib/data/model-reasoning-efforts.generated.json` (OpenRouter's published
`supported_efforts`, written by `npm run models:refresh`), then family rules for unlisted models, filtered to what
the provider's request format can express. A saved effort the model rejects falls back to `max`, else the model's
highest. The server sends an effort only when the model accepts it. Claude 4.6 and later get adaptive thinking with
`output_config.effort` (earlier Claude models keep `budget_tokens`); Gemini 3 and later get `thinkingLevel`.
Application provider keys are never accessed, copied, logged or stored by Codex.

OpenAI defaults to `gpt-6-luna` with `max` reasoning. Stored selections of the previous `gpt-5.6-luna` default migrate
to it; other custom model choices are retained. A failed or empty keyed model-list response tries the no-key
aggregators before the saved snapshot, with account availability explicitly unverified. Discovery requests have
15-second timeouts, and failed keyed reads are not cached.

Generation and model-refresh errors include HTTP/provider details and retry guidance, with credentials redacted.
Invalid city output identifies missing or invalid fields; failed RBA validation gives its reason and saves no estimate.
Network failures and unreadable server responses have separate messages; generation forms remain available for retry.

Provider keys use one opt-in browser store shared by city generation, CSV-import generation, both transport
dialogs and **Settings → Provider API Keys**, which lists every provider's key with show, clear and save controls. Saved changes and clearing synchronize across open windows in the same browser profile and origin.
Existing saved feature keys migrate once. Unchecking saving removes persisted keys while retaining them for the
current window's session; unsaved keys are shared between its dialogs. Provider/model preferences remain separate.
Unsaved keys survive successful city saves, dialog changes and client navigation in that window. A full page
reload starts a new session and drops them.
Provider key fields have associated visible labels in city, transport and planner import forms; the existing-city editor's
Show API key switch is labelled and its label toggles the control.

Cities can also be added in batches with `scripts/add-cities-from-agent-responses.ts`: it writes the exact prompt for
the configured methodology (v1.2 by default) the app sends for each city, using the resolved existing country label (such as UAE), an external agent (for example a Claude Code subagent) answers it, and `persist` runs the
real `resolveOrCreatePlannerCity` path with only the provider call answered from file (`setExternalJsonPromptRunner`,
never set by the app), after checking the app-built prompt is byte-identical. `--provider`, `--model`, `--effort` and `--agent` set the
recorded provenance, for example "gpt-6-luna (Codex subagent)". It creates cities only, never itinerary legs.
`docs/dev/handoffs/add-cities-europe.md` is the handoff for continuing with European cities.

## Provider request limits

Two limits bound every provider call, configurable per user under **Settings → Provider Request Limits**, and
overridable by `LLM_MAX_OUTPUT_TOKENS` and `LLM_REQUEST_TIMEOUT_MS`. Precedence is the user setting, then the
environment, then the defaults in `src/lib/llm-runtime-settings.ts` (64,000 output tokens, 600-second timeout). A null
column means "follow the default", so raising a default reaches everyone who has not deliberately overridden it.

Neither limit is a budget. Providers bill reasoning tokens against `max_output_tokens` as they are generated, so a
high cap costs nothing until a request needs it, while a cap that binds part-way through is paid for in full and the
answer discarded. Both defaults therefore sit far above the observed working range, and the caps exist to stop a
request that has gone wrong.

When an OpenAI call is truncated mid-reasoning, the grounded call is retried one rung down the effort ladder
(`max`, `xhigh`, `high`) before web search is abandoned: running out of room to answer is a reason to think less, not
to stop searching. Every call logs its token usage, so the defaults can be revisited from evidence.

City generation uses these limits for both new and existing cities. Incomplete OpenAI responses are rejected even
when their text parses as JSON; retries retain required web search and share the original timeout. Successful
estimates record the effort that produced the answer. v1.1 and v1.2 never drop their required current-FX search.

Every transport path, including non-search and strict JSON retries, uses the configured limits; none imposes a
separate small answer cap. Bulk transport has a Stop control that aborts active requests and prevents queued legs
from starting. Cancelled legs are labelled separately from failures, and completed results remain available to apply.
Failed legs can be retried together without discarding completed estimates or rerunning successful legs.

## Product behavior

The Methodology page (`/estimates`) follows `docs/product/city-cost-methodology.md`: where city prices come from,
the v1.2 steps with a worked example, the correction, measured accuracy, traveller scaling and leg totals, intercity transport, trip climate,
limitations, and a short history of earlier methods at the end. Keep the page and the document in step.
Manual itinerary moves and date sorting expose failed requests and allow retry without false success messages.
Order writes are atomic; move buttons are labelled and disabled while an order request is active.

Planner cards also support repeatable manual miscellaneous expenses with a description and AUD amount.
Each amount is a one-off total for the leg and whole group, independent of nights and traveller scaling.
They are included in planner/dashboard budgets, saved plans, export/import and comparisons; dashboard category
totals include them under Other. Invalid amounts and rejected saves retain drafts with validation and Retry/Discard.

Accommodation tiers are hostel dorm, private room, and 1–4 star. Drinks are none, light, moderate and heavy.
Traveller count persists per user, while city base costs remain stored for two people. Saved plans store tier
choices rather than frozen city prices.

Dashboard, planner, expense tracker, dataset and settings include initial database data in their server-rendered
responses. Dashboard, planner, dataset and settings skip duplicate initial browser reads and refresh on client navigation and
after edits. The planner includes saved climate in its initial read, collects only missing records, and renders every
leg card. A card's body (climate, tiers, transport, expenses, overrides) mounts the first time the card opens and then
stays mounted while collapsed, so drafts survive. Cards are memoized and receive stable props: a leg save re-reads
only `/api/itinerary`, keeps unchanged leg and city objects, and re-renders the edited card and the one after it.
The reorder/delete lock is read from context by the buttons it disables. City pickers build their options only while
open. The trip climate chart renders from deferred values.

`/plan/compare` uses one canonical server-side allocation engine for summary totals, cumulative series and country
and category groupings. Manual transport remains separate.
Comparison list failures retain prior plans and selections with Retry; initial failures label plans/counts unavailable.
Calculation errors remain visible in selector mode, and prior results stay labelled stale until a complete validated
response replaces them. Obsolete responses cannot replace newer comparisons. Requested plan IDs must be unique,
and missing or unowned IDs reject the whole comparison.

Narrow screens keep wide comparison cards and dataset/expense tables inside their scroll areas. Planner controls
and leg summaries wrap, and the mobile navigation includes a reachable Sign out action.

Manual city costs must be finite and nonnegative. Zero and missing values remain distinct. Invalid edits retain
their draft with an error; the coffee price and coffee-only daily basket stay linked.

Dashboard read failures retain prior figures with a stale label and Retry; an initial failure shows unavailable totals
and charts. Complete responses replace the view together, and valid empty trips remain distinct from failed reads.
Dataset failures retain the last loaded city library and history with Retry; initial failures label counts and rows
unavailable. Library/history responses are validated together, retries keep city drafts, and provenance failures have
their own Retry. A saved city remains saved when the following refresh fails.
Settings read failures retain the last loaded values and fixed costs with Retry. Initial failures label traveller
count, provider limits and totals unavailable. All required responses are validated before replacement; retry keeps
unsaved provider-limit drafts, and controls that depend on current settings wait for a successful read.
Settings traveller selections remain labelled drafts until confirmed, with the last saved count shown. Rejected
selections offer Retry/Discard; pending saves lock the control and dependent cost actions. A successful reread can
confirm a write whose acknowledgement was unreadable.
Provider-limit saves validate the returned values against the request before confirming success. Failed saves and
resets retain input and offer Retry; newer edits replace the retry operation. Pending saves lock inputs and other
Settings writes, and last confirmed values remain visible with unsaved drafts.
Provider timeouts display exact millisecond precision in seconds after save, refresh and reload. Input accepts
millisecond steps; values below millisecond precision remain rejected drafts.
Profile-name saves require acknowledgement of the requested name, including clearing it. Failed saves retain drafts
with an error and saved-name label. Pending submissions lock input; newer edits clear previous save status.

Expense tracking supports CRUD, tagging, exclusion, reassignment, bulk operations, and Wise CSV imports. The expense
list loads further pages as it scrolls inside one viewport-height area, and a refresh reloads every loaded page.
Quick Add opens as a dialog from Expenses (`/track/add` remains); Tags are reached from Expenses, not the sidebar.
Dashboard spending is constrained to the trip window and missing AUD conversions are excluded rather than treated as zero.

The dashboard's current destination is the leg with an in-progress status, otherwise the leg containing today. Its
comparison table toggles between countries and cities, with search, in one scroll area. Per-day figures there exclude
intercity transport (planned and `transport_intercity` spend); totals still include it. The cumulative spend chart
shows a Today line only when today falls within the plotted dates.

A failed initial tracker read displays unavailable counts/totals and Retry. It never becomes a successful empty
result. Successful server-rendered views still skip duplicate initial browser reads.
Rejected expense edits keep their drafts; failed exclusion, deletion and bulk actions retain rows and selections
with an error. Failed tracker reads label the last loaded results and offer retry instead of showing an empty list.
Tag CRUD failures keep drafts and selections with an error; duplicate names return a conflict. Tag reads expose
failures and offer retry, and renaming a selected tag updates its displayed title.
Tag counts and lists omit deleted expenses. Tag totals follow the tracker's AUD calculation and omit excluded
spend and unavailable foreign-currency conversions; excluded and unconverted rows are labelled.
Expense actions include a tag picker that assigns and removes tags. Selection replacement is atomic and scoped
to the current user's active expense and tags. Failed saves retain selections; failed reads offer Retry.
New manual expenses resolve an AUD conversion before saving when none is supplied. An unavailable rate leaves the
conversion missing with a visible warning. Quick Add retains rejected input for retry and clears successful input
immediately to prevent duplicate submissions.
Fixed costs are retired from the UI in favour of per-leg miscellaneous expenses. The data model and budget arithmetic
remain for compatibility; Settings lists existing rows as "Fixed costs (retired)" with paid-status and delete only, and
summaries show a fixed-cost line only when the total is nonzero. Paid-status and delete failures leave the displayed row
unchanged and expose an error.
Planner leg additions retain the selected city and nights after rejected saves and show HTTP, network or unreadable
response errors. Nights must be a positive whole number. Pending additions disable the form and prevent a second submission.
Add Leg accepts several existing cities, each with start date, end date and nights kept consistent; the first starts
at the itinerary's last check-out day and each further city at the previous one's end. A dated leg is inserted in
date order (server-side, one transaction); an undated one is appended. Leg dates must be real YYYY-MM-DD dates in
2000-2100 and a leg at most 366 nights (create, update and create-with-city). Card date and nights inputs save on
blur, Enter or a 700 ms pause and only when valid, so typing a year does not save intermediate years such as 0202.
Changing a card's start date moves the leg and keeps its nights; changing the end date changes the nights. Planner and dataset new-city dialogs accept several
city/country entries with shared generation settings, and planner entries have separate dates and nights. Batches save in entry
order, stop on the first failure, and remove only confirmed additions from the pending draft; retry does not resubmit
confirmed saves. The button that opens LLM generation is labelled Generate New City in the Add Leg footer, on Dataset
and in both city searches, which prefill the searched name, including when fuzzy matches exist; an empty dataset filter
also offers it. Add another leg adds an existing-city row to the Add Leg dialog. The planner carries the nights and retains other selected cities.
New-city forms validate city identity and creation flags before clearing input or reporting success. Planner
acknowledgements must also confirm a saved leg for the requested city and exact nights. Incomplete responses retain
the draft with an error and advice to check saved data before retrying. Pending generation locks all draft controls.
The new-city leg flow also rejects fractional, nonpositive and unsafe nights before generation, retaining the input
with an associated validation message rather than truncating it.
Planner refresh failures retain the last loaded itinerary, cities, countries, costs and traveller count, labelled with
Retry. Required responses are checked together before replacing data; stale reads cannot replace newer results.
Saved-plan read failures retain and label the last loaded list with Retry. Valid empty reads remain distinct from failures.
Inline planner edits keep failed drafts with Retry and Discard. Writes for a leg are serialized and newer input remains
pending until confirmed. Cards preview unsaved changes while trip totals use saved data; plan save/export/import,
traveller changes, reordering and estimates wait for edits to settle. Failed automatic ordering after a status save is labelled separately.
Wise import confirmation preserves category changes from the preview, validates them against the selected files,
and keeps amounts from parsed transaction data. Selecting different files clears the previous preview.
Wise uploads validate supported headers, CSV structure, IDs, calendar dates, currency codes and finite amounts
before conversion or writes. Any invalid file rejects the entire batch with a file/row error; actual zero values
and valid empty exports remain distinct from missing or invalid input.

## Running the app locally

`npm run dev` is for editing code. It serves unminified development bundles — roughly 14 MB of JavaScript for `/`
against 263 kB in a production build — so it is not representative of how the app performs. Use it while changing
code, not while judging speed.

`npm run dev` runs `scripts/start-next-dev.mjs`, which starts `next dev` (arguments pass through) with
`AUTH_TRUST_HOST=true`, so NextAuth redirects to the port actually serving the page instead of the one named by
`NEXTAUTH_URL` in `.env.local`, for example a worktree's dev server on 3001. Before this, signing in on any other port
succeeded and then redirected to a port with nothing listening. Trusting the Host header is for local development
only and is never set for `npm start`. Auth form inputs adopt text typed before the page's JavaScript loaded (and
browser autofill), so Sign in and Enter dev mode enable without retyping on a slow first compile. Set `NEXT_DIST_DIR`
to give a second dev server its own build directory; two dev servers sharing `.next-dev` overwrite each other's chunks.
Such a directory contains junctions into `node_modules` (`dev/node_modules/argon2-*`, `better-sqlite3-*`): remove the
links with `rmdir` before deleting it. A fresh `next dev` also appends a Next.js agent-rules block to `AGENTS.md`;
revert it, because `AGENTS.md` is this project's memory and `CLAUDE.md` imports it.
A phone can use the dev server at the machine's LAN address (for example `http://192.168.x.x:3000`):
`next.config.mjs` lists private-network ranges in `allowedDevOrigins`. Without them Next 16 returns 403 for dev
resources requested from a non-localhost origin, and the page renders but never hydrates, so its buttons stay disabled.

Dashboard charts render without entry animation. Animated bars stay empty until the browser paints frames, which it
does not do for a background tab or hidden window, so a dashboard loaded that way after sign-in showed axes without
bars until the page was revisited.

`npm run serve` is for using the app: it builds and then starts. One command rather than two because `&&` is a
parser error in Windows PowerShell 5.1, which is the shell this project is developed in, and npm runs its own
scripts through a shell that accepts it. `npm run build` then `npm start` separately does the same thing. Build output goes to `.next`; the dev server writes to
`.next-dev`. Keeping the two directories separate matters: while they shared one, each wiped the other and forced a
full cold recompile, which surfaced as `ChunkLoadError: Loading chunk app/layout failed`.

Stop `npm start` from the terminal that owns it. `.next/standalone/server.js` `chdir()`s into its own directory, and
Windows locks a directory that is any process's working directory, so a surviving server blocks `next build` while it
cleans `.next`. `scripts/start-next-production.mjs` now stops its child when it exits, but that only helps when the
launcher gets to run: force-killing it, or killing the shell rather than the process tree, still leaves the server up.
The `prebuild` guard in `scripts/prepare-next-build.mjs` therefore probes the directory and fails immediately with an
explanation instead of letting the build hang with an empty log.

`npm run performance:check` measures the running app and requires credentials: set `WEBAPP_AUTH_EMAIL` and
`WEBAPP_AUTH_PASSWORD` against a production build, or `WEBAPP_AUTH_PIN` against a dev server with
`WEBAPP_REQUIRE_BUILD=false`. Without them it now fails rather than silently measuring the login page, which is what
invalidated the earlier Phase 7A numbers.

`npm run performance:browser` measures authenticated production content readiness and planner dialog response with
Playwright using the same email/password variables. It records compressed and decoded HTML sizes and browser API
request timing. Use an isolated database copy and a test account for repeatable comparisons. The HTTP check keeps a
512 KiB base HTML limit and adds 24 KiB per planner card; every card is present in the response, with bodies only
for open cards.

`npm start` sets `NODE_ENV=production`, which disables the development PIN in `src/lib/auth.ts`. Email/password
sign-in requires a password row and a verified email. Run `npm run auth:set-local-password` in a
real terminal for local credentials; it prompts for the password rather than accepting it as an argument, so the value
never reaches shell history or logs, and it applies the same strength rules as signup — at least ten characters, and
not all digits. Private container settings stay outside Next.js's automatic environment-file search path during local
development and builds.

## Production accounts and persistence

Registration is open to any email address. `AUTH_ADMIN_EMAILS` identifies accounts that may mutate the shared city/country library. Other accounts can read it
and maintain their own trips, expenses and plans. Signing in initializes preferences and never claims unowned records. Server
session checks enforce current database token versions; reset/change-password revoke prior sessions. Verification and
reset tokens are opaque, hashed, expiring and single-use; consumption and the protected write are atomic. A failed
verification-email delivery can be retried without replacing an existing account's password.
Verification requires the account password as well as the link, so registering someone else's address first does
not keep a password the mailbox owner did not choose; a completed reset also verifies the address. Signup answers the
same for every address, and sign-in for an unknown account spends one Argon2 verification. The proxy refuses `/api/*`
writes from another origin (Origin or Sec-Fetch-Site), because SameSite=Lax treats sibling subdomains as the same
site, and requires a signed token identifying a user. Production startup refuses server LLM keys.

Production runs one Node 24 container, with SQLite and licensed photos in the writable `runtime-data/` bind mount.
Startup checks configuration, database existence/integrity/nonempty library and all runtime prompts. `/api/health`
reports readiness without exposing identities or data. Only the trusted private proxy may supply `X-Real-IP`; arbitrary
forwarded address lists are ignored. Fonts are bundled locally. Security headers come from `scripts/lib/security-headers.mjs`
through `next.config.mjs` (CSP with inline scripts allowed because Next renders them without nonces, framing denied,
HSTS in production). Runtime prompt files are listed once in `scripts/lib/runtime-prompts.mjs`, which the build,
Dockerfile, start script and container entrypoint follow.

`scripts/data-snapshot.ts` creates verified full or catalogue-only database/photo packages. Full owner provisioning
changes credentials only in the deployment copy and retains ownership IDs and personal records. The original local
database remains intact. `scripts/backup.mjs` creates and verifies consistent backups and restores only into a new
directory. Private packages and deployment settings are gitignored and excluded from Docker build contexts. See
`docs/ops/production-launch.md` for the launch, email, proxy and backup contract. Linux container verification is
defined in `.github/workflows/production-checks.yml`; local Windows checks do not establish Linux or public-host success.
On `main` that workflow publishes the tested runner image to public `ghcr.io/mwilczynska/holiday-spend` (`:main`,
`:sha-<commit>`), which Compose pulls; the host is too small to build it.
Live since 20 October 2026 at `https://spend.projectinfinitesummer.com`, behind a shared edge proxy over the external
`edge` Docker network. A separate private infrastructure repository owns the host, proxy and scheduled backups.

## City-cost and transport accuracy research

City-cost accuracy was measured and improved by an owner-commissioned research program in October 2026, which produced
v1.2. Its data, harness and decisions live on the `research/city-cost-accuracy` branch; `docs/research/city-cost-accuracy.md`
summarises the results and explains how to continue. New measurement work belongs on that branch, under its fixed
acceptance rule, and only when the owner asks for it. Do not mix research tooling or data into `main`.

The held-out cities have been read four times; use them again only to confirm a candidate that has already won on the
development cities.

Transport accuracy remains directional: the 5 September 2026 check covered three routes. Prompt v1.1 for transport
was worth making because the contract failed to say which fare to return, and stating it moved the median relative
error from 25.0% to 2.5%. Re-measure city costs and transport when the prompt, provider or model changes, following
`docs/research/city-cost-accuracy.md` and `docs/product/transport-estimation.md`.

## Conventions and verification

Please remove all mannered prose.

- Commit and push after each sizeable chunk and milestone.
- Update `docs/dev/PLAN.md` at task start/end and before every commit or push.
- Record superseded decisions as dated history; do not erase reasoning.
- Fail closed. Unsupported values remain missing rather than becoming plausible substitutes.
- A modelled value must not be presented as an observed source price.
- Do not put provider API keys in the repository, logs or database.

The active baseline is:

```
npx tsc --noEmit
npm run build
npm test -- --run
npm run methodology:v1.1:check
```

The v6-specific checks and experiments remain runnable only from the archived v6 branch for historical replay.

## Worktrees and local caches

Personal, machine-specific notes (local paths, the deployment host, editor and browser tooling) live in each
developer's user-level agent memory, not in this repository.

Never create git worktrees or database backups inside the checkout: `tsconfig.json`, Vitest and the Next.js watcher
would scan them. Create them beside it. A worktree's `node_modules` is usually a junction to the main checkout's
`node_modules`, and `next build` in a worktree adds a second one at `.next\standalone\node_modules`. Unlink every
junction (delete the link only) before deleting a worktree; a recursive delete that follows one empties the main
checkout's packages. Remove finished worktrees after their branch merges.

`npm run dev` runs `scripts/prepare-next-dev.mjs`, which removes a cloud-sync reparse-point `.next-dev` cache and pins
the gitignored SQLite files if a sync client has dehydrated them. On an unsynced path it does nothing. A dehydrated
`.next` once caused Next cleanup failures and an apparently hung first compilation; if that recurs, check whether the
checkout is under a synced folder before diagnosing anything else.

## Key files

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Project memory; `CLAUDE.md` is a one-line import of it |
| `docs/dev/PLAN.md` | Active v1.2 rollout checklist |
| `docs/product/city-cost-methodology.md` | Current city-cost methodology, mirrored by the `/estimates` page |
| `docs/prompts/llm_prompt_new_cities_1.md` | Frozen v1 rollback prompt |
| `docs/prompts/llm_prompt_new_cities_v1_2.md` | v1.2 prompt: v1.1 plus up to five food and drink searches |
| `docs/prompts/llm_prompt_new_cities_v1_1.md` | v1.1 prompt for holistic anchors plus a current RBA FX observation; tiers and conversion stay server-side |
| `src/lib/city-cost-methodology-v1-2.ts` | v1.2 correction lookup and materialization |
| `src/lib/data/city-cost-corrections-v1-2.json` | v1.2 correction table (built on the research branch) |
| `src/lib/city-cost-fx-refresh.ts` | Exchange-rate refresh from stored USD anchors (ECB cross rate) |
| `src/lib/city-cost-methodology-v1-1.ts` | v1.1 schema, fresh-FX validation/inversion and formula-preserving materializer |
| `src/lib/city-generation.ts` | v1/v1.1/v1.2 generation dispatch and schema validation |
| `src/lib/city-generation-service.ts` | Estimate persistence and city updates |
| `src/lib/city-generation-persistence.ts` | Explicit v1/v1.1/v1.2 database persistence adapter |
| `src/lib/city-estimate-provenance.ts` | Generic API provenance parser, including historical v6 records |
| `src/lib/llm-provider-registry.ts` | Provider endpoints, web search, effort parameters and server key names |
| `src/lib/city-llm-client.ts` | Provider JSON-completion transports for every registry transport |
| `src/lib/provider-model-discovery.ts` | Provider model discovery |
| `src/lib/city-cost-v1-1-guard.ts` | Refuses any v1.1 output write targeting the live v1 CSV |
| `scripts/check-city-cost-v1-1.ts` | Deterministic formula, FX, output-safety and live-CSV integrity check |
| `src/lib/country-metadata.ts` | Canonical country identity and defaults |
| `data/reference/city_costs_app_aud.csv` | Live 121-city v1 dataset |
| `feat/city-cost-methodology-v6` | Retained v6 research branch; not a current product path |

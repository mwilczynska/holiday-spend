# Holiday Spend

Canonical project memory. `AGENTS.md` must stay a byte-for-byte mirror — after editing this file run
`npm run docs:sync-memory`, and verify with `npm run docs:check-memory`.

This file describes what the project is and currently does. It is deliberately free of change history.

| For | Read |
| --- | --- |
| What is planned next, milestone status, open decisions | **[PLAN.md](PLAN.md)** |
| What was built, what was tried, and what the evidence showed | **[LOG.md](LOG.md)** |
| Active city-cost implementation plan | **[PLAN.md](PLAN.md)** |
| Cold-start handoff and exact next action | `docs/dev/handoffs/city-cost-v1-1.md` |
| Active city-cost loop | `LOOP-PROMPT-V1-1.md` |
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

- one web-enabled LLM call returns the same ten USD anchors plus the latest dated RBA USD/AUD observation;
- the LLM returns no derived tiers, AUD values, or conversion arithmetic;
- deterministic server code validates and, when necessary, inverts the recent RBA observation, then applies the exact
  v1 formulas and USD→AUD conversion;
- anchors, provider/model, reasoning effort, prompt/formula versions, confidence and FX provenance are persisted;
- no grades or intervals are fabricated for holistic model estimates;
- v1 remains an explicit rollback through `CITY_COST_METHODOLOGY_VERSION=v1`;
- `CITY_COST_METHODOLOGY_V6=true` must never activate v6.1.

v1.1 does not rewrite the 121-city CSV, access a holdout, collect a methodology panel, fit coefficients, or
bulk-migrate existing cities. It is the default for new cities. The Tottori, Toowoomba, and Brno owner-key smoke
passed on 26 August 2026 with OpenAI `gpt-5.6-luna`, reasoning `max`, and dated RBA FX provenance.

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
the source model is saved and only that city's prior record is invalidated. Saved monthly weather and provenance
live in SQLite. City collection/generation and refresh also collect weather; routine
planner loads read saved records in one request. Existing cities collect once when needed. Provider failures remain
missing, or retain an explicitly labelled prior successful record after a failed refresh. All itinerary cards render;
the former twelve-card limit and load-more controls are removed. The trip chart waits for its initial data load to
settle rather than drawing incomplete lines repeatedly. See `docs/product/trip-climate.md` for the data contract.

## City images

Destinations currently show a drawn scene chosen deterministically from the city name. The sidebar logo cross-fades
four drawn scenes (mountains, beach, plains, city), showing only the mountains under reduced motion.

Free photos come from Wikipedia/Wikimedia Commons with no key and no LLM. `src/lib/city-image-lookup.ts` searches for
the article, accepts it only within 50 km of the city's geocoded coordinates, and returns a freely licensed Commons
image with its credit data, falling back to Wikidata's image; otherwise it returns a miss. It is not yet wired into
city creation or display. `scripts/check-city-image-lookup.ts` is a read-only live check through the app's own
geocoding. See `docs/product/city-images.md`.

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

OpenAI defaults to `gpt-6-luna` with `max` reasoning. Stored selections of the previous `gpt-5.6-luna` default migrate
to it; other custom model choices are retained. A failed or empty keyed model-list response tries the no-key
aggregators before the saved snapshot, with account availability explicitly unverified. Discovery requests have
15-second timeouts, and failed keyed reads are not cached.

Generation and model-refresh errors include HTTP/provider details and retry guidance, with credentials redacted.
Invalid city output identifies missing or invalid fields; failed RBA validation gives its reason and saves no estimate.
Network failures and unreadable server responses have separate messages; generation forms remain available for retry.

Provider keys use one opt-in browser store shared by city generation, CSV-import generation and both transport
dialogs. Saved changes and clearing synchronize across open windows in the same browser profile and origin.
Existing saved feature keys migrate once. Unchecking saving removes persisted keys while retaining them for the
current window's session; unsaved keys are shared between its dialogs. Provider/model preferences remain separate.
Unsaved keys survive successful city saves, dialog changes and client navigation in that window. A full page
reload starts a new session and drops them.
Provider key fields have associated visible labels in city, transport and planner import forms; the existing-city editor's
Show API key switch is labelled and its label toggles the control.

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
estimates record the effort that produced the answer. v1.1 never drops its required current-FX search.

Every transport path, including non-search and strict JSON retries, uses the configured limits; none imposes a
separate small answer cap. Bulk transport has a Stop control that aborts active requests and prevents queued legs
from starting. Cancelled legs are labelled separately from failures, and completed results remain available to apply.
Failed legs can be retried together without discarding completed estimates or rerunning successful legs.

## Product behavior

The Methodology page describes the active v1.1 anchor estimates, dated RBA conversion, preserved tier formulas,
traveller scaling and limitations. Retired source-collection methods are identified as historical.
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
leg. Its cards are memoized so unrelated dialog and header updates do not rerender the full itinerary.

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
512 KiB base HTML limit and adds 24 KiB per fully rendered planner card; all cards are present in the response.

`npm start` sets `NODE_ENV=production`, which disables the development PIN in `src/lib/auth.ts`. All existing
itinerary, expense and saved-plan rows belong to `dev-local-user`, which has no password row and an unverified email,
so email/password sign-in is refused for it until both are set. Run `npm run auth:set-local-password` in a real
terminal to fix that; it prompts for the password rather than accepting it as an argument, so the value never reaches
shell history or logs, and it applies the same strength rules as signup — at least ten characters, and not all digits.

## Methodology testing is closed

City-cost and transport accuracy are accepted as reasonably accurate and not fully methodologically tested. That is a
deliberate trade. Do not open new calibration, holdout, panel-collection or tolerance-setting work, and do not treat
the recorded limitations as a backlog.

The record supports this. `docs/prompts/README.md` lists v5 experiments 085 to 094 as rejected, v6 and v6.1 are
archived as rejected approaches retained only for audit, and the 5 September 2026 transport accuracy check is
explicitly directional at three routes. Calibration work has a poor return here relative to its cost.

The distinction that matters: fixing a **specification** defect is in scope, and fixing a **calibration** gap is not.
Prompt v1.1 was worth making because the contract genuinely failed to say which fare to return, and stating it moved
the median relative error from 25.0% to 2.5%. Chasing a tolerance on top of that is the activity to avoid.

Re-measure when the prompt, provider or model changes, not on a schedule, and follow
`docs/product/transport-estimation.md`.

## Conventions and verification

Please remove all mannered prose.

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
npm run methodology:v1.1:check
```

The v6-specific checks and experiments remain runnable only from the archived v6 branch for historical replay.

## Browser access by Codex surface

This repository is worked on from both the ChatGPT/Codex desktop app and Codex CLI. Browser control is
surface-specific; do not treat the two paths as interchangeable.

### ChatGPT/Codex desktop app

- Prefer the bundled in-app Browser (`iab`) for local web-app testing. Open its panel from the app toolbar or with
  `Ctrl+Shift+B`, then use the Browser plugin through the Node REPL. It has its own profile and is not the user's
  normal Chrome session.
- Use the Chrome plugin only when the task needs the user's existing Chrome tabs, profile, login state, or
  extensions. That path depends on the Codex/ChatGPT Chrome extension and its native-host bridge.
- A page loading and remaining visible in the in-app Browser proves that the browser surface and webapp are
  working; it does not prove that Codex automation can attach to the tab. In-app and Chrome automation both pass
  through the same Browser RPC bootstrap in the desktop app.
- An error saying `Trusted RPC dependency must resolve within a configured trusted code path` occurs before tab
  discovery. It is a Codex launch-time automation configuration failure, not an application, website,
  authentication, CDP-setting, Chrome-extension, or native-host failure. Do not keep retrying either browser,
  alter Chrome, or claim that a manually visible page was not tested.
- If a full app restart reproduces the same error in both in-app Browser and Chrome, stop local repair attempts and
  treat it as a desktop-app/plugin-build defect. Manual edits to generated `config.toml` trust paths are overwritten
  at startup and recycling the Node REPL or background app-server can close the task or crash the desktop app.
  Update Codex when a newer build is available; otherwise report the exact error and app/plugin versions to OpenAI
  Support. Manual browser inspection and HTTP checks may be recorded separately, but must not be presented as
  automated control.

### Codex CLI

- The CLI has no in-app Browser panel. For an interactive browser test, use the Chrome plugin with the
  Codex/ChatGPT Chrome extension and follow the active `control-chrome` skill exactly.
- Launch the CLI with `NODE_REPL_TRUSTED_CODE_PATHS` containing the exact active Browser/Chrome plugin `scripts`
  path and the active bundled CUA Node `node_modules` path. Use the versions currently installed under
  `~/.codex/plugins/cache/` and the Codex runtime; do not copy a stale version number from project documentation.
- If the same trusted-RPC error occurs, the current CLI process did not receive the effective launch override.
  Exit it and start a fresh CLI process with the corrected paths. Do not repair the Chrome extension, registry, or
  native host unless the plugin's own native-host diagnostic explicitly reports a failure.

For either surface, first confirm the local server responds at its expected `localhost` URL. Never inspect browser
storage, cookies, saved passwords, or provider API keys, and do not substitute a shell-opened page or HTTP-only
check for a requested interactive browser test.

## Repository location and the retired OneDrive guard

The working repository is `C:\Dev\holiday-spend`, which is **not** inside OneDrive (`C:\Users\chawi\OneDrive`).
Verified on 3 September 2026: `.next`, `.next-dev`, `data/` and `data/travel.db` are ordinary entries with no reparse
points. Earlier guidance in this file described the repository as living inside OneDrive and is superseded.

An orphaned pre-move copy still exists at `C:\Users\chawi\OneDrive\projects\holiday-spend`. It has no `.git`
directory and its `scripts` directory is a dehydrated cloud reparse point. Do not open or run it; it is not the
working tree and would reproduce the historical Files-On-Demand failures.

`npm run dev` still runs `scripts/prepare-next-dev.mjs`, which removes a reparse-point `.next-dev` cache and pins the
gitignored SQLite files if they are ever dehydrated. On the current path it finds nothing to do. It is retained
because it is cheap and harmless, and because it would matter again if the repository moved back under a synced root.

The historical failure it guards against was real: a dehydrated `.next` caused Next cleanup failures and an
apparently hung first compilation, with a dev process consuming roughly 1.2 GB without completing a request. If
anything resembling that recurs, confirm whether the path is under a synced root before diagnosing the browser,
authentication, or methodology.

## Key files

| Path | Purpose |
| --- | --- |
| `PLAN.md` | Active v1.1 implementation and rollout checklist |
| `docs/prompts/llm_prompt_new_cities_1.md` | Frozen v1 rollback prompt |
| `docs/prompts/llm_prompt_new_cities_v1_1.md` | v1.1 prompt for holistic anchors plus a current RBA FX observation; tiers and conversion stay server-side |
| `src/lib/city-cost-methodology-v1-1.ts` | v1.1 schema, fresh-FX validation/inversion and formula-preserving materializer |
| `src/lib/city-generation.ts` | v1/v1.1 generation dispatch and schema validation |
| `src/lib/city-generation-service.ts` | Estimate persistence and city updates |
| `src/lib/city-generation-persistence.ts` | Explicit v1/v1.1 database persistence adapter |
| `src/lib/city-estimate-provenance.ts` | Generic API provenance parser, including historical v6 records |
| `src/lib/city-llm-client.ts` | Provider JSON-completion transports |
| `src/lib/provider-model-discovery.ts` | Provider model discovery |
| `src/lib/city-cost-v1-1-guard.ts` | Refuses any v1.1 output write targeting the live v1 CSV |
| `scripts/check-city-cost-v1-1.ts` | Deterministic formula, FX, output-safety and live-CSV integrity check |
| `src/lib/country-metadata.ts` | Canonical country identity and defaults |
| `data/reference/city_costs_app_aud.csv` | Live 121-city v1 dataset |
| `feat/city-cost-methodology-v6` | Retained v6 research branch; not a current product path |

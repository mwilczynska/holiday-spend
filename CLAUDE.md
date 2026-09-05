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

## Provider request limits

Two limits bound every provider call, configurable per user under **Settings → Provider Request Limits**, and
overridable by `LLM_MAX_OUTPUT_TOKENS` and `LLM_REQUEST_TIMEOUT_MS`. Precedence is the user setting, then the
environment, then the defaults in `src/lib/llm-runtime-settings.ts` (64,000 output tokens, 300-second timeout). A null
column means "follow the default", so raising a default reaches everyone who has not deliberately overridden it.

Neither limit is a budget. Providers bill reasoning tokens against `max_output_tokens` as they are generated, so a
high cap costs nothing until a request needs it, while a cap that binds part-way through is paid for in full and the
answer discarded. Both defaults therefore sit far above the observed working range, and the caps exist to stop a
request that has gone wrong.

When an OpenAI call is truncated mid-reasoning, the grounded call is retried one rung down the effort ladder
(`max`, `xhigh`, `high`) before web search is abandoned: running out of room to answer is a reason to think less, not
to stop searching. Every call logs its token usage, so the defaults can be revisited from evidence.

## Product behavior

Accommodation tiers are hostel dorm, private room, and 1–4 star. Drinks are none, light, moderate and heavy.
Traveller count persists per user, while city base costs remain stored for two people. Saved plans store tier
choices rather than frozen city prices.

`/plan/compare` uses one canonical server-side allocation engine for summary totals, cumulative series and country
and category groupings. Manual transport remains separate.

Expense tracking supports CRUD, tagging, exclusion, reassignment, bulk operations, and Wise CSV imports. Dashboard
spending is constrained to the trip window and missing AUD conversions are excluded rather than treated as zero.

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

`npm start` sets `NODE_ENV=production`, which disables the development PIN in `src/lib/auth.ts`. All existing
itinerary, expense and saved-plan rows belong to `dev-local-user`, which has no password row and an unverified email,
so email/password sign-in is refused for it until both are set. Run `npm run auth:set-local-password` in a real
terminal to fix that; it prompts for the password rather than accepting it as an argument, so the value never reaches
shell history or logs, and it applies the same strength rules as signup — at least ten characters, and not all digits.

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

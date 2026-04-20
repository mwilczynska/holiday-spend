# Live LLM Model Discovery - Implementation Plan

> **Branch**: `feat/live-model-discovery` off `main`
> **PR target**: `main`
> **Status**: COMPLETE - implemented, verified, and ready for review
> **Related**:
> - `src/lib/city-generation-config.ts`
> - `src/components/cities/CityGenerationPanel.tsx`
> - `src/components/itinerary/PlannerNewCityDialog.tsx`
> - `src/components/itinerary/TransportEstimateDialog.tsx`
> - `src/components/itinerary/BulkTransportEstimateDialog.tsx`
> - `src/app/plan/page.tsx`

---

## Context

The app currently shows provider-specific example model ids in multiple LLM picker UIs, but those examples are repo-managed:

- dataset city generation
- planner add-city generation
- snapshot import generation
- single-leg transport estimation
- bulk transport estimation

The current setup is already safe in one important way:

- users can type custom model ids
- unknown model ids are allowed with a warning
- old browser-stored defaults are migrated forward

But the example lists themselves can still become stale because:

- there is no live provider model discovery
- there is no automatic fetch from provider model APIs
- there is no periodic refresh path

This workstream should make the UI fresher without turning model selection into a heavyweight subsystem.

---

## Design Anchors

- **Prefer provider APIs over scraping docs.** OpenAI, Anthropic, and Gemini already expose model-listing endpoints; use those as the primary live source.
- **Keep the current curated defaults.** The repo should still own recommended defaults and fallback suggestions even when live discovery fails.
- **Do not block custom model ids.** Live discovery should improve freshness, not hard-restrict the user.
- **Centralize discovery logic.** One shared server-side discovery layer and one shared client-side consumption pattern should power all picker UIs.
- **Use lightweight caching.** On-demand refresh plus TTL caching is enough for this app; no scheduled sync job is required for phase 1.
- **Keep auth and key handling consistent.** Discovery should accept browser-provided API keys when present, or fall back to server env keys, matching current generation behavior.

---

## Goals

By the end of this workstream:

- every LLM picker can request a fresh provider model list from the server
- every picker shows the same live/fallback status treatment
- curated defaults remain available as safe fallback examples
- users can manually refresh discovered model lists on demand
- stale example risk is materially reduced without adding background jobs

---

## Recommended Approach

Implement one shared server route and one shared client helper:

- server route:
  - `GET /api/llm/models?provider=...`
  - optional browser API key supplied in a header
  - provider-specific adapters:
    - OpenAI: `GET /v1/models`
    - Anthropic: `GET /v1/models`
    - Gemini: `GET /v1beta/models`
- shared cache:
  - in-memory TTL cache keyed by provider plus API-key fingerprint/source
  - short-lived enough to stay fresh, long-lived enough to avoid noisy repeated requests
- client integration:
  - use discovered models when available
  - fall back to curated repo-owned models when discovery fails
  - keep the input editable and validated as before
  - expose a small `Refresh models` action and live/fallback status copy

This keeps the system lightweight while still eliminating most stale-example drift.

---

## Task Tracker

Use this as the primary handoff/resume checklist for the branch.

- [x] Phase 0 - Create implementation plan and branch scaffold
- [x] Phase 0a - Lock the lightweight architecture: provider APIs + TTL cache + curated fallback
- [x] Phase 0b - Create branch and planning doc
- [x] Phase 1 - Add shared live model discovery server layer
- [x] Phase 1a - Add normalized provider model types and filtering helpers
- [x] Phase 1b - Add provider-specific fetch adapters for OpenAI, Anthropic, and Gemini
- [x] Phase 1c - Add cache and fallback shaping so consumers always receive a usable response
- [x] Phase 2 - Expose discovery through one authenticated app route
- [x] Phase 2a - Add `GET /api/llm/models`
- [x] Phase 2b - Support browser key override plus server env fallback
- [x] Phase 2c - Return normalized model metadata plus source/status fields for the UI
- [x] Phase 3 - Integrate live discovery into all LLM pickers
- [x] Phase 3a - Dataset city-generation panel uses live discovery with fallback
- [x] Phase 3b - Planner add-city dialog uses live discovery with fallback
- [x] Phase 3c - Snapshot import generation settings use live discovery with fallback
- [x] Phase 3d - Single-leg transport estimation uses live discovery with fallback
- [x] Phase 3e - Bulk transport estimation uses live discovery with fallback
- [x] Phase 3f - Add a consistent status line and `Refresh models` control everywhere
- [x] Phase 4 - Test and verify the discovery flow
- [x] Phase 4a - Add unit coverage for normalization/filtering and cache behavior where isolated
- [x] Phase 4b - Verify TypeScript and any targeted tests
- [x] Phase 4c - Run a manual or scripted UI pass over the affected dialogs/pages
- [x] Phase 5 - Finalize docs and PR
- [x] Phase 5a - Update this tracker with completed work
- [x] Phase 5b - Refresh project memory if the shipped behavior meaningfully changes user-facing model selection
- [x] Phase 5c - Push branch and open/update the implementation PR

---

## Phase Details

### Phase 1 - Shared discovery server layer

Build the provider-facing logic in one shared lib so route code stays thin.

Expected outputs:

- normalized model shape
- provider adapters
- cache wrapper
- conservative filtering rules so model suggestions stay useful instead of dumping every provider artifact into the UI

### Phase 2 - API route

Add one authenticated route that returns:

- discovered model ids
- curated fallback model ids
- effective list used by the UI
- metadata such as:
  - `source: live | fallback`
  - `fetchedAt`
  - `cacheHit`
  - `warning`

### Phase 3 - UI integration

Every current LLM picker should consume the same pattern:

- editable model input
- curated quick-pick buttons
- live discovered suggestions/datalist
- discovery status copy
- refresh button
- fallback behavior when live discovery is unavailable

### Phase 4 - Verification

At minimum:

- `npx tsc --noEmit`
- targeted unit coverage for the new shared model-discovery logic
- a UI pass across all LLM picker surfaces

Completed verification:

- `npx tsc --noEmit`
- `cmd /c npm test -- provider-model-discovery city-generation-config`
- scripted Playwright pass against:
  - `/dataset` city generation
  - `/plan` add-leg new-city dialog
  - `/plan` single-leg transport estimation dialog
  - `/plan` bulk transport estimation dialog
  - `/plan` snapshot import generation settings

### Phase 5 - Docs and PR

Document:

- why provider APIs are the live source
- why curated defaults remain in-repo
- why periodic sync is intentionally deferred in favor of on-demand refresh plus TTL cache

---

## Post-Implementation Research - No-Key Discovery

This branch now supports live provider discovery when a valid browser API key or server-side env key is available.

After shipping that work, we investigated whether Anthropic and Gemini expose an **official no-key route** that could be used when neither key source is present.

### Research Question

Can Wanderledger fetch a fresh list of latest Anthropic and Gemini models **without** requiring a live provider API key?

### Findings

- **Anthropic**:
  - The official Models API remains the best live source when a key is available:
    - `GET https://api.anthropic.com/v1/models`
  - Anthropic documents `x-api-key` as required for that endpoint.
  - We did **not** identify an official unauthenticated Anthropic model-list API.
  - Anthropic does publish public model information on docs pages that do not require authentication.

- **Gemini**:
  - The official live source when a key is available remains:
    - `GET https://generativelanguage.googleapis.com/v1beta/models`
  - We did **not** identify an official unauthenticated Gemini model-list API.
  - Google does publish public Gemini model information on docs pages and changelogs that do not require authentication.

- **Conclusion**:
  - For Anthropic and Gemini, the realistic no-key path is **public-docs fallback**, not an unauthenticated live models API.

### Viable No-Key Sources

- **Anthropic public docs**
  - Models overview page:
    - public model families, API ids, aliases, and current comparison tables
  - API release notes:
    - launches and model changes
  - Model deprecations page:
    - retirements and migration guidance

- **Gemini public docs**
  - Gemini models page:
    - public naming patterns, current families, stable/preview/latest conventions
  - Gemini changelog:
    - launches, deprecations, shutdowns, and alias movement

### Notable Examples Observed During Research

- **Anthropic**
  - Public Anthropic docs currently show current API ids such as:
    - `claude-opus-4-7`
    - `claude-sonnet-4-6`
    - `claude-haiku-4-5`
  - Anthropic’s public docs also expose aliases alongside API ids on the models overview page.

- **Gemini**
  - Gemini public docs explicitly document `latest` aliases such as:
    - `gemini-flash-latest`
  - Gemini’s public docs and changelog also show stable ids and release/deprecation movement, for example around:
    - `gemini-2.5-pro`
    - `gemini-2.5-flash`
    - `gemini-2.5-flash-lite`

### Possible Future Paths

These are intentionally **not yet chosen**. They are the plausible next options for follow-up work:

- **Option A - Keep the current implementation only**
  - Continue using provider APIs when a key is available.
  - Keep curated repo-owned fallback suggestions when no key is available.

- **Option B - Add docs-based fallback for no-key discovery**
  - Keep provider APIs as the primary source.
  - Add a server-side docs parser for official public Anthropic and Gemini docs.
  - Use docs-derived models when no provider key is available.
  - Fall back to curated repo-owned defaults only if the docs parser fails.

- **Option C - Use more alias-heavy curated defaults**
  - Keep the current architecture.
  - Refresh the curated fallback list to prefer stable public aliases where available, especially for Gemini.
  - This reduces staleness somewhat without adding docs parsing.

### Current Recommendation

If we decide to improve the no-key experience later, the strongest next step is:

- keep provider APIs as the primary source of truth
- add a docs-derived fallback for no-key Anthropic and Gemini discovery
- cache docs-derived results server-side
- keep curated repo-owned suggestions as the final safety net

### Decision Status

- No implementation decision has been made yet for the no-key path.
- The current branch remains valid and complete as shipped.
- Any docs-based fallback should be treated as a separate follow-up decision/workstream.

### Research Sources

- Anthropic Models overview:
  - `https://platform.claude.com/docs/en/about-claude/models/overview`
- Anthropic Release notes:
  - `https://platform.claude.com/docs/en/release-notes/overview`
- Anthropic Model deprecations:
  - `https://docs.anthropic.com/en/docs/about-claude/model-deprecations`
- Anthropic Models API docs:
  - `https://docs.anthropic.com/en/api/models-list`
- Gemini models guide:
  - `https://ai.google.dev/gemini-api/docs/models`
- Gemini changelog:
  - `https://ai.google.dev/gemini-api/docs/changelog`
- Gemini models API reference:
  - `https://ai.google.dev/api/rest/generativelanguage/models/list`

---

## Follow-Up Workstream - No-Key Aggregator Discovery + Self-Refreshing Fallback

> **Status**: Planned - not yet implemented
> **Decision date**: 2026-04-20
> **Branch target**: continues on `feat/live-model-discovery` (or a follow-up branch if scope grows)

### Decision

Adopt a **three-tier discovery pipeline** and stop treating the in-repo curated list as a hand-edited literal. The curated fallback becomes a generated artifact that is periodically refreshed from live aggregator data, so even the no-live-fetch path stays fresh.

### Discovery Tiers

1. **Tier 1 - Live provider API** (unchanged)
   - Used when a browser-supplied API key or server env key is available.
   - Hits OpenAI/Anthropic/Gemini endpoints as today.
   - `source: 'live'`.

2. **Tier 2 - No-key aggregator fetch** (new)
   - Used when no credential is available.
   - Runtime fetch to OpenRouter `https://openrouter.ai/api/v1/models` as primary.
   - Runtime fetch to models.dev `https://models.dev/api.json` as secondary on OpenRouter failure.
   - Responses are split by provider prefix (`openai/`, `anthropic/`, `google/`) and passed through the existing `isLikelyOpenAiGenerationModel`-style filters.
   - Cached in the existing `modelDiscoveryCache` keyed by `credentialSource: 'none'`.
   - `source: 'aggregated'`.

3. **Tier 3 - Self-refreshing snapshot** (replaces current hand-edited curated list)
   - Committed JSON artifact at `src/lib/data/curated-models.generated.json`.
   - Refreshed by a repo script (`scripts/refresh-curated-models.ts`) that pulls from the same aggregator sources and writes filtered per-provider lists.
   - `city-generation-config.ts` reads this JSON instead of owning hardcoded arrays.
   - Used only when both Tier 1 and Tier 2 fail.
   - `source: 'fallback'`.

This keeps the UI contract stable - `source` still distinguishes how fresh the suggestions are, the TTL cache is unchanged, and custom model ids remain allowed.

### Design Anchors

- **Aggregators preferred over doc scraping.** OpenRouter and models.dev cover all three providers with one fetch each; scraping docs pages is fragile and provider-by-provider.
- **Two aggregator sources, not one.** OpenRouter primary for freshness, models.dev secondary because it is MIT-licensed and can be vendored.
- **Fallback is generated, not hand-edited.** The curated list is refreshed by script so it cannot drift independently of reality.
- **Runtime and snapshot share filters.** The same "is this a usable generation model" predicate gates both the aggregator response and the snapshot output, so the tiers never disagree about what counts.
- **No change to the UI contract.** Pickers keep using `effectiveModels`, `source`, `warning`. Only the status copy extends.
- **Scripted refresh, not scheduled.** Snapshot refresh is a manual/CI-triggered script, not a cron job. Keeps infra footprint at zero.

### Goals

By the end of this workstream:

- users without a provider API key see live-aggregated model lists rather than hand-edited defaults
- the in-repo fallback list is a generated artifact refreshed from aggregator data
- three-tier source status is visible in every picker (`live` / `aggregated` / `fallback`)
- aggregator failures degrade cleanly into the generated snapshot
- snapshot refresh is one `npm run` script, not a manual JSON edit

### Task Tracker

- [x] Phase A - No-key aggregator discovery layer
- [x] Phase A1 - Add OpenRouter adapter: fetch, split by provider prefix, strip `vendor/`, reuse existing filters
- [x] Phase A2 - Add models.dev adapter as secondary aggregator
- [x] Phase A3 - Add `fetchAggregatedProviderModelIds(provider)` that tries OpenRouter then models.dev
- [x] Phase A4 - Extend `ProviderModelDiscoverySource` union to include `'aggregated'` and add `aggregatorSource` to `ProviderModelDiscoveryResult`
- [x] Phase A5 - Rewire `discoverProviderModels` no-credential branch to call the aggregator before falling through to curated fallback
- [x] Phase A6 - Keep TTL cache intact; `credentialSource: 'none'` entries now participate in the same cache
- [ ] Phase B - Self-refreshing curated fallback snapshot
- [ ] Phase B1 - Add `src/lib/data/curated-models.generated.json` schema (per-provider arrays plus `generatedAt`, `sources`)
- [ ] Phase B2 - Add `scripts/refresh-curated-models.ts` that fetches aggregator sources, applies the same filters, and writes the JSON
- [ ] Phase B3 - Add `npm run models:refresh` entry to `package.json`
- [ ] Phase B4 - Update `city-generation-config.ts` to import `CITY_GENERATION_KNOWN_MODELS` from the generated JSON
- [ ] Phase B5 - Add a `models:check` dry-run mode so CI can detect when the snapshot is stale without rewriting it
- [ ] Phase B6 - Run the refresh script once and commit the initial snapshot
- [ ] Phase C - UI integration for the new source tier
- [ ] Phase C1 - Extend the shared status line copy to cover `source === 'aggregated'` (e.g. "Suggestions from OpenRouter")
- [ ] Phase C2 - Update warnings so users understand when Tier 2 was used vs Tier 3 snapshot
- [ ] Phase C3 - Confirm all five picker surfaces render the new status line correctly
- [ ] Phase D - Tests and verification
- [ ] Phase D1 - Unit tests for OpenRouter response normalization (provider split, prefix stripping, filter reuse)
- [ ] Phase D2 - Unit tests for models.dev response normalization
- [ ] Phase D3 - Unit test for aggregator fallthrough (OpenRouter error -> models.dev)
- [ ] Phase D4 - Unit test for `discoverProviderModels` no-credential path producing `source: 'aggregated'`
- [ ] Phase D5 - Snapshot integrity test: generated JSON parses, contains at least one id per provider, all ids pass the runtime filter
- [ ] Phase D6 - `npx tsc --noEmit`
- [ ] Phase D7 - Targeted test run: `npm test -- provider-model-discovery city-generation-config curated-models`
- [ ] Phase D8 - Manual UI pass over the five picker surfaces with no provider env keys set
- [ ] Phase E - Docs, memory, and PR
- [ ] Phase E1 - Update this tracker
- [ ] Phase E2 - Update `CLAUDE.md` "Provider-Specific Reliability Fixes" and "City Cost / LLM Workflow" sections to reflect the three-tier pipeline and generated snapshot
- [ ] Phase E3 - Add a short "Refreshing model suggestions" note to `docs/dev/README.md` or similar so future contributors know how to run `npm run models:refresh`
- [ ] Phase E4 - Push branch and open/update PR

### Checkpoints

Commit and push at each checkpoint so the PR stays incremental:

- **Checkpoint 1** - after Phase A: aggregator discovery layer lands, covered by unit tests. No UI change yet; `discoverProviderModels` returns `source: 'aggregated'` when no key is present.
- **Checkpoint 2** - after Phase B: curated fallback is now a generated artifact. First snapshot committed. `city-generation-config.ts` reads from it. Runtime behavior unchanged from Checkpoint 1 because Tier 2 still handles the no-key path; snapshot only kicks in on aggregator failure.
- **Checkpoint 3** - after Phase C: all five picker surfaces show the new three-tier status copy.
- **Checkpoint 4** - after Phase D: full test pass plus manual UI sweep.
- **Checkpoint 5** - after Phase E: docs, memory, PR ready for review.

### Phase Details

#### Phase A - Aggregator discovery

The key seam is `src/lib/provider-model-discovery.ts:337` where `!credential.apiKey` currently short-circuits to `buildFallbackDiscoveryResult`. Replace that branch with a call into a new `fetchAggregatedProviderModelIds(provider)` helper that tries OpenRouter, then models.dev, then rethrows. The outer `try/catch` already catches into the fallback path, so aggregator failure still degrades into Tier 3 cleanly.

OpenRouter response shape: `{data: [{id: 'openai/gpt-5.4-mini', ...}]}`. Strip the `vendor/` prefix and run through the existing provider-specific filter helpers to drop audio/realtime/embedding ids.

models.dev response shape: `{openai: {models: {...}}, anthropic: {...}, google: {...}}`. Pull `id` per model and apply the same filters.

#### Phase B - Self-refreshing snapshot

`scripts/refresh-curated-models.ts` mirrors the runtime pipeline but writes to disk. Output shape:

```
{
  "generatedAt": "2026-04-20T...",
  "sources": ["openrouter", "models.dev"],
  "providers": {
    "openai": ["gpt-5.4", "gpt-5.4-mini", ...],
    "anthropic": ["claude-opus-4-7", "claude-sonnet-4-6", ...],
    "gemini": ["gemini-2.5-pro", "gemini-2.5-flash", ...]
  }
}
```

`city-generation-config.ts` imports this JSON and exposes `CITY_GENERATION_KNOWN_MODELS` as today, so the rest of the app does not change.

#### Phase C - UI

Only one status line needs new copy. The existing `ProviderModelDiscoveryResult.source` plus `warning` fields are already threaded through all five pickers via `useProviderModelDiscovery`. Extending the switch from `'live' | 'fallback'` to `'live' | 'aggregated' | 'fallback'` is a copy-only change.

#### Phase D - Verification

- Unit tests belong next to `src/lib/provider-model-discovery.test.ts`.
- Snapshot integrity test runs in the normal Vitest suite and guards the invariant "every snapshot id passes the runtime filter."
- Manual UI sweep: unset `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` locally and confirm each picker shows aggregated suggestions with the new status line.

### Success Criteria (Follow-up)

This follow-up workstream is successful when:

- a user with zero API keys sees live-aggregated model lists in every picker
- the curated in-repo fallback is generated, not hand-edited
- `npm run models:refresh` is the only step needed to refresh suggestions
- aggregator outages fall back to the snapshot without surfacing as errors
- `source` status accurately distinguishes `live` / `aggregated` / `fallback` in every picker

### Likely Files (Follow-up)

- `src/lib/provider-model-discovery.ts`
- `src/lib/provider-model-discovery.test.ts`
- `src/lib/city-generation-config.ts`
- `src/lib/data/curated-models.generated.json` (new)
- `scripts/refresh-curated-models.ts` (new)
- `package.json` (add `models:refresh` and `models:check` scripts)
- `src/components/cities/CityGenerationPanel.tsx`
- `src/components/itinerary/PlannerNewCityDialog.tsx`
- `src/components/itinerary/TransportEstimateDialog.tsx`
- `src/components/itinerary/BulkTransportEstimateDialog.tsx`
- `src/lib/use-provider-model-discovery.ts`
- `docs/dev/README.md`
- `CLAUDE.md`

---

## Success Criteria

This workstream is successful when:

- example model suggestions are no longer static-only
- the same discovery/fallback behavior is visible in every LLM picker
- users can refresh live model suggestions without leaving the page
- provider discovery failures degrade cleanly into curated fallback suggestions
- custom model ids remain allowed

---

## Likely Files

- `docs/dev/plans/live-model-discovery.md`
- `src/lib/city-generation-config.ts`
- new shared model discovery libs under `src/lib/`
- new route under `src/app/api/llm/models/route.ts`
- `src/components/cities/CityGenerationPanel.tsx`
- `src/components/itinerary/PlannerNewCityDialog.tsx`
- `src/components/itinerary/TransportEstimateDialog.tsx`
- `src/components/itinerary/BulkTransportEstimateDialog.tsx`
- `src/app/plan/page.tsx`

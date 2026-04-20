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
- [ ] Phase 5c - Push branch and open/update the implementation PR

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

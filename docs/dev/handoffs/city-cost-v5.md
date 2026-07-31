# Handoff — City Cost Methodology v5

**As at:** 31 July 2026
**Branch:** `feat/city-cost-methodology-v5`
**Goal status:** active; v5 is not accepted

## Completed this cycle

- Reconstructed the project state and verified `CLAUDE.md`/`AGENTS.md` with
  `npm run docs:check-memory`.
- Rewrote `PLAN.md` as the active v5 workstream plan while preserving the unrelated app backlog.
- Added the v5 data dictionary and frozen validation manifest under `data/reference/v5/`.
- Added Experiment 000, a deterministic audit of the retained v3/v4 evidence.
- Re-ran the v4 ratio fit and confirmed its output is reproducible; the v5 baseline report also reproduces
  byte-identically.
- Added the Experiment 001 candidate extractor prompt and a provider-neutral one-call harness.
- Added Experiment 003, an isolated deterministic derivation contract and tests for all 19 tiers,
  fail-closed missingness, and provenance propagation.
- Updated the data, script, and prompt inventories; synchronized `AGENTS.md` from `CLAUDE.md`.

## Experiment 000 result

The retained evidence has 176 accepted observations, zero duplicate observation IDs, and 99 cities across
all nine regions. Direct coverage is strong for Numbeo food/drink anchors but absent for dorm/private and
1–3-star accommodation, with only one direct 4-star city. Paid-attraction coverage is 29 cities; half-day
and full-day activity coverage is 3 and 2 cities. V4 proxy-input counts are not shipped-target calibration.

Read:

- `data/reference/v5/experiments/000-baseline-reassessment/results.json`
- `data/reference/v5/experiments/000-baseline-reassessment/verdict.md`

Verdict: retain the evidence and provenance model; reject v4 as a complete production methodology.

## Experiment 001 result

The candidate prompt asks the model to extract 18 source measures, not calculate tiers. The runner supports
OpenAI Responses web search and Anthropic server web search, with no retries or provider fallback. The
schema-only fixture passes validation. No live test was possible because `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, and `GEMINI_API_KEY` are absent from the environment.

Run a live test when credentials are available:

```text
node scripts/run-city-cost-v5-one-call.mjs --provider anthropic --model <haiku-model-id> --city Lisbon --country Portugal
```

The output is written under `data/reference/v5/experiments/001-one-call-harness/` and must be treated as
unvalidated until source/citation correctness, one-call reliability, and target accuracy are scored.

## Experiment 002 result

The retained accommodation ladder was independently summarized from the raw v4 artifacts. Hotel class
relations have n=16, the blended-hostel relation n=13, and the first-page window check spans 3.945x. The
hostel source has no dorm/private occupancy label. The candidate is rejected as final v5 methodology and
retained only as evidence. Read `data/reference/v5/experiments/002-accommodation-ladder/`.

## Next action

Build the scoring and target-model evaluation harness while the live credential blocker is pending. In
parallel, design independent accommodation and activity ground-truth collection with complete matched city
records. Do not use the shipping CSV as ground truth and do not infer dorm/private separation from the
blended hostel channel. The new derivation contract is deliberately not integrated into the shipping path
until source feasibility and accuracy gates pass.

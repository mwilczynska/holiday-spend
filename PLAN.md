# Holiday Spend — Plan

The working document for the current workstream. Confirmed historical results and rejected
methodologies live in [LOG.md](LOG.md). Project memory is in [CLAUDE.md](CLAUDE.md).

**Last reviewed:** 31 July 2026

---

## Where things stand

The application is feature-complete and stable for planning, tracking, dashboard, saved plans, and
comparison. The shipping city-cost path is still v1: it asks an LLM for remembered anchors, performs
arithmetic and FX in the model, and applies asserted multipliers. v4 is retained as prior evidence;
its collection contract and calculator were never integrated.

The active workstream is **city-cost methodology v5**. Its objective is a validated, implementation-ready
methodology, not an early rewrite of the shipping application. No 121-city migration starts before the
acceptance gates below pass.

The current worktree also contains an untracked `LOOP-PROMPT.md` supplied during the v5 kickoff. It is
preserved as user material and is not part of the methodology evidence until deliberately adopted.

---

## v5 objective

For an ordinary in-scope city, produce numeric values for the 19 planner fields: six accommodation
tiers per night for two travellers, four food tiers per day, five drink values per day, and four activity
tiers per day. City base values are AUD for two people; runtime traveller scaling remains an app concern.

One user-initiated production request must use one fast, inexpensive target model (GPT-5.6 Luna or a
Claude Haiku-class model). Search and page retrieval inside that request are allowed. A second LLM request,
retry, second sample, or human intervention is not part of the production path.

The v5 data dictionary and validation design are frozen in:

- `data/reference/v5/data-dictionary-v5.md`
- `data/reference/v5/validation-manifest-v5.json`

These are experiment contracts. They may change only through a dated decision recorded here and in the
experiment log before the affected holdout is used.

---

## Acceptance gates

The methodology is not accepted because it is better than v1 on a few examples, works in-sample, or
achieves coverage by hiding imputation. The locked end-to-end evaluation must show:

1. Valid schema and complete numeric product semantics for every test city.
2. A named, free, no-key, signed-out source cascade with explicit block/rate-limit outcomes.
3. At least 30 definition-matched city records for each material model relationship, including at least
   10 locked holdout cities for multi-tier claims. City-level splits prevent correlated observations from
   one city crossing partitions.
4. Held-out median absolute percentage error ≤25% for every non-definitional category and modelled
   measure, p90 absolute percentage error ≤50%, and absolute median signed error ≤10%.
5. No material regional or cost-band bias hidden by an aggregate; city ordering is reported with rank and
   pairwise accuracy.
6. ≥95% one-call pipeline success and ≥95% audited citation/source correctness on the representative
   target-model test.
7. Three independent calls on five difficult cities with dispersion retained, not averaged away.
8. Measured per-city searches, page reads, tokens, latency, provider cost, and steady-state throttling
   behaviour.
9. Every value labelled observed, modelled, imputed, definitional, or not-applicable, with provenance and
   uncertainty.
10. A blind demonstration from city input through one target-model request, validation, deterministic
    derivation, and all 19 outputs.

If a gate is shown to be inappropriate, amend it before the final holdout with evidence and a dated
decision. Never weaken a gate after seeing its result merely to declare success.

---

## Current experiment sequence

### Completed

- v1 shipped and audited; its constant `accom_4_star = hotel_3star × 1.80` is refuted by the v4 evidence.
- v3 observed-first collection abandoned at 22.8% pilot cell coverage and zero complete cities.
- v4 source, ratio, accommodation, and prompt evidence retained under `data/reference/` and documented
  in `LOG.md`.
- Project memory was verified with `npm run docs:check-memory` at the start of v5.

### Completed / in progress

**Experiment 000 — deterministic baseline reassessment — complete.** The retained evidence covers 99 cities
across all nine regions and reproduces byte-identically. It has zero direct dorm/private/1–3-star hotel
observations, one direct 4-star city, three half-day activity cities, and two full-day activity cities.
Food/drink proxy-input counts are not shipped-target calibration. Full details are in
`data/reference/v5/experiments/000-baseline-reassessment/verdict.md`.

**Experiment 001 — target-model one-call harness — built, live test pending.** The candidate 18-measure
extractor and provider-neutral OpenAI/Anthropic telemetry harness make exactly one request and do not retry
or fall back. No provider credentials are configured in this environment, so target-model feasibility
cannot yet be measured.

**Live-call blocker:** no `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is configured in this environment. The
first target-model prompt test is queued, but no stronger model or manual web run will be counted as
production evidence. Offline schema, data, source, and deterministic work continues meanwhile.

### Next experiments, in order

1. Build a target-model web-enabled one-call runner and test the smallest useful anchor contract when
   Luna/Haiku credentials are available.
2. Resolve accommodation measurement and dorm/private identifiability with independent ground truth;
   do not infer two hostel tiers from one blended channel without matched evidence.
3. Establish direct ground truth for activity tiers or prove a simple model with held-out cities.
4. Compare the simplest direct/modelled partition against v4 using city-level validation and the locked
   manifest.
5. Run the full one-call blind evaluation, freeze the winning methodology, and only then plan integration,
   121-city migration, and rollback.

---

## Experiment protocol

Every material candidate gets a directory under `data/reference/v5/experiments/` containing its hypothesis,
pre-registered sample and gates, versioned prompt, raw responses, normalized observations, deterministic
results, and verdict. `LOG.md` receives confirmed results; this file carries current status and decisions.

Use the simplest candidate first: direct observation, a global median ratio, cost-band or regional ratios,
then log-linear forms. Add parameters only when a richer model improves both city-level validation schemes
by at least 10% relative, has stable coefficients, and improves a product metric. Prefer fewer parameters
when performance is practically tied.

Production extraction should report source currency and facts only where possible. Arithmetic, FX, modelling,
validation, tier construction, and evidence-basis labelling belong in deterministic code. A model-generated
estimate is never observed evidence.

All publicly accessible sources may be tested, including previously deferred channels, subject to signed-out
access, no paywall or source key, no bypassing blocks/CAPTCHAs/rate limits, and normal browsing behaviour.
Manual or browser collection may create ground truth but cannot be substituted for the target-model
production feasibility test.

---

## Documentation and verification

Current v5 artifacts:

- `docs/dev/plans/city-cost-methodology-v5.md`
- `docs/dev/handoffs/city-cost-v5.md`
- `data/reference/v5/README.md`
- `data/reference/v5/data-dictionary-v5.md`
- `data/reference/v5/validation-manifest-v5.json`
- `data/reference/v5/experiments/000-baseline-reassessment/`

When `CLAUDE.md` changes, run `npm run docs:sync-memory` and `npm run docs:check-memory`; `AGENTS.md`
must remain byte-for-byte identical. Update the data, prompt, and script inventories when new artifacts
are added. Commit and push each sizeable experiment and milestone on `feat/city-cost-methodology-v5`.

After v5 acceptance, add integration, migration, and tested rollback milestones here. Until then, the app,
shipping v1 prompt, and 121-row production CSV remain unchanged.

---

## Unrelated app backlog

- [ ] Add tests around city generation parsing and Wise import format handling.
- [ ] Expand Playwright from planner regressions into full add-leg / generation success-path tests.
- [ ] Add provider/model capability validation for planner transport estimation.
- [ ] Add automated coverage around bulk transport estimation and planner apply flows.
- [ ] Consider transport-estimation caching — explicitly deprioritised.

## Traps retained from earlier work

1. A model's explanation for a failure is a hypothesis; verify the response independently.
2. Contract defects often look like model unreliability.
3. Never ask the model to grade its own work.
4. A contract that fights the shape of its sources will lose.
5. Inspect the underlying record, not only a summary.
6. On rate limiting, defer the city; do not silently fall through to search.
7. Do not adopt a promising result on one city's evidence.

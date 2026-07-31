# City Cost Methodology v5 — Active Workstream

**Status:** Research and validation in progress. The shipping path remains v1. v4 is prior evidence,
not an assumed implementation.

## Objective

Select and document a method that produces all 19 planner cost values for an ordinary in-scope city from
one user-initiated request to a fast, inexpensive web-enabled model (GPT-5.6 Luna or Claude Haiku-class).
The method may directly collect some inputs and model others, but must label the evidence basis and validate
every material model on definition-matched city data.

## Non-negotiables

- no paid data APIs, source account, source key, paywall, member rate, or access-control bypass;
- one provider request in the production path; search/page retrieval inside it is counted and measured;
- source currency and published facts are retained; deterministic code owns FX, arithmetic, models, and tiers;
- missing, blocked, stale, and class-absent are distinct outcomes;
- a modelled or imputed value is never presented as observed;
- ground truth may use manual/browser research, but that does not prove target-model feasibility; the
  delegated GPT-5.6 Luna-class sub-agent is now the no-key prompt-feasibility path, while provider telemetry
  and the locked holdout remain separate gates;
- the final holdout is city-level and locked before final tuning.

## Work packages

1. Freeze the data dictionary and validation manifest.
2. Audit existing v3/v4 evidence and reproducibly establish the v4 baseline.
3. Implement a provider-neutral one-call test harness that records request and web-tool telemetry.
4. Test direct-source anchors and source fallbacks on the target cheap model.
5. Collect matched ground truth for accommodation and activities, the v4 blockers.
6. Fit and compare simple model families with parameter penalties and locked validation.
7. Run the blind end-to-end test, write the methodology/data card, and freeze the winner.
8. Only after acceptance, add app integration, 121-city migration, and rollback milestones to PLAN.md.

## Decision rule

Promote a candidate only when it passes the pre-registered gates in `PLAN.md` and
`data/reference/v5/validation-manifest-v5.json`. A candidate that has good accuracy but cannot be retrieved
reliably in one cheap-model request is not production-ready. A candidate with broad coverage but unvalidated
imputation is not production-ready.

## Latest evidence

Experiments 009 and 010 rejected broad and indexed date-fixed accommodation collection: strict coverage was
4/60 and 0/30 respectively. Experiment 011 partially promoted only the direct Booking 3-star and 4-star
city-average templates, which returned 10/30 facts on five cities; lower classes and Hostelworld `from`
prices remain unresolved. The next work item is a broader stability/definition audit of those promoted
templates while testing an independent source or curated benchmark for the remaining accommodation classes.
Delegated GPT-5.6 Luna tasks are the no-key target-class prompt-test path; exact provider telemetry remains a
separate acceptance gate.

## Restart rule

At the end of every work cycle, record the verdict, update the experiment index, commit sizeable work, and
start the next highest-value unresolved package. Remain active until the Definition of Done is met or a
credential, permission, or explicit product decision is genuinely required.

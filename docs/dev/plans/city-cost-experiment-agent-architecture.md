# Future city-cost experiment agent architecture

Prepared 13 October 2026. **Proposal only; inactive.** Applies only to an explicitly restarted research
program. Finish the already registered current experiment under its original contract, then stop work and
pause the active goal at the owner's request. This document does not activate or extend that goal.
The current `pilot-1` protocol, manifest, registrations, responses and evidence remain immutable.

## Roles and boundaries

| Role | Codex | Claude Code | Permitted work |
| --- | --- | --- | --- |
| Experiment designer | GPT-6 Astra, Medium reasoning | Opus 5.5, Max reasoning | Design every experiment, exact worker prompts, assessment and prospective program changes |
| Cost-information worker | GPT-6 Luna, Max reasoning | Haiku 5.5, Max reasoning | All price retrieval, reference collection, verification requiring source retrieval, and candidate estimates |
| Coordinator | Orchestration runtime, recorded | Orchestration runtime, recorded | Scheduling, deterministic tooling, validation, accounting and reporting; no invented prices |

Assign one designer to each experiment before execution; choose and record its runtime before seeing results.
Using both design models is not required. Verify the exact available model identifier and selected effort
through runtime metadata. No silent substitutions or weaker effort. If one complete runtime pairing is
unavailable, use the other verified pairing and state the limitation. Unsupported models/efforts block their
assigned role; subscription authentication is required and paid provider API fallback is prohibited.

Designers may inspect released development evidence and error summaries to choose hypotheses. They must not
supply numeric candidate estimates or act as reference-price collectors. All workers that get or generate
cost information use the cheap models above, including reference and source-verification workers. A designer
may prescribe formulas; fitted coefficients must come from registered deterministic development-only fitting,
not designer-invented city prices. Independent public observations, not LLM agreement, define references.

Prediction workers receive fresh contexts, exact versioned prompts, their city/date/context and permitted
tools only. They cannot read parent history, references, scores, other predictions or benchmark files.
Reference workers receive definitions and source-selection rules but cannot read candidate predictions.
Designers/coordinators cannot inspect sealed confirmation evidence before the finalist freeze. Historical
v5/v6 holdouts remain closed. Strong models may assess disclosed evidence but cannot silently repair a
worker's JSON prices, substitute absent prices or fill failed reference cells.

## Immutable experiment contract

Each experiment, including a new baseline evaluation, requires a designer-authored registration with:

1. Unique ID, program revision, designer/runtime/model/effort provenance, creation time and input hashes;
   one falsifiable hypothesis, principal change, mechanism and comparison with original v1.1/incumbent.
2. What is measured: named anchors/categories/baskets, explicit consumption quantities, boundaries, dates,
   occupancy/tax/unit definitions and conditional interpretations. Full-budget claims require complete
   independent baskets; retrieval fidelity, market-price agreement and actual spending remain distinct.
3. How references are obtained: development split, fixed source/venue selection order, action allocation,
   allowed evidence classes, normalization, uncertainty and missing/absence handling; independent review
   allocation and source-overlap diagnostics. No replacing difficult cities with easier ones.
4. Exact system/user prompts and output/provenance schema for cheap-model estimates, collection and
   verification; prompt hashes, allowed tools, search limits, model/effort, repeats, retry/fallback rules,
   deterministic formulas and materializer/scorer version. Numeric examples must be synthetic, labelled
   and unrelated to target-city answers. Preserve immutable raw failed and successful responses.
5. Assessment: fixed reference-cell denominators, paired city weighting, primary loss, failure penalties,
   practical improvement threshold, category/tail/bias/coverage checks, reference uncertainty sensitivity,
   repeat variation and operational resource measures. Explain exactly what would falsify the hypothesis.
6. Pilot/extension gates, maximum calls/searches/elapsed worker time, counters reserved before dispatch,
   and explicit retain/reject/inconclusive/invalid verdict rules. Model-specific findings cannot be pooled
   to conceal a regression. Formula-only candidates replay identical saved anchors without new estimates.

Use the existing primary mean absolute log error, equal city weighting, ln(4) missing-prediction penalty
with ln(2)/ln(10) sensitivities, >=10% relative practical margin, no new failures, category/p90 regression
screen of five percentage points and absolute median log-bias worsening screen of 0.05 as the proposed
restart defaults. Define these precisely in the new machine-readable protocol before execution. City-level
bootstrap intervals are exploratory on development; final supported improvement also requires the paired
95% confirmation interval to exclude zero improvement. Unsupported reference cells are unscored, not zeros.

## Execution gates

1. **Restart authorization:** archive the stopped program state; register a new program ID, budgets and
   evidence-exposure inventory. An old baseline is reusable only with its original provenance and compatible
   definitions/window; it is exposed development evidence, never newly blinded confirmation.
2. **Design:** invoke the assigned strong designer for every experiment. Validate its contract with
   deterministic checks. At most one design-repair invocation per experiment, within the global repair cap;
   do not run an unregistrable design. Hash and freeze the accepted registration before dispatch.
3. **Preflight:** verify worker model/effort and permitted tools, immutable files, isolated paths and remaining
   resource reserves. Pre-register the cheap primary model. Start with two repeats across six development
   cities where new estimates are needed; count each repeat and failed/retried call. A lower-cost pilot must
   be designed and frozen prospectively, not justified after disappointing results.
4. **Execute and assess:** sequential ledger reservation before each dispatch; fresh isolated workers;
   immutable inputs/outputs; deterministic materialization and paired scoring. Designer receives the
   released development result packet and writes a verdict under the frozen criteria. It cannot revise
   thresholds, exclusions or answers. Record failure/inconclusive evidence as well as successes.
5. **Extend/select:** extend at most two candidates across the full 16-city development set; compare with
   baseline and incumbent. Check the frozen finalist on the other available cheap model before confirmation.
   If effort/model access is unavailable, mark it untested rather than substituting.
6. **Confirm/report:** freeze one finalist and its prompts/formulas before collecting/revealing the eight
   fresh confirmation references. Baseline and finalist get three repeats per city/model, within reserve.
   No confirmation-driven tuning or second finalist. If development finds no candidate, assess baseline
   only and report no supported improvement. Report category-only or insufficient-evidence findings when
   reference feasibility limits the question. All scores reproduce offline from saved public evidence.

## Program review after every ten experiments

A completed experiment is a frozen candidate registration with an executed/replayed test and a signed
terminal assessment, including rejected, inconclusive and invalid attempts. A failed dispatch still uses
resources. Unexecuted proposals and design-only failures do not pad the completed count; they consume
design/candidate-attempt allowances. Current baseline is experiment `000`; future candidates start `001`.
Baseline and confirmation are not candidate experiments. Repeated runs never count as extra experiments.

At completed counts 10 and 20, stop dispatch and invoke a strong design agent in the selected runtime.
Give it every registered development result, including null/failed results, resource ledgers, known exposure
and prior decisions. Ask what mechanisms worked/failed, what the evidence supports, what is unmeasurable,
and which remaining experiments provide useful information within budget. It emits a versioned prospective
program revision and continue/finalize recommendation. A second block is optional, never automatic merely
because ten have finished; require a concrete, testable next hypothesis and sufficient reserved resources.

It may reorder or remove unrun hypotheses, improve future cheap-worker prompts or source acquisition,
narrow future scope and allocate remaining resources. It may not increase authorized caps, revise completed
registrations, rewrite prior verdicts, relax acceptance criteria to obtain a win or inspect confirmation.
Changed definitions/metrics/reference rules create a new evidence stratum and prospective registration;
old and new results are not silently pooled. Factual reference/scoring corrections retain original artifacts,
document reason and discovery timing, and reprocess every affected method consistently as a labelled
correction, never a replacement for the original preregistered assessment.

## Proposed bounded restart policy

The old six-candidate cap cannot permit a ten-experiment review. Replace it **only in the future restarted
program** with a maximum of 20 candidate attempts in two blocks of at most ten. Reviews are contingent on
reaching ten completed experiments; an early stop never requires filler experiments.

| Counter | Hard proposed restart cap / rule |
| --- | --- |
| Candidate attempts | 20, including abandoned/inconclusive registrations; maximum two full development extensions |
| Estimate invocations | 400 cumulative including prior consumption, repeats, retries and failures; 100 reserved exclusively for confirmation |
| Reference-worker invocations | 100 including failed/retried collectors/verifiers, separately from estimates |
| Reference retrieval actions | 300 cumulative including prior consumption and 40 feasibility actions; a search, open or click each counts |
| Estimate retrieval actions | 1,600 globally; additionally <=8 per city/request route including retries |
| Ordinary serving route | <=3 cheap-model invocations per city/request including retries; one call preferred |
| Design invocations | 50: 20 experiment designs, 20 assessments, two ten-experiment reviews, two baseline design/assessment calls, six shared repairs |
| Concurrent cost workers | <=3, or fewer if runtime slots require; designer runs at gates |
| Worker wall time | <=10 minutes per invocation; timeout consumes the invocation and recorded actions |
| Paid calls / application keys / production writes | Zero |

These are ceilings, not targets. Rough estimate feasibility: two-model baseline 96 calls + ten pilots at
12 calls = 120 + two ten-city extensions at two repeats = 40 + second-model finalist development check
32 + two-model confirmation 96 = 384, leaving only 16 calls for retries or other consumed work. Twenty
fresh-generation pilots with that full schedule would require 504 calls and are therefore prohibited.
Formula-only replay experiments can reach later review points without new estimates; they still require
distinct useful hypotheses and registrations. Reconcile prior consumption first, reuse only compatible valid
baseline runs and reserve the actual schedule before dispatch. Neither ten nor twenty completed candidates
is promised. More expensive designs consume the cap faster.

Maintain append-only separate counters for designs, assessments, program reviews, design repairs, estimate
calls, reference calls, both classes of retrieval actions, elapsed time and tokens if exposed (unknown
otherwise). Record total subscription calls too; never describe 400 as an all-role call cap. Before dispatch,
reserve worst-case remaining calls/actions and release unused reservations only after completion. Counters
are cumulative across the original and restarted program; a program revision never resets them. Import
the prior ledger, retain phase labels and subtract prior usage from the existing 400-estimate/300-reference
action ceilings. Account for known prior usage in newly separated worker/action counters; unavailable
telemetry stays unknown and requires a conservative reservation, never an assumed zero. No invented
dollar/API-cost comparisons.

Stop new experiments at any hard limit, exhausted safe reserves, owner stop, failed reference feasibility,
or five consecutive assessed candidates without a supported development improvement. This replaces the
old three-failure rule prospectively; five is a declared resource policy, not a statistical finding. An early
stop triggers a final synthesis, not a fake tenth-experiment review. Missing tools/subscription limits require
a checkpoint and honest unavailable scope. No budget expansion, extra confirmation or repeated testing until
significance. A supported retain-v1.1 recommendation is a valid completed research outcome.

## Suggested replacement goal wording (inactive draft)

```text
/goal Complete the explicitly restarted, bounded city-cost research program in the isolated research
worktree, following the frozen restart protocol and city-cost-experiment-agent-architecture.md. Do not
reinterpret or extend the stopped pilot-1 experiment. Preserve its immutable registrations and evidence.

For EACH experiment, use a GPT-6 Astra Medium design agent in Codex or an Opus 5.5 Max design agent in
Claude Code to specify what/how to measure, accuracy assessment, exact cheap-worker prompts, tools,
references, scoring, gates and resource allocations before execution. Record verified model/effort/runtime.
All agents that retrieve or generate cost information must be GPT-6 Luna Max in Codex or Haiku 5.5 Max
in Claude Code. No silent substitutes, coordinator prices, paid provider API calls or application keys.

Use fresh isolated prediction and reference workers. Keep confirmation sealed until one finalist is frozen.
Separate source reproduction from price and basket accuracy, preserve missingness and failures, and never
retune completed registrations or confirmation results. Implement changes only in isolated research code.

Use at most 20 candidate attempts, 400 cumulative estimate invocations (100 reserved for confirmation), 100 reference
worker invocations, 300 reference retrieval actions, 1,600 estimate retrieval actions and 50 design-role
invocations, with the architecture's per-route, timeout and concurrency limits. Retain prior consumption
against the existing 400-estimate/300-reference-action budgets. Count retries and failures. Baseline is
experiment 000; candidates start at 001, and repeated runs never count as separate experiments.
Have the design agent review the whole program after every ten completed candidate experiments and write
prospective revisions based on successes and failures; never reset budgets or rewrite completed evidence.
Stop early at five consecutive non-improvements, infeasible references, owner stop or a hard resource gate.
Do not pad to ten, expand resources, relax rules or manufacture a supported win.

Deliver reproducible baseline and candidate results, references, immutable experiment and resource ledgers,
model-specific comparisons, program reviews where reached, and an honest supported/promising/no-improvement/
insufficient-evidence recommendation. No production writes, canonical CSV/database changes, deployment or
merge. A harness alone is not the result. Stop after the bounded report; any rollout is a separate decision.
```

## Draft authorship provenance

This architecture was authored by a Codex subagent, task `design_architecture_revision`, on 13 October 2026.
The coordinator reports selected spawn settings: model `gpt-6-astra`, reasoning effort `medium`, runtime
Codex subagent, `fork_turns=none`, canonical task `/root/design_architecture_revision`. These are
coordinator-selected settings; this child did not independently attest the model ID. This is preparatory
architecture work, not a registered experiment,
candidate estimate, price lookup or activated goal. No baseline responses or sealed evidence were inspected.

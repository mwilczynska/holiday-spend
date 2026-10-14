# City-cost accuracy: bounded research plan

**Prepared:** 13 October 2026
**Branch:** `research/city-cost-accuracy`
**Status:** Original baseline complete and preserved. Revised designer-led program active on explicit owner restart.
**Execution prompt:** [CITY-COST-ACCURACY-GOAL.md](../../../CITY-COST-ACCURACY-GOAL.md)

## Owner-directed architecture revision

The registered `000-baseline` finished and its goal was stopped/cleared. The owner has explicitly started the
replacement designer-led goal. Preserve immutable `pilot-1` and its results; the restart does not retrospectively
change their rules. The architecture below is now authorized, subject to a newly frozen machine protocol.

On this restart, [the experiment-agent architecture](city-cost-experiment-agent-architecture.md) and the
replacement goal govern execution, superseding the original role, candidate-limit and stopping rules in
sections 5, 7 and 8 below. Retained sections document the original protocol and its measurement safeguards.
Freeze a new machine-readable revision; do not edit the original manifest to conceal the timing of changes.

| Responsibility | Codex | Claude Code |
| --- | --- | --- |
| Design every experiment and assess results | GPT-6 Astra / Medium | Opus 5.5 / Max |
| Retrieve/reference/verify prices and generate estimates | GPT-6 Luna / Max | Haiku 5.5 / Max |
| Schedule, validate, score and report | Coordinator and deterministic code | Coordinator and deterministic code |

Every experiment needs a designer-authored frozen contract: hypothesis; what/how measured; date/unit/tax/basket
definitions; independent reference selection; exact cheap-worker prompts/schemas; tools/repeats/retries;
accuracy metrics, failures and uncertainty; decision thresholds; resources; and execution/stop gates. The designer
assesses results against those rules. Strong agents cannot supply replacement candidate or reference prices.

After every ten completed candidate experiments, halt dispatch for a design-agent review of the released
development program, including failures, coverage and resources. It must make justified prospective adjustments
to hypotheses, acquisition, future prompts or scope. It cannot reset budgets, rewrite prior outcomes, relax
acceptance rules or inspect sealed confirmation. Repeated city runs do not count as experiments.

Proposed restart policy: up to 20 candidate attempts in two blocks, replacing six; stop earlier after five
consecutive assessed non-improvements, failed feasibility, owner stop or exhausted resources. Never create
filler experiments to reach a review. Retain cumulative 400 estimate calls (100 reserved for confirmation) and
300 reference actions, subtracting prior usage. Separately cap design-role calls at 50, reference-worker calls
at 100 and estimate retrieval actions at 1600; at most three concurrent cost workers. See the architecture for
per-route/time limits and accounting. These limits are authorized by the explicit restart; prior usage is retained.
Unavailable exact models/Max effort remain unavailable; no reduced-effort or paid-API fallback.

The original pilot's single-venue offers can support conditional food/drink agreement; they cannot establish
population city-price or complete-budget accuracy. Future designers must address that evidence limitation.

## 1. Objective and scope

Measure the current city-cost estimator on the inexpensive models intended for the published app, then test
small changes and establish whether any improves useful price/budget accuracy with bounded model and search usage.
A reproducible finding of no supported improvement is a valid outcome. A harness alone is not the research result.

The owner's 13 October request reopens city-cost accuracy measurement and methodology experiments in this
worktree, superseding the earlier blanket closure for this stream. Historical v5/v6 holdouts remain closed.
Transport accuracy, a full-library recollection and deployment are outside this campaign.

The production baseline remains v1.1: ten holistic USD anchors, current RBA FX, deterministic v1 formulas,
19 planner fields. Read the current implementation as authority; some retained README/status labels are stale.
The local catalogue is mixed by methodology, model and generation date, so test fresh baseline generations
separately from an optional read-only catalogue audit.

## 2. Lessons this protocol preserves

- The nine-price v1 audit is a three-city food/drink spot check, not a complete-budget error estimate.
- v3's complete-basket collection stalled at 22.8% coverage. Do not require every tier in every city.
- v4/v5's roughly 1.30-1.34 four-star/three-star ratios are candidate evidence, not a universal replacement.
- Source reproduction, source-to-source agreement, priced baskets and actual spend answer different questions.
- The v5 programme's 95 experiments and unreachable sample/metadata gates must not be recreated.
- v6's successful materialization and fallback coverage did not establish end-to-end price accuracy.
- Predictions must come from the selected cheap-model subagents. Record their tool environment so the
  evidence is not mislabelled as an API latency, pricing or transport test.
- Failed or absent evidence must remain visible. A favourable score on fewer/easier cells is not an improvement.

Sources: [current method](../../product/city-cost-methodology.md), [LOG](../../../LOG.md),
[v4 research](../../product/methodology-v4.md), [archived v6 plan](../archive/plans/PLAN-city-cost-v6-1-final-2026-08-18.md).
More history is available read-only at tag `city-cost-v6.1-research-final-2026-08-18`; do not open its sealed ledgers.

## 3. Define what a correct answer means before measuring it

Freeze a compact data dictionary before candidate outputs are viewed. Start with two travellers, the existing
tier meanings, a named city boundary, specified travel dates/lead time and ordinary publicly bookable prices.
Use identical city/date/context inputs across methods. Dates may be supplied through v1.1's existing context
fields; this is a dated evaluation slice, not proof of accuracy over an entire year.

| Layer | Reference and interpretation |
| --- | --- |
| Unit prices | Definition-matched hotel/hostel offers, menus and operator prices; assess anchor accuracy. |
| Category/day | A predeclared basket of independently priced meals, drinks or activities; assess the tier against that particular consumption pattern. |
| Total/day | Sum independently priced categories only when the complete named basket is supported. |
| Actual spend | Optional, separate check using consented, complete records with matched travellers, dates and categories; behaviour can differ from the declared basket. |
| Retrieval | Accuracy reproducing a published source statistic; useful operational evidence, not independent market truth. |

Define three basket profiles before looking at scores:
economy (private hostel, budget food, light drinks, budget activities);
standard (3-star, mid-range food, light drinks, mid-range activities);
higher-spend (4-star, high-end food, moderate drinks, high-end activities).
List the actual meals, quantities and activity schedule behind each label. Where the current activity tier has
no concrete behavioural meaning, register an explicit proposed interpretation and label the result conditional
on it. Do not silently redefine a tier to make a candidate fit.

Price reference meals and activities directly. Do not derive reference street food from 0.6 times a meal,
reference four-star from 1.8 times three-star, or activity truth from the production meal-price formula.
Existing fixed consumption counts can define a matched basket, but matching them does not validate those
counts as typical behaviour. Score additional supported tiers diagnostically; unsupported baskets stay unscored.

## 4. Build a modest, independent reference set

Start with six development cities spanning low/middle/high costs and both ordinary and difficult destinations.
Within a maximum 40 reference retrieval attempts, test whether meaningful references can actually be obtained.
Freeze an extension to 24 cities: 16 development and eight fresh confirmation cities, spread across regions,
cost levels and destination types (large cities, smaller places, seasonal/resort and sparse-source locations).
Register city identity, boundaries, dates, selection seed, strata and exclusions before candidate scores.
Do not pick cities because their prices are easy to retrieve or the baseline looks wrong.

The counts are resource allocations, not statistical guarantees or per-relationship acceptance hurdles.
Historical exposed cities/data can inform development; the confirmation evidence must be fresh and kept
out of tuning. Never rebrand old spent holdouts as new confirmation.

Reference collection:

- Prefer dated public booking offers with occupancy/room/tax basis, actual venue menus and official attraction
  or operator prices. Register the venue/property selection rule before observing prices.
- Aim for five eligible accommodation offers and three venue observations per priced meal/drink measure.
  These are sampling targets, not instructions to search forever. Below target, retain counts and uncertainty.
- Record attempts as well as successes. No availability, absent product/class, blocked access, unknown basis,
  stale evidence and technical failure are separate states. Do not replace a failed city with an easier one.
- Record URL, retrieval and applicable dates, currency, amount/range, unit, inclusions, sample count, selection
  rule and a short supporting excerpt. Retain permitted captures locally; do not commit entire scraped sites.
- A clearly documented source-level occupancy/tax convention may support normalization. Do not insist all
  metadata appear in one search snippet. Unknown facts remain unknown; never invent tax or occupancy corrections.
- Use source medians and observed dispersion where feasible; a convenience sample of five properties is not
  a city-population truth or a narrow confidence interval.
- Cross-check a preregistered 20% random sample and all definition disputes against the underlying evidence.
  The reviewer does not see which method won. LLM consensus is not independent ground truth.
- Track source overlap with candidate retrieval. Report same-source reproduction separately, and report
  independent-source results without making total disjointness an impossible all-or-nothing collection gate.
- Freeze reference revisions and hashes. Corrections need a documented factual reason, apply to every method,
  and cannot be motivated by an unfavourable score.

A coordinator may see development references. Prediction workers receive only production inputs and their
permitted tools, with fresh contexts and no benchmark files, reference answers, prior city outputs or feedback.
Collect confirmation references only after freezing the finalist, or use a collector isolated from the tuner.
Once confirmation scores are revealed, do not tune and rescore on those cities.

Keep partial-category findings useful. If complete daily references cannot be built within the collection cap,
state precisely which category/anchor questions can be answered. Do not publish a full-budget accuracy claim.

## 5. Run every estimate through inexpensive model subagents

Use the same subscription-backed method as the previous city batches. All estimate generation is performed
by fresh inexpensive-model subagents; do not make paid provider API calls. GPT-6 Luna at max reasoning and
Haiku 5.5 are the target models. Resolve the exact available agent model/effort before execution and record it.
Do not silently substitute a larger model, a different family, or an unsupported effort setting.

Use the existing batch pattern as the reference:
`scripts/add-cities-from-agent-responses.ts` creates exact app prompts, agents answer them in files, and
the app validates/materializes those answers. For research, implement a sibling runner that reuses the
prompt builder and pure materializer but never invokes the persistence step or creates cities.

Each delegated city invocation must:

1. Start a fresh context without the parent conversation, benchmark answers or earlier predictions.
2. Receive the exact versioned system/user prompt and permitted tools for that experiment.
3. Return the JSON response plus truthful search provenance and available usage/elapsed-time metadata.
4. Save immutable raw response/provenance files; verify the prompt hash before deterministic scoring.
5. Be counted even if it fails, times out or needs a retry. Never let the coordinator repair its prices.

The stronger coordinator may implement, collect/check references and analyse results; its own estimates
are not candidate predictions or ground truth. Separate reference-collection agents from estimation agents.
This plan explicitly permits subagent delegation for these roles when the goal starts.

Evaluate both cheap models when their subagent runtimes are available. If Haiku requires a connected
Claude Code runtime, use that only when available and authorized. If only one target is available, complete
the scoped evaluation on it and mark the other untested. Do not fall back to a paid API or hold up useful
work solely to obtain the second model.

The experiment estimates methodology accuracy under these declared agent/tool environments. API billing,
provider-transport behaviour and API latency remain unmeasured; they are not release gates for this campaign.
No API key setup or API run is required to complete the goal. Later app integration can verify its own
transport boundary as a separate task.

Baseline:

- Freeze code SHA, prompt hash, model ID, effort, agent runtime/tool versions.
- Run unchanged v1.1 three times per development city/model to measure variability. Start with the six-city
  feasibility set, then extend; reuse valid same-window baseline runs rather than repeating them.
- Store each attempt and the final declared-policy result, including failures, retries and fallback effort.
  Never choose the best repeat. A repeat is a separate user request, not a free ensemble.
- Use a fixed evaluation FX table for the primary price comparison, while separately checking the live RBA
  lookup and app AUD outputs. This separates currency movement from price-estimation changes.
- An archived response's FX is validated at its original request time in replay; do not disable freshness in
  the live path merely to make old fixtures pass.
- Interleave paired baseline/candidate subagent runs in the same source window. Record elapsed time, calls,
  searches, retries and token usage if the runtime exposes it. Missing token telemetry stays unknown.

## 6. Scoring and comparison contract

Freeze metrics, denominators, missingness rules and promotion margins before candidate testing.

Primary for a supported scope: mean absolute log price error, computed per city after equal weighting of that
scope's predeclared baskets/categories and averaging all repeats. Compare candidate and incumbent on the same
city/reference cells. Give every city equal weight; many offers in one city do not create independent cities.

Report alongside it:

- Median and p90 absolute percentage error, signed log bias, AUD absolute error and under-budget frequency.
- Category and tier results; the three supported daily baskets; fixed synthetic trip totals and city ranking
  only where references are complete. Trip aggregation is descriptive, not extra independent samples.
- Results by cost band, destination type, reference quality and source overlap; small groups remain descriptive.
- Run-to-run dispersion, valid-output rate, product-absence handling, source/fallback rates, resource usage and elapsed time.
- Raw paired city differences and a 95% city-cluster bootstrap interval, labelled exploratory during tuning.
  The eight-city confirmation set provides limited precision; do not claim general global accuracy.
- Sensitivity to reference uncertainty: score against central references and plausible observed ranges. A win
  that disappears under modest reference variation is fragile.
- A joint error/coverage table. Scorable reference cells are fixed across candidates. Missing predictions on
  supported cells receive a declared log-error penalty of ln(4); also show penalties ln(2) and ln(10).
  Retain separate failure counts and successful-only scores. This penalty is a utility convention, not a price.
  Unsupported reference cells are missing benchmark coverage, never successful predictions or zero cost.
- For true product absence (such as unavailable city alcohol), evaluate correct absence separately from price.
  Numeric zero must not conceal absent evidence.

A candidate is promising on development when its primary loss improves by at least 10% relative, with no
new failures and no material regressions hidden in categories, tail errors or resource use. Treat 10% as a proposed
practical margin, not a discovered law; freeze it before scores and do not relax it afterward.
Screen material regressions as category/p90 error rising by over five percentage points, absolute median
log bias worsening by over 0.05, or valid-output coverage falling. Small-sample ambiguities require disclosure.

A final **supported improvement** needs the frozen finalist to meet the practical margin on confirmation,
a paired 95% city-bootstrap interval for loss improvement above zero, and the regression/resource checks.
If its direction is favourable but uncertainty crosses zero, call it **promising, unconfirmed**. If too few
references exist, report a category-specific result or **insufficient evidence**. Do not keep expanding samples
until a significance threshold happens to pass. Any lower-resource-but-less-accurate tradeoff is presented explicitly.

## 7. Test small changes in a controlled sequence

Choose from this queue according to baseline error attribution; do not run every idea automatically:

| Candidate | Hypothesis | Control |
| --- | --- | --- |
| Clearer price definitions/context | Tax, location, dates or consumption ambiguity causes avoidable error | Same model, formulas and tool budget |
| Direct weak-tier anchors | Direct four-star and/or activity estimates beat the fixed proxy | Change one category; deterministic output mapping |
| Simple corrected relationship | A small fitted relationship improves a systematic error | Development-only fit; city-level cross-validation; retain uncertainty |
| Bounded current-price search | A few targeted source lookups improve stale or uncertain anchors | Fixed search cap; explicit fallback; score the full route |
| Selective hybrid | Search only demonstrably weak categories, retain holistic estimates elsewhere | Include routing mistakes, fallbacks and resource use |
| Model/effort or bounded repeats | Another cheap configuration improves accuracy per invocation/search | Separate model effect from methodology effect; count every invocation |

Keep formulas deterministic. Missingness may be represented explicitly in a research schema, with a tested
planner contract before any future integration. Additional anchors or changed tier meanings require versioned
schemas and clear semantic mapping; do not force them into v1.1 labels.
Do not constrain the answer to sources only: holistic, sourced and hybrid methods may compete.

For each experiment:

1. Register one hypothesis, one principal change, expected mechanism, scope, metrics and maximum invocations/searches.
2. Name a primary cheap model before seeing results, then run two repeats on its six-city development pilot;
   reject infeasible or plainly worse candidates early. Do not screen every candidate on every model.
3. Extend at most the two best candidates to the full development set. Replay formula-only changes against
   identical saved anchors without extra generation calls; collection/prompt changes require new subagent invocations.
4. Compare with both original v1.1 and the current incumbent. Record incremental and cumulative changes.
5. Decide retain/reject/inconclusive and explain the evidence. No retrospective removal of awkward cities.
6. Promote only a supported development change; retain the simpler incumbent when improvement is unclear.
7. Check the development finalist on the second cheap model before freezing it. Then run baseline and finalist
   three times on the eight confirmation cities. Test on
   the second cheap-model subagent without pooling model outcomes to disguise a regression. If no candidate wins
   development, evaluate baseline accuracy on fresh confirmation evidence without pretending an unchanged method
   is an improvement; use the remaining resources for the final report, not another candidate.

## 8. Bounded resources and stopping conditions

These are proposed campaign defaults activated by using the goal prompt, not work already executed.
The owner can change them before starting. **Paid API calls: zero.**

| Resource | Initial cap |
| --- | --- |
| Delegated city-estimation invocations, including repeats/retries | 400; reserve 100 for confirmation |
| Reference-collection search/page retrieval actions | 300 total, including the 40-action feasibility pilot |
| Candidate methodology experiments | Six, including inconclusive attempts |
| Consecutive candidates without a supported development improvement | Three |
| Ordinary candidate method | At most three fresh cheap-model invocations and eight searches per city, including retries |
| Concurrency | At most three estimation workers at once, or the smaller available slot count |

Separate one-off reference research from recurring estimate-generation requirements. Report calls, searches,
available tokens and elapsed time per successful city, including failures. Subscription usage is a resource,
not an API price; do not invent per-token dollar charges or claim measured API economics.
A one-call baseline stays the simplicity preference. An extra call or ensemble must earn its place through
a measured improvement; do not turn every request into a large agent workflow.

Only the current city's production inputs and allowed tools may reach estimation workers. Use a bounded
queue, persist results as they arrive and resume missing assignments after interruption. Account/subscription
limits are real limits: record a checkpoint and follow goal lifecycle rules rather than switching to paid APIs.

After three non-improvements, six candidates or a resource ceiling, stop inventing experiments and complete
the evidence report. Do not automatically reopen the search after confirmation fails.
If no meaningful references are obtainable after feasibility, finish a documented feasibility finding rather
than broadening to hundreds of cities. Fix protocol/execution bugs, but retain invalidated runs and their resource usage.

The goal's outcome is the completed bounded evaluation and justified recommendation, not a guaranteed win.
Missing required access should be reported according to the goal tool's lifecycle rules; never mark incomplete
required work complete merely because a limit was reached.

## 9. Deliverables and file layout

Create only as needed:

- `research/city-cost-accuracy/protocol.md`: definitions, sample, split, metrics, budgets, hashes and deviations.
- `research/city-cost-accuracy/references/`: normalized public reference rows and supporting citations.
- `research/city-cost-accuracy/experiments/NNN-*/`: preregistration, exact prompts, normalized results and verdict.
- `research/city-cost-accuracy/leaderboard.csv`: baseline/incumbent/candidate, scope, model, losses, coverage,
  uncertainty, elapsed time, calls/searches and decision. Include rejected/inconclusive experiments.
- `research/city-cost-accuracy/REPORT.md`: baseline accuracy, supported scope, improvement evidence, resource use,
  limitations, best method and whether to implement it.
- `scripts/city-cost-accuracy/`: isolated collection/replay/scoring tools; commands documented as implemented.
- `.local/city-cost-accuracy/`: private records, large/raw captures and confirmation material while sealed.

Allowlist fields before writing model/provider output to disk; strip credentials, headers and private context.
Keep confirmation references outside the tuning context; commit only hashes until the final freeze/evaluation.
Private actual-spend data is optional and requires explicit owner authorization; this goal does not copy it.
Public research references can be committed, with minimal excerpts and provenance.

Use fixture-only or temporary databases. Resolve output paths and refuse the main checkout, live SQLite,
photos, deployment files and canonical CSV as write targets. Do not invoke city-persistence scripts for evaluation.
Candidate methods stay isolated from the published default until a separate rollout decision. Useful category
improvements can be proposed without waiting for all nineteen fields to be independently validated.

At each milestone update PLAN.md and append LOG.md, commit and push this research branch. Run focused tests for
the harness/scorer and real regressions; run the full repository baseline if production code changes. Documentation
alone requires memory consistency and diff checks, not a production rebuild.
Final deliverables must reproduce scores from saved evidence without new subagent invocations.

## 10. First execution milestone

1. Verify this worktree/branch and read the current code and the cited historical summaries.
2. Build the isolated record/replay/scoring skeleton and subagent model/tool availability preflight.
3. Freeze the six-city feasibility protocol and proposed targets; test reference access within its cap.
4. Freeze the 24-city protocol if feasible, record any scope limitation, then establish the repeated v1.1 baseline.
5. Update the exact next action. Do not start tuning before the baseline and scoring contract exist.

The goal format follows [OpenAI's goal guidance](https://developers.openai.com/cookbook/examples/codex/using_goals_in_codex).
The evaluation structure uses explicit objectives, datasets, metrics and comparisons described in
[OpenAI's evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices);
the travel definitions, resource caps and decision margins above are project proposals.

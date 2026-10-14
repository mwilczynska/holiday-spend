# Baseline checkpoint and owner-directed stop

Completed 13 October 2026 (local date). Experiment `000-baseline` is complete; the broader improvement program
is unfinished and stopped at the owner's request. No candidate, extension or confirmation experiment ran.
The replacement designer-led goal is prepared and inactive. Preserve the original `pilot-1` protocol and manifest.

## Finding

The pilot can measure conditional agreement with sparse named-venue food/drink offers in four cities.
It cannot establish population city-price accuracy, dated accommodation accuracy or full daily-budget accuracy.
There is no evidence here that any methodology change improves the estimator: only unchanged v1.1 was tested.
Keep production unchanged. The next authorized research action requires an explicit restart of the revised goal.

Six cities received three registered fresh GPT-6 Luna/Max attempts each. Seventeen responses passed the actual
app schema/FX/materializer; Oaxaca repeat1 ended at the subscription usage limit and remains a failed attempt.
Bandipur repeat2's artifact save failed; one same-worker continuation copied its existing answer without new
estimation/search. The original failure is retained and the continuation counts conservatively against the call cap.
No API key or paid provider API was used. Haiku/Max and Opus/Max execution were not tested in this experiment.

## Accuracy measurements

Public collection used 36 actions plus four independent review opens. Three further campaign actions froze
central-bank FX and independently checked the returned RBA observation. Reference selection and corrections are
recorded in [references](references/); [FX inputs](fx-freeze.json) are independent of model-returned FX.

| Supported scope | Distinct city/measure references | Expected repeat cells | Failed cells | Successful-only median APE | Successful-only p90 APE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Food | 5 | 15 | 1 | 17.0% | 83.0% |
| Drinks | 9 | 27 | 2 | 20.1% | 95.3% |
| Bled ordinary-admission interpretation only | 1 | 3 | 0 | 6.8% | 8.2% |
| All supported cells | 15 | 45 | 3 | 18.9% | 91.7% |

The primary loss is **0.3979 mean absolute log error**, weighting measures within categories, categories within
cities and cities equally, with failed predictions penalized at ln(4). Sensitivity is 0.3402 with ln(2) and 0.4743
with ln(10). This loss is not a percentage. Successful-only mean APE is 30.2%; those raw APE statistics exclude
the failed response and must be read beside the penalized score and coverage. Forty-two cells have successful
predictions. Repeated rows are not 42 independent reference observations: they reuse 15 city/measure cells.

| City | Supported measures | City primary loss | Dated hotel offers | Complete daily baskets |
| --- | --- | ---: | ---: | ---: |
| Hanoi | None | Unscored | 0 | 0 |
| Bandipur | Regular meal, cocktail | 0.7515 | 0 | 0 |
| Oaxaca | Coffee, regular meal, cocktail | 0.5596 | 0 | 0 |
| Bled | Coffee, beer, regular meal, three-course dinner, cocktail, admission | 0.1117 | 0 | 0 |
| Kyoto | None | Unscored | 0 | 0 |
| Copenhagen | Coffee, beer, regular meal, wine | 0.1689 | 0 | 0 |

Bandipur's meal/cocktail estimates are the largest deviations from its sampled menu. This could reflect a weak
small-town price estimate, a venue-selection mismatch, or both; one venue cannot establish city-level bias.
The result does not justify fitting a universal correction. Across successful repeats, the largest per-anchor
population coefficient of variation within a city ranges from 10.7% to 14.8%. Oaxaca has only two successful repeats.
Reproducibility and accuracy are separate findings.

Sixteen of 17 valid responses returned the independently observed latest RBA 13 October observation. Oaxaca
repeat 3 returned 12 October instead: within the app's seven-day validation window but not the latest available
observation required by the prompt. Preserve that distinction; schema validity is not proof of provenance fidelity.
Anchor scores use frozen FX rather than the returned rate. This is a subscription-agent prompt test, not an
API transport, latency, billing or provider-tool equivalence test.

## Reference limitations and review

All primary cells are thin convenience observations from one venue/operator per city/measure, not city-wide
market estimates. Ten of 13 originally accepted rows were independently reviewed; review excluded Hanoi and
Copenhagen admissions because the frozen city-tourism-list selection rule was not established, consistently
with Oaxaca. Four additional menu anchors were captured during review before any candidate selection.
Their prices are recorded as review-sourced observations, not independently re-reviewed rows.

Menus are current retrieved but undated; serving size, tax treatment, meal choice and venue position add
uncertainty. Copenhagen's beer reference is a large 0.5 L serving; its menu also offers medium 0.4 L. Bled's dinner
is one specified three-course menu basket. The Bled activity comparison uses one adult admission against half
the app's two-person budget-activity tier; it does not validate all activity tiers or a typical tourist schedule.

No dated, class/occupancy/tax-matched hotel offer was obtained in any city. From-prices, partial calendars,
premium/blocked menu snippets, bottled beer and special exhibitions remain proxies/missing, never substituted
as primary truth. Hanoi/Kyoto still received all baseline attempts; lack of reference coverage does not make
them correct. The feasibility threshold was met in four cities and multiple categories, but expansion was
not executed because the owner requested a stop and architecture revision.

## Resources and reproduction

- 18 registered prediction attempts plus one artifact recovery: **19/400 estimate-call allowance consumed**;
 381 remain, including the unchanged 100 confirmation reserve.
- Three reference-worker invocations; **43/300 reference retrieval actions consumed**, 257 remain.
- One GPT-6 Astra/Medium architecture-design invocation, recorded in the new architecture's provenance.
- 21 reported estimate search queries; failed-run search telemetry is unknown, not zero. Timing is worker-reported
 and incomplete for two runs; tokens are unavailable. Retain conservative reservations on restart.
- Zero paid provider API calls, production code changes, database writes, CSV migrations or holdout accesses.

Machine authority: [summary.json](experiments/000-baseline/summary.json), which includes all cells, reference
normalization, penalty sensitivity, category scores, repeat dispersion, FX checks and per-run telemetry.
The immutable [dispatch ledger](estimation-dispatches.jsonl) and recovery ledger retain failures and resource use.
The `.gitattributes` file preserves artifact bytes so Git line-ending conversion cannot silently invalidate hashes.

```powershell
node --test scripts/city-cost-accuracy/core.test.mjs
npx tsx scripts/city-cost-accuracy/runner.ts verify
node scripts/city-cost-accuracy/summarize.mjs
```

The summarizer reproduces the same saved summary without new LLM calls or web requests and rejects changed
raw responses/prompts. Five focused safety/scoring tests, standalone TypeScript and memory-mirror checks pass.
Dependencies were installed with lifecycle scripts disabled; no native database or production build claim is made.

## Prepared replacement architecture

[The design-agent blueprint](../../docs/dev/plans/city-cost-experiment-agent-architecture.md) requires Astra/Medium
in Codex or Opus 5.5/Max in Claude Code to design and assess every future experiment. All cost-information
retrieval/generation/verification uses Luna/Max or Haiku 5.5/Max. Program reviews occur after every ten completed
candidate experiments and change only future registrations. The proposed ceiling is 20 candidate attempts,
with cumulative budgets and earlier stops, rather than the original six-candidate cap. This architecture and
[replacement goal](../../CITY-COST-ACCURACY-GOAL.md) are prepared only. No revised experiment has begun.

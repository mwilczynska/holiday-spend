# City-cost accuracy hill-climb program

Started 14 October 2026 on `research/city-cost-accuracy`. Owner-authorized, open-ended, iterative.
Supersedes the designer-led goal (`CITY-COST-ACCURACY-GOAL.md`) for all new work. Earlier experiments and their
reports stay unchanged as history.

## 1. Why the earlier program produced no result

Three runs (baseline, restart-1, redesign-1) spent their effort on building a new venue-level truth set and never
reached a candidate comparison:

- **Truth was rebuilt per experiment.** Each experiment had to acquire fresh references before it could test
  anything. Acquisition failed twice (0 qualifying cities; 0 of 12 eligible pairs), so no method was ever tested.
- **The estimand was too narrow.** Single named-venue menu items and exact-date, class-matched hotel quotes do not
  match the anchors, which describe a city-typical price. Even successful observations measured venue choice.
- **Provenance was asked of the wrong party.** Cheap workers had to hand-write millisecond timestamps, hashes and
  action logs; four of six redesign records failed on that, not on prices.
- **Cheap models were used for reference extraction.** Reference collection is not the thing under test; its
  accuracy matters more than its cost.
- **Process overhead dominated.** Contracts, repairs and assessments ran to thousands of lines per experiment while
  the decision-relevant question (is the estimate close to typical prices?) went unmeasured.
- **Existing evidence was ignored.** `data/reference/dry-run` already held Numbeo captures for 68 cities on the
  same item definitions v1.1 uses.

## 2. Design principles

1. **Build truth once, reuse it many times.** A versioned reference panel is grown in its own workstream. Every
   candidate is scored against the same frozen panel version, so iterations cost only prediction calls.
2. **Measure the city-typical price the anchor defines**, using aggregated sources (crowdsourced cost indexes,
   accommodation listing averages) and triangulating across independent source families.
3. **Tooling captures provenance.** Collectors return URL + verbatim excerpt; the coordinator refetches the page
   and checks the number deterministically. No model writes hashes or timestamps.
4. **Cheap where it is the subject, strong where it is the instrument.** Prediction workers use the serving-class
   model. Reference collectors may use a stronger model; their output is verified by refetch.
5. **One principal change per iteration, judged by a fixed rule** (section 5), then greedy hill-climbing with
   periodic ablation and sealed-test milestones.
6. **Record everything, keep it light.** Each iteration is a directory with `candidate.json`, frozen prompts,
   raw responses, predictions, score and verdict, plus one leaderboard row.

## 3. Target and metric

Unit of accuracy: the ten v1.1 USD anchors for a city, compared with the panel reference for each anchor that has
one. Production makes one call per city, so the primary metric is the **expected single-call loss**:

- run loss = budget-weighted mean of `|ln(prediction / reference)|` over referenced anchors;
- city loss = mean of its run losses; **primary loss** = mean city loss over the dev split;
- a run that fails validation, or omits an anchor, scores `ln 4` for each missing anchor.

Budget weights (`lib.mjs`, fixed for the program) approximate each anchor's share of a mid-tier two-person day:
3-star hotel 0.40, mid-range meal 0.16, inexpensive meal 0.12, 1-star 0.08, beer 0.06, private room 0.05,
cocktail 0.04, dorm 0.03, wine 0.03, coffee 0.03. They are renormalized over the anchors a city has references for.
Secondary figures: unweighted loss, pooled-repeat loss (what a k-call ensemble would score), per-anchor median APE,
mean absolute log error and median log bias, and the p90 city loss. 0.10 loss ≈ 10% typical error.

## 4. Reference panel

`panel/references.jsonl`: one row per city × anchor × source with USD value, local amount, currency, source family,
URL, observation and capture dates, contributor count, grade and split. Per city/anchor reference = geometric mean
across source rows. Built by `seed-panel.mjs` and later collection scripts; the panel hash is frozen into every
iteration.

| Version | Content | Status |
| --- | --- | --- |
| R0 | Numbeo, 68 cities × 4 anchors (inexpensive meal, mid-range meal for two, 0.5 L draught beer, cappuccino), captured 25–26 July 2026, FX 25 July 2026 | Built |
| R1 | Accommodation. Hostelworld city pages (66 cities): median of per-property lowest dorm and private prices for near-term dates; private prices are per person, so the two-person room reference is 2× and graded C. BudgetYourTrip city pages: KAYAK budget and mid-range category ranges (low/peak season, before taxes), geometric mean, mapped to 1-star and 3-star | Collected 15 Oct 2026 UTC |
| R2 | Second food/drink family. livingcost.org (66 cities) agrees with Numbeo within 3–5% on beer, coffee and inexpensive meals, too close to be independent; kept as the `sensitivity` panel, not in the primary panel. An independent family and cocktail/wine glass references are still needed | Partial |
| R3 | Long-tail towns (the cities the app actually adds), where indexes are thin | Later |

Grades: **A** verified aggregate with ≥50 contributors or an explicit large sample; **B** verified aggregate with
20–49 contributors or no sample size; **C** fewer than 20 contributors or unverified. Scoring uses all grades by
default and reports A-only as a check.

Split: deterministic hash of the city key (`hillclimb-split-v1`), 30% test. R0 gives 54 dev and 14 test cities.
Test is sealed: only `score.mjs --test` reads it, and each read is logged in `panel/test-access.jsonl`.

Known reference limits: Numbeo is crowdsourced and can be wrong (Kyoto's mid-range meal for two is ¥5,000, which
looks low). Numbeo beer is 0.5 L while v1.1 says "one standard serving". These limits are why R2 adds a second
source family and why cross-source dispersion sets the **noise floor**: gains smaller than it are not claimed.

## 5. Acceptance rule (implemented in `iterate.mjs assess`)

A candidate is compared with the incumbent on the same dev cities using a paired city bootstrap (10,000 draws).

- **accept**: mean improvement ≥ 0.015, bootstrap lower 95% bound > 0, no anchor's mean absolute log error worse
  by more than 0.05, failure rate not higher by more than 2 points, and ≥90% of cities paired.
- **promising_extend**: the mean and guard conditions hold but the interval crosses zero. Run one more repeat on
  the same cities, then reassess once.
- **reject**: otherwise. **invalid_coverage**: fewer than 90% of cities paired.

Transforms with fitted parameters (calibration) must be scored out-of-sample: fit with leave-one-city-out on dev
and score the held-out predictions. In-sample figures are reported but never used for acceptance.

Changing this rule requires a dated entry in section 10; completed verdicts are never rewritten.

## 6. Iteration mechanics

```
research/city-cost-accuracy/hillclimb/iterations/NNN-slug/
  candidate.json   hypothesis, parent, prompt template, reference date, transform, lane, repeats
  prompt.md        candidate prompt template (when it differs from production)
  transform.mjs    deterministic post-processing of the ten anchors (optional)
  freeze.json      candidate/template/panel hashes and per-task prompt hashes
  tasks/<city>-r<k>/{prompt.txt,system.txt,response.json}
  predictions.jsonl, score-dev.json, ingest.json, verdict.json, NOTES.md
```

1. Write `candidate.json` (+ prompt/transform). `node scripts/city-cost-accuracy/hillclimb/iterate.mjs prepare NNN`.
2. Dispatch one fresh prediction worker per task. The worker receives only `system.txt` + `prompt.txt` and may use
   web search only when the candidate's prompt permits it. The coordinator saves the worker's final text verbatim
   to `response.json`. At most 8 workers run concurrently.
3. `iterate.mjs ingest NNN` then `iterate.mjs assess NNN` (against the parent/incumbent).
4. Write a short `NOTES.md` (what changed, result, what it suggests) and update the incumbent line in section 9.

Replay iterations (`replayFrom`) reuse an earlier iteration's responses with a new transform: formula and
calibration changes cost no model calls.

Repeats: the incumbent baseline uses 3 repeats per city (it also measures run-to-run noise); candidates use 2.

## 7. Lanes and models

| Role | Claude Code | Codex |
| --- | --- | --- |
| Coordinator / designer | Opus 5.5 (this session) | GPT-6 Astra |
| Prediction worker (subject) | Haiku 5.5, max effort, fresh subagent | GPT-6 Luna, max |
| Reference collector (instrument) | Sonnet 5.5, fresh subagent, refetch-verified | GPT-6 Astra or Luna |

Prediction workers are headless `claude -p` processes (`dispatch.mjs`): the task's `system.txt` is the system
prompt (the app's own), `prompt.txt` is the request, WebSearch is the only tool, no MCP servers, empty working
directory, no session persistence. Rendered prompts are byte-identical to the app's `buildCityGenerationV11Prompt`.
The worktree's checkout of the production template has CRLF line endings; all candidate prompts keep the
template's line ending so each differs from its parent only by its intended change.

Hill-climbing runs in the **Haiku lane** (53 library cities were generated by Haiku 5.5 subagents). Production
defaults to `gpt-6-luna`, so every accepted change that is proposed for production must be re-run in the **Luna
lane** and reproduce in direction with at least half the dev gain. Subagents differ from the API transport
(different system context, tool set); results are labelled by lane and never presented as API measurements.
No paid provider API calls or application keys are used.

## 8. Overfitting and honesty controls

- Dev for all decisions; sealed test read only at milestones (after every 5 accepted changes, and before any
  production proposal), at most 6 reads, after which test is refreshed with new cities.
- Every 5 accepted changes, run an **ablation**: remove each accepted change from the incumbent in turn
  (replay where possible). Changes that no longer pay are removed.
- Search-grounded candidates can copy the reference source. They are scored per source family once R2 exists and
  must improve on non-Numbeo families too; until then they are marked `source-reproduction risk`.
- Few-shot or comparable-city candidates that use panel references must exclude the scored city (leave-one-out).
- Stop when the primary loss is within the reference noise floor, when 8 consecutive candidates across at least
  3 hypothesis families are rejected, or on owner stop. A supported "keep v1.1" is a valid outcome.
- Production code, the canonical CSV and the main database are not changed by this program. Rollout is a separate
  decision based on the final report.

## 9. Current state

| Item | Value |
| --- | --- |
| Panel | R1, 68 cities (54 dev / 14 test): Numbeo food/drink, Hostelworld hostels, BudgetYourTrip/KAYAK hotels |
| Legacy reference point | v1 CSV anchors (inverted from tiers): dev loss 0.390 on R1 (0.291 on R0). Hotels about 40% low, meals and coffee about 25% low |
| Production v1.1, Haiku lane | `001-v11-haiku-baseline`: 0.292. Mid-range meal +38%, hostel dorm +26%, private +37%, 3-star +14%, inexpensive meal −10%. Pooling three repeats only reaches 0.286, so run-to-run noise is small |
| Incumbent | `001-v11-haiku-baseline-cal-region`: v1.1 prompt + leave-one-out per-region × per-anchor calibration, **0.207**. Marginal accept (lower bound 0.003) after five zero-call calibration variants on the same dev set; the first test milestone must check it |

## 10. Hypothesis backlog (ordered by expected value per cost)

| ID | Family | Hypothesis | Cost |
| --- | --- | --- | --- |
| H1 | Calibration | Per-anchor multiplicative bias correction (leave-one-out), then per-region shrunk variant | Replay |
| H2 | Specification | State Numbeo-equivalent definitions: 0.5 L draught, regular cappuccino, sit-down inexpensive restaurant, three courses for two without drinks | Calls |
| H3 | Date | State the pricing month and ask for current prices including recent inflation; the legacy CSV's low bias suggests stale price memory | Calls |
| H4 | Elicitation | Ask for anchors in local currency; the server converts (research uses panel FX). Production would need a local FX table | Calls |
| H5 | Reasoning | Ask for two or three typical local examples per anchor before the number | Calls |
| H6 | Ensemble | Median of k = 2–3 calls (serving cap allows 3); pooled-repeat loss estimates it at zero cost | Replay |
| H7 | Grounding | Permit up to 6 searches for anchor prices within the 8-action serving cap | Calls, source-reproduction risk |
| H8 | Comparable cities | Provide 3 reference cities from the same region with their reference anchors (leave-one-out) | Calls |
| H9 | Accommodation | Tier definitions (2 adults, average nightly rate incl. taxes, typical season) once R1 exists | Calls |
| H10 | Formula | Replace `accom_4_star = 3★ × 1.80` with the fitted ladder (1.297) once 4-star references exist | Replay |

## 10a. Round 1 synthesis (15 October 2026)

Prompt candidates 002 (definitions), 003 (current prices), 004 (local currency), 005 (local example) and 007
(comparable-city context) all improve raw accuracy by 0.015-0.075 but none beats the calibrated incumbent (0.2074)
once recalibrated. They shift price levels, which calibration already removes. Remaining error is city-specific
error plus reference noise. Next levers, in order: (1) better accommodation references from booking platforms
(hotels carry 40% of the weight and the current KAYAK-category proxy disagrees with traveller-paid prices by 0.24);
(2) candidates that add city-specific information (009 search grounding); (3) panel R2 (333 dev cities) to detect
smaller gains; (4) accommodation definitions (008), judged against the improved references.

## 10b. Hotel reference level (16 October 2026)

Platform searches (trip.com list API, Booking.com search pages; owner's logged-in sessions; 2 adults, 9-11 March
2027) give 3-star medians that rank cities like BudgetYourTrip/KAYAK (log correlation 0.88 over 56 cities) but sit
about 42% lower (median log gap -0.55 vs the KAYAK mid-range geometric mean, -0.57 vs BudgetYourTrip
traveller-paid). trip.com and Booking.com agree within 2% in Lisbon, Kyoto and Berlin, less well in Cairo, Mexico City
and Hanoi. The absolute hotel level is therefore a definition choice, and calibration inherits it. The estimand is a
typical night for two, so the hotel reference must average stay windows across seasons and weekday/weekend rather
than one off-peak weekday. Next: multi-window Booking.com collection for dev cities, then rebuild the hotel
references as the window average, with platform spread recorded as reference noise.

Cross-platform agreement (16 October 2026, March window): trip.com vs Booking.com 3-star medians over 60 cities,
median log gap +0.058, median absolute 0.130, p90 0.318. Booking.com 3-star vs KAYAK mid-range: -0.593 bias. Booking.com
decent-property p25 vs KAYAK budget: -0.185 bias, 0.248 median absolute. Basic/3-star ratio on Booking.com: median 0.78
(p10 0.59, p90 0.94). Planned R3 hotel reference (coordinator to build after the window run): geometric mean of the
platform 3-star medians, scaled to a year-typical level by the Booking.com window average; basic room = Booking.com
decent-property p25 with the same scaling. Platform spread is recorded per city as reference noise.

R3 adopted (17 October 2026, owner decision of 16 October): the hotel references above are now primary. Raw model
errors rise sharply under R3 (Luna raw 0.288 to 0.435) because models price 3-star at a KAYAK-like mid-range level;
after refitting, corrected errors barely move (022: 0.165 to 0.163), so the correction factors absorb the level change.

## 11. Program revisions

- 14 October 2026: program created; acceptance rule, metric, weights and split frozen as above.
- 15 October 2026 (UTC): primary panel promoted from R0 to R1 before any round-1 verdict; all scores re-made on R1.
- 15 October 2026: **prompt candidates are judged after calibration.** Calibration removes any uniform bias, so a
  prompt change that only moves the price level looks good raw and adds nothing once calibrated. Each prompt
  candidate is therefore assessed as its own calibrated replay (`make-calibrated.mjs`, same calibration form as
  the incumbent, fitted leave-one-out on that candidate's own raw outputs) against the calibrated incumbent. Raw
  verdicts are still recorded for information.

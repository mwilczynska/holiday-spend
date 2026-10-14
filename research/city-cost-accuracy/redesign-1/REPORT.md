# Measurement-redesign experiment: inconclusive reference evidence

14 October 2026. One owner-authorized experiment; new listed-cappuccino evidence stratum. The earlier
baseline and failed restart remain unchanged. No new goal, estimator candidate or production change was made.

## Result

The frozen result is **inconclusive_missing_evidence**: **0 eligible paired observations out of 12 fixed
slots**, across three cities. All 24 expected extraction rows, including missing slots, remain in the record.
There are no complete cities and no recorded protocol breaches. Reference variability and detectability
metrics are **null**, not zero. No estimator was run, so no accuracy improvement was measured.

The first problem occurred before price extraction: one fixed search per city produced only **2/3/2 selected
URLs**, rather than four per city. Even perfect extraction and metadata could not satisfy full coverage.
Source content and provenance introduced additional limitations. The experiment did not establish that
reference prices are stable or unstable, or that useful city-cost accuracy research is impossible.

[Astra/Medium's final assessment](designer-assessment.md) audits the frozen contract, raw evidence and
deterministic replay. The experiment stops after this assessment and report, as designed.

## What Astra designed

The target was a geometric mean of menu-listed regular hot cappuccino prices across four fixed search-result
café slots in each of Hanoi's Hoan Kiem, Oaxaca de Juarez's Centro and Copenhagen's Indre By. It deliberately
did not estimate payable prices, typical city-market prices or daily spending. Unknown charges were recorded
without inventing tax. No currency conversion, hotel search or estimate call was allocated.

Three fresh Luna/Max collectors each had one exact query and up to four original-source opens. They saved
their source frames before opens and could not replace unsuccessful sources. Three fresh blind verifiers
received only those fixed slot URLs plus definitions and independently re-extracted them. They did not see
collector prices, excerpts or eligibility decisions. This is independent extraction of shared public sources;
it is not independent source truth or proof against shared-model interpretation errors.

The intended screen enumerated all six two-venue subsets, three disjoint partitions and four leave-one-out
means. For complete cities, R measures paired extraction discrepancy, S measures subset sensitivity and
U=S+R. The macro sensitivity allowance is B=2*mean(U). A pass required all 12 independent eligible pairs,
every R<=ln(1.01), every U<=0.025 and B<=0.05. These are exploratory frame perturbations, not confidence bounds.

The practical target was a **0.10 absolute reduction in mean absolute log-loss**, separate from the earlier
10% relative-loss criterion. Reference-log movement up to U can move a paired method-loss difference by
up to 2U. A future central gain would need at least0.10+B to retain0.10 throughout this empirical envelope.
There are no complete matched prices here to calculate that allowance, and no predictions to compare.

## Acquisition and execution findings

| City | Selected original URLs / required slots | Recorded source findings | Eligible pairs |
| --- | ---: | --- | ---: |
| Hanoi | 2 / 4 | Café landing page without a listed price; another menu exposed no qualifying readable item. | 0 / 4 |
| Oaxaca | 3 / 4 | Listed items with ambiguous bare-dollar currency, product-selection disagreement, and an absent cappuccino listing. | 0 / 4 |
| Copenhagen | 2 / 4 | Workers classified an address as outside the area and a winter25/26 PDF as expired. | 0 / 4 |

These are worker-reported source interpretations. Copenhagen's postal/address label does not independently
prove its administrative district, and a seasonal menu label does not necessarily prove an explicit expiry.
Those judgements were not independently re-retrieved or corrected. Missing original slots independently
prevent a pass even if such classifications change. Visible but excluded prices are not evidence that no
public price information exists.

All six task responses were saved. Two records are traceable under the frozen provenance rules; four are
untraceable because of malformed timestamp encoding or uncertain/incomplete clock metadata. None produced
an eligible extraction. Failures remain separately labelled and raw bytes were not repaired or retried.

The redesigned parser accepts declared syntactic normalization and preserves unaffected rows rather than
discarding an entire response for incidental fields. It cannot rescue absent sources or missing product,
currency and geography evidence. The manual millisecond-level provenance burden remained fragile for the
cheap workers. Source-selection coverage, source interpretation and instrumentation need separate treatment;
logging failures are not measured price errors.

Native browsing telemetry was unavailable. Action/source records are worker-reported, hash-bound evidence,
not independently captured proof of browsing. Source agreement does not establish population representativeness,
current payable prices or complete daily budgets. Cup size, service mode, dates and ownership remain additional
uncertainty dimensions. Estimator repeat variation was not measured.

## Resources and stop

| Resource | This experiment | Cumulative use / cap |
| --- | ---: | ---: |
| Reference-worker invocations | 6 | 19 / 100 |
| Charged reference actions | 24 / 27 reserved | 97 / 300 |
| Design calls: initial, one repair, assessment | 3 | 7 / 50 |
| Estimate/recovery invocations | 0 | 19 / 400 |
| Estimate retrieval accounting | 0 | 44 / 1,600 |
| Candidates, extensions, confirmation | 0 / 0 / 0 | Not reached |

The 24 charged actions comprise **6 traceable worker-reported actions plus18 conservative full-allocation
charges** for four jobs with unusable provenance. Raw response arrays report17 actions across all six jobs;
that weaker telemetry level is preserved separately and is not17 independently verified actions. Three unused
action reservations were released. No counter was reset. Historical estimate retrieval accounting44 comprises
36 known plus an eight-action convention for unknown old activity; eight is not a proven upper bound.

Confirmation reserves of100 estimate calls,80 reference actions and16 reference workers remain unexecuted.
The outcome is an evidence-acquisition limitation, not budget exhaustion. Engineering totals are three tasks/
four turns, separate from capped design and cost-worker counters. No paid LLM API, application keys, database,
canonical CSV, old holdouts, production defaults, deployment or migration were used or changed.

Only Codex Luna/Max cost workers and Astra/Medium design/assessment were tested. Haiku/Max and Opus/Max
execution remain unverified. Subscription-agent results do not establish API-tool or transport equivalence.

Stop further automatic methodology tuning. This run has no benchmark on which to measure a candidate gain.
A future meaningful evaluation requires a checked reference dataset with explicit unit, currency, geography,
date and selection rules, plus provenance instrumentation that does not depend on a model manually producing
precise clock metadata. Those are prospective lessons, not authorization to recollect or relax this run.
Any later experiment requires a separate decision and designer-authored contract. Keep v1.1 unchanged.

## Reproduction

Contract SHA256: `424a4cab316cc60a9442b84c7b915272d89fa388fd6e47082de59180b2771628`.
The [frozen contract](contract.json), [original design](design.json), [one repair](design-repair.json),
[execution summary](execution-summary.json), [budget journal](budget.jsonl) and [exact task artifacts](tasks/)
preserve all inputs, failed and successful records, hashes, original timestamps and missingness.

```powershell
node --test scripts/city-cost-accuracy/redesign.test.mjs
node scripts/city-cost-accuracy/redesign.mjs summary
node scripts/city-cost-accuracy/redesign-budget.mjs show
npm run docs:check-memory
```

Seventeen redesign tests pass; all42 focused research tests pass together. The summary replays from its
immutable pre-assessment journal prefix while checking subsequent lawful accounting. Original timestamps
are validated at ingestion and replayed from hash-bound sidecars, so later filesystem checkout times do not
change the result. Designer input snapshots preserve the documents as inspected even after PLAN updates.
The earlier closed experiment's evidence and closeout still reproduce unchanged.

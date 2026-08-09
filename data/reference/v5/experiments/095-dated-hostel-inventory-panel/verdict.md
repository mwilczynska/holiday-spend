# Experiment 095 — verdict: NOT EXECUTED

> **NOT EXECUTED — SUPERSEDED BY v6.** This experiment was pre-registered on the v5 branch but never
> run. There are no model calls, no raw responses, no `results.json`, and no findings. It is retained
> only as a record of what the v5 programme intended to do next when it stopped.
> Superseded by `docs/dev/plans/city-cost-methodology-v6.md`.

## Status

| Field | Value |
| --- | --- |
| Pre-registered | Yes — see `experiment.md` and `inputs.json` |
| Executed | **No** |
| Cities called | 0 of 12 |
| Raw responses | none |
| `results.json` | not produced |
| Rows accepted | none |

Do **not** cite this directory as evidence for or against any hostel source. It contains a hypothesis
and nothing else.

## What it was going to test

Whether a date-fixed one-night window (2026-09-17 to 2026-09-18) plus public page reads could recover
current non-`from` Hostelworld or Hostelz prices for a shared dorm bed and a two-guest private hostel
room — that is, whether Experiment 074's 0/12 result was caused by its undated search-only contract
rather than by the source being unusable.

## Why it was not run, and why v6 does not resume it

The v5 programme was paused before execution. v6 does not queue this experiment, for two reasons
recorded in `docs/dev/plans/city-cost-methodology-v6.md` §1:

1. **It targets the estimand v6 stopped trying to measure.** The dorm/private hostel split had already
   consumed Experiments 039, 040, 047, 048, 070, 072, 073, and 074 without producing a mappable value.
   v6 ships both hostel tiers at evidence grade C, derived from the measured 3-star anchor via the v4
   blended hostel ratio, rather than continuing to search for a source that states occupancy.

2. **It would have been the ninth accommodation-source experiment in a row to fail the same gate for
   the same structural reason** — public inventory pages do not co-emit price, exact dates, occupancy,
   and tax status. v6's three-strikes rule (`LOOP-PROMPT-V6.md` §5) classifies that as a defective
   gate rather than a source worth a ninth attempt.

## If a future cycle wants to revisit it

The hypothesis is not unreasonable and the pre-registration is sound. It belongs in **M5 (improve weak
grades)**, not in the critical path, and only after M1–M4 have shipped. Read
`docs/dev/plans/city-cost-methodology-v6.md` §6 before starting it, and treat any result as a grade
improvement for `accom_shared_hostel_dorm` / `accom_hostel_private_room`, never as a shipping blocker.

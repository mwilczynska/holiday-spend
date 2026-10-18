# City-cost accuracy research

**Status:** Round 6 complete (17 October 2026). Its recommendation shipped as city-cost methodology v1.2 on
18 October 2026. The research is kept, with all data, for future rounds.

## Where it lives

| What | Where |
| --- | --- |
| Research branch (harness, reference panels, every iteration, logs) | `research/city-cost-accuracy` |
| Immutable snapshot of the round that produced v1.2 | tag `city-cost-research-r3-2026-10-17` |
| Program, acceptance rule and revisions | `research/city-cost-accuracy/hillclimb/PROGRAM.md` on the branch |
| Scripts | `scripts/city-cost-accuracy/hillclimb/` on the branch |
| Final report | `research/city-cost-accuracy/hillclimb/final-report.html` on the branch; published page https://claude.ai/artifact/JEbTYYGxwwT3ziAbeZW1AS |
| Progress chart and methodology guide | `research/city-cost-accuracy/hillclimb/progress.html`; published page https://claude.ai/artifact/GSdP69DDreugCNUwX2HfcC |

The published pages are private to the owner unless shared.

## What it measured

The question was how close a generated city's ten USD prices are to real prices. Each experiment was scored as the
budget-weighted mean of |ln(estimate ÷ reference)| per city, averaged over 333 development cities. 142 further cities
were set aside by a fixed hash before any experiment and scored only to confirm the final choice.

Reference prices (panel R3): Numbeo city medians for meals, beer and coffee (livingcost.org where Numbeo had no page),
Hostelworld for hostels, and actual 3-star and basic-hotel prices from Booking.com and Trip.com averaged over six stay
dates across a year. Hotel prices were collected in the owner's signed-in browser sessions. Cocktail prices from
Expatistan were collected but kept out of the score, because the model's own searches reproduce them.

A change was accepted only if it improved the average by at least 0.015 with a 95% paired-bootstrap range above zero,
made no item worse by more than 0.05 and did not raise the failure rate. The rule was fixed before the experiments.

## Results

| Method | Development (333) | Held-out (142) |
| --- | --- | --- |
| v1.1, uncorrected (GPT-6 Luna) | 0.435 | not measured |
| Luna + correction per item and region | 0.205 | 0.220 |
| v1.2: Luna + food/drink search + correction per country within region (bundle 022) | 0.163 | 0.190 |

Rejected: prompt rewording (definitions, current prices, local currency, local examples, comparable cities),
averaging Luna with Haiku, accommodation search (104), hostel-only search (106), booking prices of comparable cities as
context (107), a slope correction for hostels (023). Withdrawn by the owner: a lower reasoning effort and repeated calls.

Main findings: most of the gain is the correction, because model 3-star prices sit about 60% above booking-site prices;
search fixes food and drink; the remaining hotel error is about which cities are dearer, which neither search nor
correction supplies.

## Continuing the research

Work on the research branch, not on `main`:

```bash
git worktree add ../city-cost-accuracy research/city-cost-accuracy
```

- Register a new iteration under `research/city-cost-accuracy/hillclimb/iterations/` (see `LOOP.md` on the branch),
  freeze it with `iterate.mjs prepare`, collect answers (Codex prompts `CODEX-LUNA-*-PROMPT.md` show the pattern: six
  concurrent GPT-6 Luna Max workers, verbatim prompts, no worker logs committed), then `ingest` and `assess`.
- The held-out cities have been read four times (logged in `panel/test-access.jsonl`). Use them again only to confirm a
  new candidate that has already won on the development cities.
- To refresh the production correction table, collect current reference prices, rebuild the panel, then run
  `build-production-corrections.mjs <app>/src/lib/data/city-cost-corrections-v1-2.json` and bump the table version.
- Open leads: year-typical hostel references (so hostel factors can be enabled); a better private-room reference; a
  second booking platform for the cities that have only one; hotel ranking information at generation time.

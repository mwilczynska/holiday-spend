# Holiday Spend — Plan

The working document. Current plan, milestone status, and open decisions.

Completed history and methodology results live in [LOG.md](LOG.md). Project overview is in
[CLAUDE.md](CLAUDE.md).

**Last reviewed:** 31 July 2026

---

## Where things stand

The app is feature-complete for its purpose and stable: planning, tracking, dashboard, saved plans and
comparison all work. `npm run build` passes, 142 Vitest tests pass, Playwright covers planner and
compare regressions.

**The open workstream is city cost methodology v4.** It has two halves at very different maturity:

| Half | Status |
| --- | --- |
| Collection contract (`docs/prompts/llm_prompt_city_anchors_v4.md`) | **Tested end to end**, 20+ runs across five cities with a small fast model |
| App integration | **Not started.** No v4 calculator, no anchor schema, no ingestion route |

Meanwhile **v1 still ships** — including the `× 1.80` four-star multiplier that v4 measured and refuted.
Every user-facing city cost today comes from the old path.

---

## Open decisions

These block or shape the work below. Each needs an explicit answer, not a default.

### D1 — Which accommodation figure do we read? *(blocking)*

Two committed documents give opposite instructions, both dated 27 July 2026:

- `docs/product/methodology-v4.md` §9.4.4 — **"Headline averages are adopted, on stability."**
- `docs/dev/plans/accommodation-collection-v4.md` — **"Never read the headline average."**

The second commit is later and its evidence is stronger (a full 108-property inventory read versus two
Copenhagen runs), so it should win — but this has never been stated, and both files currently read as
active guidance. **Nothing downstream can be built until this is settled**, because it determines what the
collection contract asks for.

A third option is on the table and untested: the **geometric mean** of headline and property median, which
landed +3.9% and +14.2% against Copenhagen where the individual bases were +54% and −15/−30%. It costs
nothing extra to compute and can be tested retrospectively against any city where quotes are later
obtained. It is deliberately *not* adopted on one city's evidence.

### D2 — What accuracy gate do we publish?

The design targeted ≤15% median APE for food and drinks. Nothing reaches it; selected models land at
18.2%, 21.3% and 22.0%. The sample frame is closed, so no further collection can change this.

Recommendation from the methodology: **publish ≤25% and state achieved figures alongside.** The
alternative — adding a second predictor — is a design change, not a data problem, and should be evaluated
on its own rather than used to keep an unmet target alive.

### D3 — Do we reverse the Hostelworld exclusion?

Booking.com and Trip.com were brought in scope by owner decision. **Hostelworld was not.** It is the only
identified channel that labels hostel units, and without it `accom_shared_hostel_dorm` and
`accom_hostel_private_room` cannot be separated — the Booking.com hostels page yields one blended measure.
The alternative is occupancy-controlled search, which needs a browser.

### D4 — Is browser automation in scope?

Three separate blockers resolve to this one question: accommodation ground truth beyond Copenhagen,
date-controlled level reads, and the dorm/private split. A plain page fetch cannot clear any of them.
The project has so far held a "no browser automation" line for the small-model requirement.

---

## Milestones

### Completed

| Milestone | Outcome |
| --- | --- |
| Phases 1–5 — app foundations through city cost migration | Shipped. See LOG.md Part 4 |
| Native accounts alongside Google OAuth | Shipped |
| Saved plans and multi-plan comparison | Shipped |
| Dashboard simplification | Shipped |
| Canonical country dataset | Shipped |
| Live LLM model discovery | Shipped |
| Legacy code cleanup | Shipped |
| **Phase 6 / methodology v3** | **Abandoned** at 22.8% coverage, zero complete cities |
| v4 evidence gathering | Closed 99-city frame; all 121 production cities attempted |
| v4 ratio model selection | Four relationships settled; forms stable under strict-sample re-fit |
| v4 collection contract | Tested end to end; 0.0% error on 29/29 measures when direct lookup succeeds |
| v4 accommodation class ladder | 1.297 / 0.734 / 0.592 fitted; incumbent 1.800 refuted |

### In progress

| Milestone | State |
| --- | --- |
| **Documentation restructure** | This pass — CLAUDE.md rewritten (868 → ~260 lines), LOG.md and PLAN.md created, superseded docs moved under `archive/` with status banners, and inventories added for `data/reference/`, `scripts/` and `docs/prompts/` |
| **Dashboard as-of date** | Code complete and tested, **uncommitted**. Switches the dashboard from `today` to the last transaction date. New `src/lib/dashboard-as-of.ts` + tests |

### To do — v4, in dependency order

**1. Settle D1.** Reconcile the two accommodation documents and mark one superseded. No collection work
should start before this. *Cheap — a decision and an edit.*

**2. Collect accommodation ground truth in three or four cities.** The highest-value work outstanding.
It unblocks the ~50% bias figure, the D1 decision's evidence base, and the geometric-mean test
simultaneously. **Needs browser automation or manual collection** (see D4) — 11 plain-fetch attempts in
Lisbon returned zero usable quotes, and the failure modes are structural.

**3. Calibrate the four shipped ratios.** The fitted relationships are *proxies*: they settle whether each
model needs cost bands, not the coefficient values. Requires ~160 paired observations across 20 cities
spanning all nine regions and the full cost range, 25% held out per relationship. One-off — it does not
recur, because refresh re-measures level and leaves structure alone.

| Requirement | Size | Fits |
| --- | --- | --- |
| Paired `street_food` + `mcmeal` | 20 cities across three bands | M1 |
| Paired `premium` + `midrange` | 20 cities | M2 |
| Paired `cocktail`, `wine_glass` + `beer` | 20 cities | M3, M4 |
| Direct `half_day`, `full_day` | ongoing | No model exists — collect or publish missing |

**4. Build the ingestion path.** Nothing here exists yet:

- `src/lib/city-cost-anchor-schema.ts` — Zod schema plus the validation gates of §9.2
- `src/lib/city-cost-anchor-extraction.ts` — search-backed extraction, 3-sample median, dispersion
- `src/lib/city-cost-v4-calculator.ts` — the deterministic 19-tier derivation of §7.1
- `src/lib/data/city-cost-ratios.generated.json` — fitted ratios with CIs and model form
- `scripts/calibrate-city-cost-ratios.ts`, `scripts/validate-city-cost-v4.ts`
- Persistence, then a paced 121-city batch collector (10–15 cities/day, checkpointed)

**5. Migrate the dataset**, retaining the prior CSV and a tested rollback path.

**6. Publish the v4 methodology to users.** The `/estimates` page still describes v2.1/v3 — its content is
hardcoded in `src/app/estimates/page.tsx`, not read from any doc. Rewrite it from
`docs/product/methodology-v4.md` at ship time, not before validation: publishing achieved rather than
aspirational figures is the point. The superseded text is kept at
`docs/product/archive/methodology-v2-v3.md`.

### To do — app backlog

Lower priority than the methodology work.

- [ ] Add tests around city generation parsing and Wise import format handling
- [ ] Expand Playwright from planner regressions into full add-leg / generation success-path tests
- [ ] Add provider/model capability validation for planner transport estimation, especially
      browse-enabled model compatibility
- [ ] Add automated coverage around bulk transport estimation, provider fallback, and planner apply flows
- [ ] Consider transport-estimation caching — explicitly deprioritised

### Housekeeping

- [x] Add npm aliases for the six v4 scripts — now `npm run methodology:v4:*`
- [x] Mark stale methodologies and data explicitly — `archive/` folders with status banners, plus
      inventories at `data/reference/README.md`, `scripts/README.md`, `docs/prompts/README.md`
- [ ] Decide whether the 1.9 MB v3 accommodation panel artifacts stay in the repo. They are superseded but
      are the provenance model v4 quote records follow, and six test files read them. Deleting means
      deleting the tests too — a deliberate choice, not a tidy-up
- [ ] Delete `.local/data-0ace327c-…-batch-0000.zip` once confirmed unwanted — a Claude conversation
      export, not project material
- [ ] Commit the dashboard as-of work separately from the documentation restructure
- [ ] Give the two accommodation fitting scripts a `--check` mode. They embed `generatedAt`, so their
      artifacts cannot be diff-verified the way `:fit-ratios` can

---

## Traps worth re-reading before touching the methodology

Each of these cost real time to discover. Full detail in LOG.md Part 1.

1. **A model's stated reason for a failure is a hypothesis, not evidence.** Verify independently — it is
   usually one command.
2. **Most "model unreliability" was contract defects.** The model obeyed correctly; the instruction was
   wrong.
3. **Do not ask a model to grade its own work.** Self-assessed confidence was wrong in every run, always
   flatteringly.
4. **A contract that fights the shape of its sources will lose**, however firmly worded.
5. **Check the underlying record, not your own summary.**
6. **On a rate-limited response, defer the city — never fall through to search.** That difference is exact
   values versus 10–19% error.
7. **Do not adopt a promising result on one city's evidence.** That specific error has already been made
   and corrected once.

# LOOP-PROMPT-V6

**The autonomous work prompt for city cost methodology v6.** Paste the block in §PROMPT below to start
or resume the loop.

**Predecessor:** `docs/dev/archive/loop-prompt-v5.md` — superseded, do not run. It could not terminate;
its banner explains exactly why, and this prompt is built to avoid each of those failures.

---

## Why this prompt is different

The v5 loop ran 95 experiments and shipped nothing. Four specific changes prevent a repeat:

| v5 failure | v6 rule |
| --- | --- |
| Shipping forbidden until gates pass; gates unreachable | **Ship at M1, before any accuracy work** |
| "Never polish a workable model while another category is incomplete" → forced onto the hardest category forever | **Bank the workable categories first.** A category with three structural failures is downgraded and left |
| No exit when a gate is the defect | **Three-strikes rule:** three consecutive failures on one gate for the same structural reason ⇒ stop and report the gate, do not attempt a fourth |
| Unbounded experiments per field (15 on `accom_1_star` alone) | **Budget: 8 experiments per product field.** Exceeding it means accept a lower grade, not run a ninth |

---

## PROMPT

Copy everything between the rules below.

---

Work autonomously on branch `feat/city-cost-methodology-v6` on the city cost methodology v6 workstream.

### 0. Orient before acting

Read these, in this order. Do not skip and do not act before finishing them.

1. `docs/dev/handoffs/city-cost-v6.md` — **the restartable handoff. It names the exact next action.**
2. `PLAN.md` — current milestone, status, open decisions
3. `docs/dev/plans/city-cost-methodology-v6.md` — the methodology, and §1's diagnosis of why v5 failed
4. `data/reference/v6/data-dictionary-v6.md` — frozen estimands and the A/B/C/D evidence grades
5. `data/reference/v6/validation-manifest-v6.json` — frozen gates and the locked holdout
6. `data/reference/v6/coefficients-v6.json` — the fitted ladder (generated; never hand-edit)
7. `CLAUDE.md` — project memory

Then verify the worktree is clean and run `npm run docs:check-memory`.

Do **not** re-read the 95 v5 experiment directories. Their conclusions are summarised in `LOG.md` and
`data/reference/v6/README.md`. Read a specific v5 experiment only when you need its raw rows.

### 1. The objective

Produce all 19 planner cost values for any in-scope city, each carrying an evidence grade and an
interval, at a refresh cost cheap enough to actually re-run.

The 19 values, their estimands, and their derivation paths are in `data/reference/v6/data-dictionary-v6.md`
§2. **Do not redefine an estimand.** v6 changed evidence admissibility, not product meaning.

### 2. Ship first — the milestone order is not negotiable

| Milestone | Exit criterion |
| --- | --- |
| **M1 — integrate** | v6 derivation + grades + ladder wired behind a feature flag; a new city generates through v6 end to end; the 121-city CSV untouched; tests pass |
| **M2 — ground truth** | The 40-city × 6-anchor panel in `validation-manifest-v6.json` collected, 15-city holdout still sealed |
| **M3 — fit and validate** | Source offsets fitted; gates 1–10 scored and reported per tier, per region, per band |
| **M4 — migrate** | 121 cities regenerated with grades; A/B diff vs v1 produced; rollback tested |
| **M5 — improve weak grades** | Ongoing: `accom_1_star`, the dorm/private split, activity semantics |

**M1 comes first and is not deferred for accuracy work.** After M1 the app has a working generation path
regardless of what M2–M5 conclude. This is the single most important difference from v5, which deferred
all integration until an acceptance that never arrived.

Do not start M(n+1) before M(n)'s exit criterion is met. Do not skip M1 because a source looks promising.

### 3. Constraints

**Production collection:**

- Free sources only. No paid data APIs, no source API key, no source account, no paywall, no member rate.
- Works signed out. Never bypass a CAPTCHA, block, or rate limit.
- Search snippets only in the production path. Direct page reads are rejected — Experiment 015 returned
  HTTP 503/429 on canonical Numbeo URLs and Experiment 013 had all 15 booking-engine URLs blocked.
- Budget per city: **≤6 LLM calls, ≤25 searches, ≤A$0.15**. Full 121-city refresh **≤A$20 and ≤24h**.
- Retry on a 429/503 or block **is allowed** and must be recorded. On repeated block, fall to the next
  grade — never silently substitute a different source.
- Target models: GPT-5.6 Luna or Claude Haiku-class.

**Ground truth is different and this distinction matters:**

- Ground truth **may** be collected by browser automation, manual research, or a stronger model, because
  it is never in the production path.
- Only **production** collection must be target-model feasible.
- v5 permitted this but never spent effort there. Do not repeat that.

**Division of labour:**

- The LLM is a **structured extractor, never an estimator**. It reports source facts in source currency
  with provenance. It performs no arithmetic, no FX, no aggregation, no tier construction.
- Deterministic code owns FX, baskets, ratios, grading, intervals and validation.
- Never ask a model to grade its own work. v4 found self-reported confidence wrong in every run and
  always flatteringly.

**Honesty:**

- Every value carries a grade: A observed / B source proxy / C laddered / D regional prior / definitional.
- A modelled or imputed value is **never** presentable as observed.
- `not_found`, `blocked`, `stale` and `class_absent` stay distinct. A blocked page is never recorded as
  missing data.
- Never hide missingness behind a plausible substitute. Grade D is the honest answer, not a substitution.

### 4. The experiment loop

Only from M2 onward. M1 is implementation, not experimentation.

1. Identify the largest remaining uncertainty **that is on the critical path for the current milestone**.
2. Inspect existing evidence before collecting anything. Check `data/reference/v6/README.md` and `LOG.md`
   first — the answer is often already collected.
3. State one falsifiable hypothesis.
4. Pre-register in `data/reference/v6/experiments/<NNN-slug>/experiment.md`: hypothesis, source, sample,
   held-out units, prompt, target model, metrics, promotion gate, rejection rule, maximum calls.
5. Build the smallest experiment that can reject the hypothesis.
6. Run it. Inspect raw responses — independently verify any explanation a model gives for a failure.
   A model's stated reason for a block is a hypothesis, not evidence.
7. Score with a deterministic script. Support `--check`.
8. Give exactly one verdict: reject / revise and retest / promote / accept.
9. Record it, update `PLAN.md` and the handoff, commit, push.

### 5. Stopping rules — read these before starting any experiment

These exist because v5 had none. They are the difference between a loop and a spiral.

**Three-strikes rule.** If three consecutive experiments fail the *same gate* for the *same structural
reason*, stop. Report the gate as the defect. Do **not** attempt a fourth. Either amend the gate with a
dated decision recorded in `PLAN.md` and the manifest, or accept a lower evidence grade for that field
and move on.

**Per-field experiment budget: 8.** Count experiments per product field across the whole programme.
Reaching 8 means the field gets its best available grade and the loop moves on. It does not mean run a
ninth. *(v5 ran 15 on `accom_1_star` and got zero rows.)*

**Bank what works.** When a category reaches a usable grade, bank it and move on. Do not keep optimising
a solved category, and do not refuse to bank it because another category is unsolved. This directly
reverses the v5 instruction that caused the failure.

**Grade D is a valid outcome.** A field that cannot be measured ships at grade D with a wide interval.
That is a completed field, not a blocked one.

**A gate may be amended, never weakened after the fact.** Amend before the holdout is used, with a dated
rationale in `PLAN.md` and `validation-manifest-v6.json`. Never weaken a gate after seeing a disappointing
result in order to declare success. The converse now also holds: **a gate no method can meet is a defect
in the gate**, and leaving it unamended is not integrity, it is paralysis.

**The locked holdout is locked.** The 15 cities in `validation-manifest-v6.json` are revealed once per
candidate freeze. If you have seen holdout results, you may not then change a coefficient, prompt or gate.

### 6. When to stop and ask the user

Stop and ask only when genuinely blocked:

- a credential or permission you do not have;
- a **product** decision that cannot be resolved empirically — the four open ones are listed in
  `docs/dev/plans/city-cost-methodology-v6.md` §8, each with a stated default so work is never blocked
  waiting for an answer;
- a three-strikes trigger where both amending the gate and accepting a lower grade would materially
  change the product.

Otherwise proceed. Do not ask the user to choose between options an experiment can settle.

### 7. Definition of Done

v6 is done when **all** of these are true. Every one is reachable; check them off rather than treating
them as aspirational.

1. M1–M4 exit criteria met.
2. All 19 fields produced for ≥95% of in-scope cities, every value graded and intervalled.
3. `validation-manifest-v6.json` gates 1–10 scored and reported per tier, per region and per band, with
   achieved figures stated — including any that fail, with the reason.
4. **Gate 6 passes: v6 beats shipping v1 on ≥15 of 19 tiers and loses on none by more than 10%.**
5. Coefficients reproducible: `node scripts/fit-city-cost-ladder-v6.mjs --check` exits 0.
6. Locked holdout revealed exactly once, results reported unmodified.
7. The 121-city dataset regenerated with grades, A/B diff against v1 produced, rollback tested.
8. Grade and interval visible in the UI; no grade C/D value renderable without its grade.
9. `PLAN.md`, `LOG.md`, `docs/dev/plans/city-cost-methodology-v6.md`, `docs/dev/handoffs/city-cost-v6.md`,
   `data/reference/v6/README.md` and the data/prompt/script inventories all current.
10. Verification passes:
    - `npx tsc --noEmit`
    - `npm run build`
    - `npm test -- --run`
    - `npm run docs:check-memory`
    - `node scripts/fit-city-cost-ladder-v6.mjs --check`
11. All work committed and pushed on `feat/city-cost-methodology-v6`.

**A gate that fails is reported as failing.** v6 may ship with a documented failing gate if the product
decision is to accept it — that is the user's call, recorded with a dated rationale. What is not
acceptable is failing quietly, or restarting the collection spiral to avoid reporting it.

### 8. At the end of every work cycle

1. Record the verdict or milestone progress in `PLAN.md`.
2. Append confirmed results to `LOG.md`.
3. **Update `docs/dev/handoffs/city-cost-v6.md` so a cold agent can resume from it alone.** State the
   exact next action, not a general direction.
4. Commit and push.
5. Begin the next item, unless the Definition of Done is met or §6 applies.

---

## Resume line

To resume an in-progress v6 loop, use:

> Resume the city cost methodology v6 workstream on branch `feat/city-cost-methodology-v6`. Read
> `docs/dev/handoffs/city-cost-v6.md` first and continue from the exact next action it names. Follow
> `LOOP-PROMPT-V6.md`, including its stopping rules in §5. Do not mark the goal complete unless the
> Definition of Done in §7 passes.

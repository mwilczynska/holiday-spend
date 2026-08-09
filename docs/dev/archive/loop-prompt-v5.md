> **SUPERSEDED — DO NOT RUN.** This is the loop prompt that drove the v5 experiment programme. It was
> moved here from the repo root on 9 August 2026 and replaced by `LOOP-PROMPT-V6.md`.
>
> **It is retained because it is required reading, not because it is reusable.** It is an unusually
> rigorous research protocol that nonetheless cannot terminate, and understanding why is the entire
> justification for v6. Three instructions combine into an infinite loop:
>
> 1. *"Do not migrate the production dataset or wire v5 into the application until the methodology passes
>    its gates"* — shipping is forbidden until a condition is met.
> 2. *"Do not stop after ... partially solving one category. Continue selecting and executing the next
>    highest-value experiment until the Definition of Done is satisfied"* — the loop cannot exit.
> 3. *"Do not ... polish an already workable food model while accommodation or activities still prevent a
>    complete result"* — the loop is **required** to spend its effort on the least tractable category.
>
> Combined with acceptance gates that public sources cannot satisfy (30 matched cities per relationship;
> row-level occupancy and tax metadata), the result was 95 experiments, zero product mappings, and the
> known-defective v1 dataset still shipping. **61 of 95 experiments went to accommodation, and 15 of those
> to `accom_1_star` alone, producing zero usable rows.**
>
> Full diagnosis: `docs/dev/plans/city-cost-methodology-v6.md` §1.
> Replacement: `LOOP-PROMPT-V6.md` at the repo root.
>
> Its *experimental discipline* — pre-registration, falsifiable hypotheses, deterministic scoring, raw
> artifact retention, one verdict per candidate — was excellent and is carried forward into v6 unchanged.

---

/goal

Work autonomously and continuously on the current branch
  `feat/city-cost-methodology-v5` until you have designed and empirically
  validated a production-ready city-cost methodology satisfying the Definition
  of Done below.

  Use the persistent goal mechanism if available. Create an active goal for this
  objective and do not mark it complete merely because you have written a plan,
  finished a pilot, found a promising source, or completed one category. Continue
  across turns and context compactions. At the end of each work cycle, select and
  begin the next highest-value experiment while the goal remains unmet.

  Do not wait for me to choose between alternatives that can be resolved by an
  experiment. Ask only when genuinely blocked by unavailable credentials,
  permissions, or a product decision that cannot safely be inferred.

  ## Scope

  The objective of this loop is to select, validate, and fully document the v5
  methodology. It must be implementation-ready, but do not spend time integrating
  it into the shipping application or migrating all 121 cities until it passes
  the acceptance gates. Once it passes, update PLAN.md with the subsequent
  integration, migration, and rollback milestones.

  v4 is prior evidence, not the presumed answer. Preserve useful evidence and
  reproducible artifacts, but reconsider its assumptions and do not merely rename
  v4 as v5.

  ## Start by reconstructing the project state

  Before changing anything:

  1. Confirm the branch and inspect the worktree. Preserve unrelated user changes.
  2. Read, in full where relevant:
     - CLAUDE.md and AGENTS.md
     - PLAN.md and LOG.md
     - docs/product/methodology-v4.md
     - docs/dev/handoffs/city-cost-v4.md
     - current files under docs/dev/plans/
     - docs/prompts/README.md
     - data/reference/README.md
     - scripts/README.md
     - the shipping city-generation prompt, client, schema, persistence path,
       tests, and provider web-search implementations
  3. Respect archive/status banners. Historical artifacts may be used as
     evidence but do not describe current behaviour unless explicitly identified
     as still live.
  4. Run `npm run docs:check-memory`.
  5. Rewrite PLAN.md as the current v5 working plan, preserving unrelated app
     backlog. Record settled historical results in LOG.md rather than keeping
     change history in PLAN.md.

  ## Required product outputs

  The methodology must produce these 19 values:

  - accom_shared_hostel_dorm
  - accom_hostel_private_room
  - accom_1_star
  - accom_2_star
  - accom_3_star
  - accom_4_star
  - food_street_food
  - food_budget
  - food_mid_range
  - food_high_end
  - drink_coffee
  - drinks_none
  - drinks_light
  - drinks_moderate
  - drinks_heavy
  - activities_free
  - activities_budget
  - activities_mid_range
  - activities_high_end

  Accommodation is per night for two travellers. Food, drinks, and activities
  are per day for two travellers. Base data is ultimately stored in AUD for two
  people, but the extraction model should normally report source currency and
  leave arithmetic and FX conversion to deterministic code.

  Before comparing methods, create a versioned data dictionary that freezes the
  estimand for every value: unit, party size, inclusions, taxes/fees, reference
  period, price statistic, and treatment of missing or genuinely absent classes.
  Do not compare observations with incompatible definitions.

  The target is numeric coverage of all 19 fields for ordinary in-scope cities.
  If a genuine class absence makes a numeric value dishonest, define an explicit
  product treatment for that case. Do not invent a price or silently count an
  unsupported value as coverage.

  Every resulting value must carry an evidence basis such as:

  - observed
  - modelled from named observed inputs
  - imputed fallback
  - definitional, such as activities_free = 0

  A modelled or imputed value must never be presented as observed.

  ## Production constraints

  A user adding one city must require exactly one user-initiated LLM provider
  request using a fast, inexpensive target model: GPT-5.6 Luna or a Claude
  Haiku-class model. Record the exact provider model ID and parameters in every
  test.

  Built-in web-search or page-retrieval operations performed inside that provider
  request are permitted, but retries, second samples, or follow-up LLM calls are
  not part of the production path. Count and report all searches, page reads,
  tokens, latency, and provider cost associated with the request.

  Prompt feasibility must be tested on the target cheap model. Results from a
  larger reasoning model may help design an experiment but are not evidence that
  the production prompt works. A winning method must pass on at least one target
  cheap model. Before final acceptance, run a smaller portability test on the
  other target model when it is available.

  The source method mustI’d use the prompt below. It converts “find a methodology that works” into a persistent experimental loop with measurable exit
  gates.

  A few repo facts materially shaped it:

  - `feat/city-cost-methodology-v5` is clean and currently identical to `main`.
  - v1 still ships and asks the LLM to research, calculate tiers, and convert FX even though the request provides no web-search tools.
  - v4 contains useful evidence, but is not production-ready: accommodation level and hostel separation remain unresolved, activities lack a derivation
  path, and four proposed relationships were fitted only using proxies.
  - `CLAUDE.md` and `AGENTS.md` are currently synchronized.
  - The proposed scope below ends at a validated, implementation-ready methodology. App integration and full dataset migration follow only after it
  passes.

  ## Improved loop prompt

  ```text
  Work autonomously and continuously on the current branch
  `feat/city-cost-methodology-v5`.

  Create an active goal using the goal mechanism if available:

  “Design, empirically validate, document, and make implementation-ready a
  production city-cost methodology v5 that can generate the 19 required values
  for a new city from one cheap, fast, web-enabled LLM call.”

  Keep that goal active across turns and context compactions. Do not stop after
  writing a plan, completing one experiment, finding a promising source, or
  partially solving one category. Continue selecting and executing the next
  highest-value experiment until the Definition of Done below is satisfied.

  The goal of this loop is methodology selection and validation. Do not migrate
  the production dataset or wire v5 into the application until the methodology
  passes its gates. Once it passes, leave an implementation-ready specification
  and update PLAN.md with the integration and migration milestones.

  ══════════════════════════════════════════════════════════════════════════════
  1. REQUIRED OUTPUT
  ══════════════════════════════════════════════════════════════════════════════

  The methodology must produce these 19 values:

  Accommodation, per night for two travellers:
  - accom_shared_hostel_dorm
  - accom_hostel_private_room
  - accom_1_star
  - accom_2_star
  - accom_3_star
  - accom_4_star

  Food, per day for two travellers:
  - food_street_food
  - food_budget
  - food_mid_range
  - food_high_end

  Drinks:
  - drink_coffee
  - drinks_none
  - drinks_light
  - drinks_moderate
  - drinks_heavy

  Activities, per day for two travellers:
  - activities_free
  - activities_budget
  - activities_mid_range
  - activities_high_end

  City base costs remain stored in AUD for two people. Traveller-count scaling
  remains a runtime application concern.

  The final methodology may directly collect some inputs and model others.
  It does not need to observe all 19 values directly.

  Before testing candidates, freeze a data dictionary defining every target:
  - exact estimand;
  - unit and party size;
  - time basis;
  - inclusions such as taxes and fees;
  - reference-date or season convention;
  - acceptable source bases;
  - aggregation statistic;
  - handling of genuinely absent categories.

  Do not compare numbers whose definitions or bases differ.

  The intended product output is complete numeric coverage. If a genuine class
  absence makes a numeric value inappropriate, resolve that as an explicit
  product-semantic decision. Do not invent a price, silently substitute another
  class, or call missing data complete coverage.

  ══════════════════════════════════════════════════════════════════════════════
  2. PRODUCTION CONSTRAINTS
  ══════════════════════════════════════════════════════════════════════════════

  Adding a city in production must require one user-initiated LLM provider
  request to a cheap, fast model. Built-in web searches performed inside that
  request are allowed, but retries, multi-sample medians, follow-up LLM calls,
  human intervention, and a separate research programme are not part of the
  production path.

  Test extraction prompts using the exact GPT-5.6 Luna model available in the
  environment or a Claude Haiku-class model. Record the provider, exact model id,
  parameters, date, token use, latency, web-tool behaviour, and raw response.

  A candidate cannot be accepted because it works with a stronger model.
  It must pass on at least one target cheap model. Before final acceptance, test
  a smaller cross-provider set on the other target model when it is available.

  The LLM provider naturally requires its normal provider credential. The price
  sources themselves must:
  - be free to access;
  - require no source-specific API key;
  - require no source account or login;
  - not be paywalled;
  - work signed out;
  - be usable at household steady-state volume of a few new cities per week.

  No paid data or scraping APIs may be used.

  Do not inherit old website exclusions as axioms. Publicly accessible sources,
  including sources previously excluded or deferred, may be reconsidered and
  tested. Browser or manual research may be used for one-off ground-truth
  collection and source evaluation.

  However:
  - do not bypass CAPTCHAs, blocks, access controls, or rate limits;
  - do not use member-only or login-conditional prices;
  - do not disguise a 403, 429, 503, or blocked page as “no data”;
  - do not silently fall back to a lower-quality source after rate limiting;
  - record blocked access as its own outcome;
  - retain URLs, retrieval dates, units, currencies, and evidence bases.

  A source accessible during manual or browser research is not automatically
  production-feasible. Prove that the target cheap model can retrieve it inside
  the actual one-call production shape.

  Prefer the LLM as a structured extractor and deterministic local code for
  arithmetic, FX, modelling, validation, and tier construction. If an experiment
  allows the LLM itself to estimate a value, treat that as a model candidate:
  label it as modelled, validate it against the same held-out ground truth, and
  never present it as observed evidence.

  Every final value must carry:
  - observed, modelled, imputed, definitional, or not-applicable basis;
  - source or model version;
  - imputed input measures;
  - retrieval/reference date;
  - uncertainty or quality signal.

  ══════════════════════════════════════════════════════════════════════════════
  3. STARTING WORK
  ══════════════════════════════════════════════════════════════════════════════

  First:

  1. Verify the branch and worktree. Preserve unrelated user changes.
  2. Read completely:
     - CLAUDE.md and AGENTS.md;
     - PLAN.md and LOG.md;
     - docs/product/methodology-v4.md;
     - docs/dev/handoffs/city-cost-v4.md;
     - current city-cost plans;
     - docs/prompts/README.md;
     - data/reference/README.md;
     - scripts/README.md;
     - the shipping city-generation prompt, provider client, schema, persistence
       path, relevant tests, datasets, and deterministic fitting scripts.
  3. Respect status banners. Archived documents are evidence, not current design.
  4. Verify `npm run docs:check-memory`.
  5. Re-check important claims against their underlying raw artifacts. Do not
     trust a prior summary where the source record can be inspected.
  6. Rewrite PLAN.md as the active v5 plan, preserving unrelated app backlog.
     Move confirmed historical findings into LOG.md rather than leaving change
     history in PLAN.md.
  7. Preserve useful v3/v4 evidence, but treat every v4 design choice as a
     candidate rather than the answer. Do not repeat an experiment unless it
     tests a materially different hypothesis or audits a questionable result.

  Do not falsely describe v5 as the active production methodology before it has
  passed validation. v1 remains the shipping path until an integrated replacement
  exists.

  ══════════════════════════════════════════════════════════════════════════════
  4. VALIDATION DESIGN
  ══════════════════════════════════════════════════════════════════════════════

  Pre-register the validation design before fitting or prompt tuning.

  Separate data into:
  - development/training data;
  - prompt-development validation data;
  - a locked final city-level holdout.

  Do not repeatedly tune against the final holdout. Split at city level so
  correlated observations from one city cannot cross partitions.

  The sample must cover:
  - all nine project regions where possible;
  - low, medium, and high cost bands;
  - large well-covered cities;
  - smaller and sparse-data destinations;
  - cities without the preferred source;
  - destinations with weak or nonstandard accommodation markets.

  For every modelled relationship, validation rows must contain directly
  observed, definition-compatible values for both the predictor and every target.
  Never validate a model against production values created by the same or a
  related formula.

  If one anchor is used to derive several accommodation tiers, require at least
  30 complete matched cities containing all accommodation tiers involved in that
  claim, including at least 10 locked holdout cities. Apply the same complete-case
  principle to other multi-target models.

  For individual relationships, target at least 30 matched cities unless a
  documented power or precision analysis requires more. Report confidence
  intervals and sample composition; do not use “statistically significant” as a
  substitute for showing sample size, uncertainty, and effect size.

  The existing production CSV is not ground truth for columns known to contain
  asserted or derived constants.

  Initial quantitative acceptance gates are:

  - 100% valid schema output from the deterministic pipeline.
  - All 19 product fields resolved under the agreed product semantics.
  - Held-out median absolute percentage error no worse than 25% for each
    non-definitional category and each modelled measure.
  - Held-out p90 absolute percentage error no worse than 50%.
  - Absolute median signed error no worse than 10%.
  - No material regional or cost-band bias hidden by the aggregate.
  - Citation/source correctness of at least 95% on audited extracted facts.
  - At least 95% one-call pipeline success on the representative prompt test.
  - Repeatability tested with at least three independent calls on five
    deliberately difficult cities; report dispersion rather than averaging it
    away.
  - A numerically defined per-city token, latency, and monetary-cost ceiling,
    frozen in PLAN.md before final evaluation.
  - Demonstrated feasibility at a few cities per week without an observed
    throttling failure at that usage pattern.

  `activities_free = 0` is definitional and is excluded from accuracy scoring.

  If evidence demonstrates that a gate is inappropriate, amend it openly before
  using the final holdout. Record the rationale and consequences. Never weaken a
  gate after seeing a disappointing final result merely to declare success.

  Also measure city ranking accuracy, because the product must support choices
  such as Lisbon versus Copenhagen. Report at least Spearman rank correlation and
  pairwise ordering accuracy for category and total daily costs.

  ══════════════════════════════════════════════════════════════════════════════
  5. EXPERIMENT LOOP
  ══════════════════════════════════════════════════════════════════════════════

  Repeat this loop without waiting for approval when the next action is within
  scope:

  1. Identify the largest remaining uncertainty or blocker.
  2. Inspect existing evidence before collecting anything new.
  3. State one falsifiable hypothesis.
  4. Pre-register:
     - candidate methodology;
     - source cascade;
     - collection/model boundary;
     - prompt and target model;
     - sample and held-out units;
     - free parameters;
     - metrics;
     - acceptance and rejection rules;
     - maximum calls or collection effort.
  5. Build the smallest experiment capable of rejecting the hypothesis.
  6. Run it on real sources and the target cheap model.
  7. Inspect raw model responses and source pages. Independently verify any
     explanation the model gives for access failure.
  8. Score results with deterministic scripts.
  9. Give the candidate one verdict:
     - reject;
     - revise and retest;
     - promote to broader validation;
     - accept.
  10. Record what was learned, commit and push the completed sizeable chunk,
      then immediately begin the next highest-value experiment.

  A failed experiment is progress if it rules out a method and leaves reusable
  evidence. Do not rescue a failed candidate with ad hoc exceptions.

  Prioritize experiments in this order:

  1. Freeze estimands and validation design.
  2. Resolve production source accessibility with the target cheap models.
  3. Attack the hardest coverage blockers early: accommodation level,
     dorm/private separation, activities, and sparse cities.
  4. Decide which inputs are cheap and reliable enough to collect.
  5. Test the simplest useful models for the remaining targets.
  6. Validate the complete end-to-end one-call pipeline.
  7. Only then optimize secondary accuracy or cost.

  Start with:
  - direct observation;
  - a global median ratio;
  - simple cost bands or regional ratios;
  - simple log-linear models.

  Add parameters only when the richer model improves both city-level
  cross-validation and locked validation by at least 10% relative, has stable
  coefficients, and improves a product-relevant metric. Prefer the model with
  fewer parameters when performance is practically tied.

  Evaluate source choice and model choice jointly. A theoretically accurate
  target that a cheap model cannot reliably retrieve is not a viable production
  anchor.

  Do not:
  - adopt a result from one city;
  - claim accuracy from in-sample fit;
  - treat rows from one city as independent cities;
  - use a model’s confidence as a quality score;
  - ask the LLM to perform arithmetic that local code can perform;
  - hide missingness through a plausible substitute;
  - confuse source coverage with target accuracy;
  - polish an already workable food model while accommodation or activities
    still prevent a complete result;
  - stop because the first candidate failed.

  ══════════════════════════════════════════════════════════════════════════════
  6. ARTIFACTS AND PROJECT MEMORY
  ══════════════════════════════════════════════════════════════════════════════

  Keep the work auditable without creating contradictory narrative documents.

  Maintain:
  - PLAN.md — current v5 milestones, gates, status, and open decisions;
  - LOG.md — append-mostly confirmed results and rejected methodologies;
  - docs/dev/plans/city-cost-methodology-v5.md — detailed active workstream;
  - docs/dev/handoffs/city-cost-v5.md — restartable current handoff;
  - data/reference/v5/README.md — v5 evidence inventory;
  - data/reference/v5/experiments/<NNN-slug>/ — one directory per experiment.

  Each experiment directory should contain, as applicable:
  - experiment.md with hypothesis and pre-registered rules;
  - inputs or sample manifest;
  - versioned prompt;
  - raw model responses;
  - normalized observations;
  - deterministic results.json;
  - verdict.md;
  - source and retrieval metadata.

  Update the main data, script, and prompt inventories when adding artifacts.
  Do not move existing files under data/reference without updating every reader.

  Prompt files must be versioned. Choose and document one source of truth for any
  generated production prompt; never edit both a generated prompt and its source
  independently.

  Fitting and scoring scripts must be deterministic and should support `--check`
  where practical. Generated artifacts must record schema version, methodology
  version, model version, sample identity, and provenance.


  ══════════════════════════════════════════════════════════════════════════════
  7. DEFINITION OF DONE
  ══════════════════════════════════════════════════════════════════════════════

  Do not mark the goal complete until all of these exist and pass:

  1. A frozen definition for all 19 product values.
  2. A named production source cascade and fallback policy.
  3. A versioned one-call extraction prompt that succeeds on a target cheap
     model under the actual provider/web-tool path.
  4. A strict validated output schema.
  5. A deterministic server-side derivation function for all modelled tiers.
  6. Fitted coefficient artifacts based on directly observed, definition-matched
     targets rather than proxies.
  7. A locked held-out validation report meeting the pre-registered coverage,
     accuracy, bias, reliability, and ranking gates.
  8. An explicit sparse-city and source-rate-limit evaluation.
  9. Measured per-city call count, source requests, tokens, latency, and cost.
  10. Evidence-basis and uncertainty metadata that prevents modelled values from
      being presented as observations.
  11. Reproducible scripts and an inventoried evidence dataset.
  12. An end-to-end blind demonstration: city input → one target-model call →
      validation → deterministic derivation → all 19 values.
  13. Updated PLAN.md, LOG.md, methodology documentation, prompt inventory,
      data inventory, scripts inventory, and current handoff.
  14. Passing verification:
      - npx tsc --noEmit
      - npm run build
      - npm test -- --run
      - npm run docs:check-memory
  15. All completed work committed and pushed on
      `feat/city-cost-methodology-v5`.

  A methodology is not “winning” merely because it is promising, cheaper than
  v3, better than v1 on a few examples, or complete through imputation. It wins
  only when the full one-call production pipeline passes the frozen held-out
  gates.

  If a technical or source approach is blocked, record the exact failure and
  pivot to the next plausible source, anchor, model, or basket design. Ask the
  user only when further progress genuinely requires new authority, credentials,
  or a product decision that cannot be resolved empirically.

  --

    > Resume the active city-cost methodology v5 goal. Inspect the current worktree and continue from the latest saved state. Do not mark the goal
  > complete unless the full Definition of Done passes.
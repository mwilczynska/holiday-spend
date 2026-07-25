# Phase 6 Re-Scope, 25 July 2026

This document amends the Phase 6A frozen specification. Phase 6A was deliberately frozen before evidence collection so that results could not drift the rules. These amendments are therefore recorded as dated, rationale-bearing changes rather than silent edits, and every one of them weakens or re-shapes an acceptance rule in a way that must be disclosed on `/estimates` and in the eventual data card.

## Why This Amendment Exists

A coverage analysis of the 171 accepted observations found that the collection strategy and the calculator's basket algebra are misaligned, and that the accommodation gate cannot be completed as written.

### Finding 1: Tiers Are Conjunctions, So Breadth Is The Wrong Shape

The v3 calculator builds each tier from a conjunction of measures. `food_mid_range` requires `street_food_meal_1p` **and** `inexpensive_restaurant_meal_1p` **and** `midrange_restaurant_meal_2p`. A city missing one input materializes no cell for any tier that names it.

Collection to date has been uniformly broad and shallow. The measures-per-city distribution is `{2:1, 3:1, 4:4, 5:28, 6:1}` across 36 destinations: 28 cities sit at exactly five of seventeen measures.

Four measures stand at literally zero observations:

| Measure | Cities | Tiers blocked |
| --- | --- | --- |
| `street_food_meal_1p` | 0 | `food_street_food`, `food_budget`, `food_mid_range` |
| `premium_restaurant_meal_2p` | 0 | `food_high_end` |
| `cocktail_1` | 0 | `drinks_moderate`, `drinks_heavy` |
| `wine_glass_1` | 0 | `drinks_heavy` |

`street_food_meal_1p` alone zeroes three tiers across all 36 cities: 108 cells blocked by one absent item. This is why food coverage is 0% despite food evidence existing in 35 cities.

### Finding 2: The Evidence Is Effectively Single-Channel

132 of 171 accepted observations (77%) come from one source, Numbeo, covering exactly four measures. The remainder are one-off official attraction and operator pages, almost all supplying a single measure for a single city.

Cross-channel disagreement, the diagnostic Phase 6C requires before model comparison, is therefore not merely unmeasured but **uncomputable**: no measure has two independent channels in any city.

Direct inspection of a Numbeo city page confirms its Restaurants section carries eight items, of which the project already harvests four. Street food, cocktails, wine by the glass, and premium restaurant meals are all absent. **There is nothing further to extract from this channel.** Every remaining measure requires a new source type, which means the missing-measure problem and the source-independence problem have one shared solution.

### Finding 3: The Accommodation Gate Is Not Achievable As Written

The frozen gate requires five accepted direct-property quotes per measure per season, across three seasons and six accommodation classes.

| | Per city | Pilot (36) | Recollection (121) |
| --- | --- | --- | --- |
| Accepted quotes required | 90 | 3,240 | 10,890 |
| Attempts at Copenhagen's observed 50% yield | ~180 | ~6,480 | ~21,780 |

Each attempt is an interactive booking-flow navigation against a direct property site. Progress after the entire project to date is one accepted accommodation observation and zero eligible measures: **1 of 648 pilot measure-seasons, or 0.15%**.

Phase 6G multiplies whatever per-city cost Phase 6D finishes with by 121. Reducing per-city cost is therefore worth more than completing the pilot.

### Finding 4: Zero Complete Cities Means Zero Training Rows

151 materialized cells spread across 32 cities yield no city with all 19 tiers, and a fallback model cannot train on partial rows. Coverage percentage is the wrong success metric for Phase 6C; **completed cities** is the right one.

## Amendment A: Depth-First Collection

**Was:** collection proceeded city-by-city, adding new destinations each checkpoint at a fixed shallow measure set.

**Now:** no new destination is added until the existing viable destinations carry every non-accommodation measure. Checkpoints are organized by measure and source type rather than by city.

**Rationale:** under conjunctive baskets, completing the measure set on an existing city yields several cells, while adding a city at five measures yields roughly two. Depth also produces the second channel that Finding 2 requires.

**Target state:** every viable city at 13 of 19 tiers, complete except accommodation, so that each city becomes a usable training row the moment its accommodation measures land.

## Amendment B: Multi-Venue Aggregation For Venue-Priced Measures

**Was:** implicitly one observation per measure per city, which is the natural shape of a Numbeo crowd-sourced city median.

**Now:** measures that exist only as individual venue prices require at least three independent venues per city, deterministically median-aggregated. This applies to `street_food_meal_1p`, `premium_restaurant_meal_2p`, `cocktail_1`, and `wine_glass_1`, and at least two venues for `half_day_group_activity_adult_1` and `full_day_premium_activity_adult_1`.

**Rationale:** a single bar's cocktail price is not comparable to a crowd-sourced city median, and pairing the two inside one basket would silently mix estimands of very different variance. Three venues is the minimum at which a median carries information.

**Cost consequence, stated plainly:** this triples the collection estimate. Completing the non-accommodation measure set across 33 viable cities costs roughly **530 observations, not the ~198 implied by one-per-measure**. That is the honest number and it should be planned against.

**Consequence for evidence quality:** venue-median measures are inherently noisier than crowd-sourced city medians. This asymmetry must be carried into the Phase 6G evidence-quality score rather than averaged away.

## Amendment C: Accommodation Seasonality Moves Into The Model

**Was:** five accepted quotes per measure in each of low, shoulder, and high season, plus at least 60% cross-season property overlap, for every city.

**Now:**

- each city collects **one pre-registered anchor season** at **three accepted quotes per class**
- a **seasonal index** is estimated once per `region x destination-type` stratum, from a small number of fully-paneled **index cities** that retain the original three-season, five-quote, 60%-overlap contract
- Copenhagen, Barcelona, and Prague are designated index cities, since their frames and windows are already frozen and partially collected
- the cross-season overlap requirement applies only to index cities, where it remains meaningful
- annualized measures for non-index cities are the anchor-season median scaled by the stratum's seasonal index, and are labeled as such

**Effect:** per-city accommodation quotes fall from 90 to 18, a five-fold reduction, and the pilot falls from roughly 6,480 attempts to roughly 1,300.

**Rationale:** seasonal variation is largely a property of region and destination type rather than of individual cities. Spending three times the fieldwork to re-measure that structure in every city buys little, and the residual uncertainty is better represented as an explicit model term. Phase 6F is already chartered to compare transparent shrinkage methods against simple baselines; the seasonal index belongs in that comparison, not in the collection budget.

**Disclosure obligation:** a scaled measure is weaker evidence than a directly observed three-season panel. Every scaled measure must be labeled with its index stratum and the index's own uncertainty, must be separable in the data card, and `/estimates` must publish that non-index cities carry modelled seasonality.

**Explicitly unchanged:** price-blind official property frames, direct-property quotes only, the exclusion of Booking.com and Hostelworld from LLM extraction, the event-screen gate on every window, and the append-only quote-attempt ledger. This amendment reduces quote volume; it does not relax provenance.

## Amendment D: Sparse Destinations Are A Model Target, Not Collection Debt

**Was:** all 36 pilot destinations were treated as pending collection.

**Now:** destinations with no retrievable public price evidence are reclassified as **structurally unobservable** and removed from the collection denominator. On current evidence these are Don Det, Santa Fe (Bantayan), and Bali (Ubud), plus any destination that remains at zero accepted observations after a completed bounded search.

**Rationale:** these destinations are not a backlog to be cleared; they are the precise case the fallback model exists to serve. Counting them as outstanding collection work misstates the remaining effort and depresses the coverage metric with cells that will never be observed.

**Consequences:**

- the viable pilot denominator becomes the collectable destinations, currently 32 or 33, and coverage is reported against that figure with the excluded destinations named
- structurally unobservable destinations enter **neither** the training set **nor** the holdout as observed rows
- they become the natural qualitative test of the fallback: the model must produce defensible values for them, and Phase 6G must report their predicted values with full uncertainty
- Phase 6E holdout stratification must not be drawn from evidence density in a way that concentrates sparse destinations in the holdout

## Amendment E: Within-Venue Selection And The Street-Food Channel

Added after the three-city protocol checkpoint, which surfaced two gaps in Amendment B.

### E1: Within-Venue Selection Rule

**Problem:** Amendment B specified three venues median-aggregated but said nothing about *which line on the menu* to take. Venue menus carry internal price tiers that a crowd-sourced city median does not. Pourhouse Vancouver spans CAD 16 to 40 for a cocktail; Moon Men Hanoi spans 215,000 to 470,000 VND. Selection moves the measure by roughly 2.5x, which would destroy cross-city comparability.

**Rule:** for venue-priced measures, take the **median of the venue's standard section**, excluding premium, reserve, rare-spirit, low-ABV, and zero-proof tiers. Record the section name and the full observed range in `notes` so the choice is auditable and reversible.

**Rationale:** this mirrors how the dominant existing channel defines its items. Numbeo does not publish "a beer", it publishes *Domestic Draft Beer, 0.5 L* — a specified standard item. The equivalent discipline for venue data is to name the section rather than average the whole menu.

Worked example: Pourhouse Classics Vol. 1 is 18, 19, 18, 22, 24, 19, 19 → median **CAD 19**, with the Fancy tier (35-40) excluded.

### E2: Delivery-Platform Menus Permitted For Street Food

**Problem:** `street_food_meal_1p` is the single highest-leverage measure, blocking 108 cells across three food tiers, and it cannot be sourced from official venue sites. Street vendors and food trucks structurally do not run priced websites. This was confirmed directly: Japadog's official site publishes menu categories but no prices, and Time Out Market Lisboa's official restaurant page publishes no stall prices.

**Decision:** permit static vendor price lists hosted on delivery marketplaces, recorded under a new `sourceType` of `delivery_platform_menu`.

**Rationale:** these are the vendor's own published prices. The accommodation contract excludes Booking.com and Hostelworld because interactive booking flows are not reproducible and their terms restrict extraction; a static delivery menu is a materially different artifact. The new type is ranked below `manual_menu_sample` and above `derived_model` in every category precedence table, so a direct venue menu always wins where one exists.

**Known bias, to be retained in notes on every such observation:** delivery-platform prices typically carry a 10-20% markup over the in-person price. This is a directional bias, not noise, and must not be averaged away.

### E3: The Delivery Channel Is Currently Unretrievable

**Status: E2 is authorised but not executable with current tooling.** Every delivery and aggregator platform tested failed:

| Platform | Outcome |
| --- | --- |
| Uber Eats | HTTP 403 |
| Fantuan | obfuscated or encrypted response body, unparseable |
| RestaurantGuru | expired TLS certificate |

`street_food_meal_1p` therefore remains at zero observations and the 108 cells behind it remain blocked. The enum value and precedence ranks are retained because the decision stands and the channel may become reachable; they are not yet backed by any observation.

**This must be resolved before the full completion pass**, since it determines whether the pass targets roughly 313 cells or roughly 412.

### E4: Possible Regional Bias In The Venue Channel

The checkpoint found official priced venue menus readily in Vancouver and Hanoi but not in Lisbon, where cocktail prices surfaced only through Tripadvisor and travel blogs. If official-menu publication varies systematically by region or language, the venue channel introduces a coverage bias **correlated with region**, which is one of the model's stratification variables. Track official-menu availability by region during the completion pass and report it; do not assume the channel is regionally neutral.

## Amendment F: Calibrated Street-Food Ratio Model

Supersedes E2 and E3 as the resolution for `street_food_meal_1p`.

### Why The Alternatives Failed

The delivery channel authorised in E2 is unexecutable. Seven platforms were tested and none exposes prices in server-rendered HTML: Uber Eats returns 403 for both Canadian and Portuguese store URLs, Fantuan returns an obfuscated body, Bolt Food and Glovo and GrabFood are client-rendered and gate prices behind address entry, RestaurantGuru's certificate has expired, and StreetFoodApp returns 403. This is structural, not per-platform.

Three fallbacks were then rejected on analysis, before any collection:

- **Redefining the estimand to a casual-eatery main** collapses `street_food_meal_1p` into `inexpensive_restaurant_meal_1p`. The two would measure the same thing, and `food_budget = 4 * street + 2 * inexpensive` would double-count one price.
- **Dropping the term from the baskets** destroys tier separation: `food_street_food` and `food_budget` both reduce to `6 * inexpensive_restaurant_meal_1p`, returning an identical value for two distinct planner tiers. Restoring separation requires a coefficient, which is a silent imputation.
- **A standardized fast-food proxy** inverts by region. In Lisbon a McDonald's combo is EUR 10 against EUR 15 for an inexpensive restaurant meal; in Hanoi the same combo runs well above street pho at 40,000-50,000 VND. The proxy's relationship to street food is region-dependent, so it would inject bias correlated with region, the same stratification variable flagged in E4.

### The Approach

Collect direct street-food evidence wherever a genuine public source exists, then use those observations to calibrate an explicit ratio model that imputes the measure elsewhere. This is closer to the original anchor-and-derive methodology, but the multiplier is estimated from observed evidence rather than asserted.

1. **Anchor set.** Collect direct `street_food_meal_1p` observations in every city where a genuine public source exists: market and hawker authority sites, food-hall stall menus, tourism-board cost guides, national statistics office prepared-food price series, and individual venue menus where a street-food dish is priced. Target at least 12 cities spanning all regions and the cost range.
2. **Estimate the ratio.** For cities with both measures observed, compute `r = street_food_meal_1p / inexpensive_restaurant_meal_1p`. Estimate `r` per stratum, shrinking toward the global ratio where a stratum is thin. `inexpensive_restaurant_meal_1p` is the right denominator because it is observed in 35 of 36 cities, so the model applies almost everywhere.
3. **Impute.** For cities with the denominator but no direct street-food observation, emit an observation with `valueStatus: 'imputed'`, populating `derivationMethod`, `modelVersion`, `parentObservationIds`, and `predictionLower` / `predictionUpper` from the stratum ratio's dispersion.
4. **Supersession is automatic.** `valueStatusPriority` already ranks `direct` above `derived` above `imputed`, and the aggregator takes only the best-priority group. A later direct observation silently replaces the imputed value with no manual cleanup.

### Required Guardrail, Implemented

`MaterializedCityCostTier` previously carried no value-status field, so a tier resting on an imputed input would have been indistinguishable from a fully observed one. Two fields are added:

- `evidenceBasis`: the weakest `valueStatus` among the inputs that produced the cell, or null when it did not materialize. A cell is only as strong as its weakest input.
- `imputedMeasures`: the specific inputs that were imputed rather than observed.

Without this, Amendment F would have quietly laundered modelled values into apparently observed tiers. **No imputation may run until this guardrail is in place**, which it now is.

### Disclosure Obligations

- The published quality summary already counts `direct`, `derived`, and `imputed` observations separately; imputed street-food values must appear there.
- `/estimates` must state that street-food tiers are model-backed in cities without direct evidence, and publish the ratio model's uncertainty.
- The data card must report the anchor-set size, its regional spread, the per-stratum ratios, and the number of cities relying on imputation.
- Phase 6F must evaluate the ratio model against the same registered metrics as any other fallback, and must report subgroup performance by region given the known region-dependence of cheap-meal pricing.

### Open Risk

The model rests on the assumption that the street-food-to-restaurant ratio is reasonably stable within a stratum. That is untested. It must be validated on the anchor set itself via leave-one-city-out error before the imputation is applied broadly; if within-stratum dispersion is large relative to between-stratum differences, the ratio carries little information and the measure should revert to explicitly missing.

## Revised Phase 6C Exit Gate

Phase 6C is complete when:

- [x] tourism intensity is measured or explicitly screened for every pilot destination
- [ ] every viable destination carries all eleven non-accommodation measures, at the venue counts in Amendment B
- [ ] at least one measure per category has two independent source channels in enough cities to compute cross-channel disagreement
- [ ] the source-age, robust-outlier, seasonal-completeness, and systematic-missingness diagnostics are computable and computed
- [ ] structurally unobservable destinations are named, frozen, and excluded from the denominator
- [ ] the pilot dataset and its missingness report are frozen, with every unresolved cell documented

Coverage percentage is retained as a reported figure but is **not** an exit criterion. Completed cities and computable diagnostics are.

## Revised Phase 6D Exit Gate

- [ ] index cities complete the original three-season, five-quote, 60%-overlap contract
- [ ] seasonal indices are estimated per `region x destination-type` with published uncertainty
- [ ] every other viable city completes its anchor season at three quotes per class
- [ ] annualized measures are materialized, labeled by evidence path (direct panel versus scaled anchor), and independently validated
- [ ] any measure failing a gate remains explicitly missing

## Sequencing

Amendments A, B, and D unblock immediately and need no interactive browser. Amendment C remains blocked on the browser runtime for quote collection, but index-city designation and seasonal-index design can proceed in parallel. Accommodation must not gate category work.

## Open Risks

- Amendment C is the largest reduction in evidence strength in Phase 6 and rests on the untested assumption that seasonality is more regional than city-specific. That assumption should itself be tested on the index cities before the index is applied broadly; if it fails, the amendment must be revisited rather than absorbed.
- Amendment B's venue-median measures may prove more variable than the accommodation panels assume. If cross-venue spread within a city is large relative to cross-city spread, three venues will not be enough.
- The revised pilot may still not reach enough complete cities to support whole-city cross-validation. That should be checked against the completed-city count before Phase 6E freezes any design.

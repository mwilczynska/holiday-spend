# Accuracy protocol: pilot-1

Frozen 13 October 2026, before any campaign predictions or reference prices. Machine-readable authority:
[manifest.json](manifest.json). Resource and decision policy: [research plan](../../docs/dev/plans/city-cost-accuracy.md).

## Questions and scope

Measure fresh v1.1 anchor and derived-tier accuracy under cheap-model subagent execution, identify large errors,
and test incremental changes with the same evidence. Price truth is external public evidence with limitations.
Published source-statistic reproduction and priced visitor baskets are separate result groups.

The six pilot cities are Hanoi, Bandipur (Nepal), Oaxaca (Mexico), Bled, Kyoto and Copenhagen. They span low,
middle and high price levels, large/regional cities, and small/sparse/seasonal destinations. This purposive
coverage sample is fixed before observing outputs. It is not a random sample of all cities.
The machine manifest preregisters all 16 development/eight confirmation identities. Do not retrieve confirmation
prices until the finalist is frozen. These are fresh evidence sets; we do not claim their names never appeared
in old research, whose sealed ledgers are not inspected.

## Date, area, units and source interpretation

All predictions receive the manifest's identical pricing window/context. Accommodation: 17–20 November 2026,
three nights, one room/two adults (one bed for dorm), ordinary visitor-accessible central city neighbourhoods,
standard public non-member rate, mandatory taxes included when evidenced, no breakfast. Food/drinks:
current October–November 2026 public menu prices without tips/optional service. Quoted local currency is retained.
Use a fixed campaign FX observation/table collected and frozen independently before numeric scoring.

City proper is the boundary, not the metro/country or a nearby resort. Bandipur is the Nepal settlement, Bled is
the Slovenian town, Oaxaca is Oaxaca de Juárez. A far-away offering is not substituted to fill a cell.

Definitions follow the exact v1.1 anchors. Capture serving size and inclusions. Draft beer uses the local standard
serving: do not convert bottled beer to draft or invent a serving conversion. Cappuccino is regular, no add-ons.
Inexpensive meal is a regular non-premium main/complete meal, no drink; three-course mid-range dinner for two
requires all three courses and excludes drinks. A single main is not a full three-course dinner.
Accommodation class must be independently stated by the property or a named registry/booking source; an
unclassified guesthouse is not an observed three-star room.

Evidence classes:
- `observed_offer`: named venue/property/operator with visible price and basis; a small convenience sample,
  not population truth. Store the observed range/count and score as offer-based estimates with uncertainty.
- `published_statistic`: city-level source aggregate with stated definition/date; source agreement only when
  the candidate relies on that same source. Never rename this independent traveller-spend truth.
- `proxy`: mismatched date, unit, class or geography; retain diagnostically, exclude from primary score.
- `missing`: no supported price; keep the reason and retrieval count.

For each city/measure collect a maximum five accommodation and three venue offers when accessible within the
action cap. Select the first eligible independent venues from the registered query order, excluding duplicates,
premium/member/from-only rates and non-city results. Do not sort/select by cheapest price. Aggregate as median
with min/max and count; n<3 is explicitly thin, not discarded because its result is inconvenient.
Current retrieved undated menus may support menu-price evidence labelled undated; dated hotel targets require
dated availability. Unavailable dates are missing, not zero. Tax uncertainty prevents a tax-inclusive match.

## Pilot acquisition and review

Exactly six retrieval actions per city allocated to collectors (36 total), plus four independent verification
actions. One query, opened URL or clicked page counts as one action, including errors; a multi-query tool call
counts each query. Collection agents must use at most the allocation and report every action.
Do not retrieve confirmation cities or look up candidate predictions.

Per-city query order:
1. City/country regular restaurant/cafe menu with coffee and beer prices; open one eligible primary result.
2. City/country official three/four-star accommodation rate for the frozen dates; open one eligible primary result.
3. City/country official museum/attraction adult admission; open one eligible primary result.
A failed result remains failed; only unused slots can be repurposed. Source-statistic search results can be
retained as secondary feasibility evidence, never silently replace absent menus/direct offers.

At least 20% of accepted pilot reference rows are independently reviewed against underlying source evidence.
Four verification actions are reserved; if one opened source supports multiple rows it can review those rows.
If this cannot cover 20%, document the unmet review requirement and carry it into the campaign reference budget.
Feasibility advances with meaningful supported evidence in at least three cities and two categories overall;
this is a scope decision, not an accuracy pass. Otherwise conclude the pilot cannot support the planned
campaign within this mechanism/cap, explain evidence and possible changes without silently enlarging the search.

## Basket interpretation (frozen proposals)

These choices operationalize otherwise vague activity/high-end labels. Scores against them are conditional
on these behaviours, not claims that every traveller follows them.

- Economy: private hostel room; per person two street/casual meals plus one inexpensive restaurant meal;
  one cappuccino and one beer; one ordinary paid attraction admission per person/day.
- Standard: three-star room; per person street/casual breakfast, inexpensive lunch and three-course mid-range
  dinner; same light drinks; over three days, one free day, one ordinary paid-attraction day and one half-day
  shared guided-activity day. Divide the three-day activity spend by three.
- Higher-spend: four-star room; per person cafe breakfast, mid-range lunch and premium three-course dinner;
  one cappuccino, two beers and one cocktail; over three days, one paid-attraction day, one half-day shared
  activity and one full-day guided excursion with explicitly stated party size. Divide by three.

Reference meal prices are direct, not v1's ratios. Ordinary attraction: first eligible publicly priced
museum/heritage/cultural admission on the official city tourism site's attraction list; omit donations/free sites,
special exhibitions and multi-attraction passes. Guided activities require actual duration/party basis.
No supported high-end meal or full-day activity means that basket remains unscored.
Food/activities in a total must match the named basket. A partial total is labelled partial and not a daily total.

## Metrics, missingness and confirmation

The manifest freezes mean absolute log error as primary, category/measure weighting within each city, equal
city weights, all repeated requests included, and a missing-prediction penalty ln(4), with ln(2)/ln(10)
sensitivity. Positive supported prices use abs(log(prediction/reference)). Exact zeros/absence are scored as
classification, never divided by zero. Also report median/p90 APE, signed log bias, absolute AUD error,
underestimation, reference quality/coverage, source overlap and model-repeat dispersion.

Use the same reference cells for every candidate. Raw successful-only error must sit beside full-denominator
penalized error and failure counts. Unsupported reference cells are never assigned a price or counted correct.
Any candidate's measurable scope is declared before its output is inspected. Category findings are permissible;
full-budget claims require complete independently priced baskets.

Freeze the primary cheap model (GPT-6 Luna/max), three baseline repeats and candidate-pilot two repeats.
Screen at most six hypotheses on development; at most two proceed to wider tests. Compare original baseline
and current incumbent. Require >=10% relative improvement, no new failures, and the plan's bias/tail/category
regression checks. City-bootstrap intervals are exploratory until fresh confirmation. The final paired 95%
interval must exclude no improvement for a supported win; otherwise report promising/inconclusive.

Prediction workers get only exact system/user prompts and an output/provenance wrapper, without parent history
or reference files. The wrapper does not change anchor definitions or suggest numeric answers.
A separate no-parent reference collector can see this protocol but never candidate outputs.

## Runtime preflight

- Codex supports the explicitly requested `gpt-6-luna` with `max` effort.
- Claude Code 2.1.295 is installed and reports logged-in `claude.ai` first-party authentication.
  No identity/key/token was printed. Haiku 5.5 model execution is still unverified.
- For Claude use safe mode to disable project memory/customizations and restrict tools to WebSearch/WebFetch,
  an exact system prompt, fresh nonpersistent sessions and no fallback model. Never use bare mode, which
  disables subscription authentication. Output model metadata must match the requested cheap model.
- Worktree has no live database. Dependencies installed with scripts disabled solely for pure research tooling;
  native database modules/builds are not being claimed tested.
- All pricing/reference/model assertions must come from recorded tool evidence; no paid API calls.

## Change control

Before any later protocol revision, preserve this version/hash and record the reason, timing and which outputs
were already visible. Never revise definitions/exclusions to improve a candidate's score. Budget counters are
append-only records; work lost or rejected still counts. Old sealed datasets remain closed.

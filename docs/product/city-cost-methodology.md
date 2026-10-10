# City cost methodology

**Last updated:** 10 October 2026. Replaces `methodology-v4.md`, which describes research that was never integrated.

This document describes how Holiday Spend estimates what two people spend per day in a city, and how those estimates
become a trip budget. It describes what the app does now. A short history of earlier methods is at the end.

## 1. What an estimate is

Each city has 19 stored values, in AUD, for two travellers:

| Category | Tiers | Unit |
| --- | --- | --- |
| Accommodation | hostel dorm, hostel private room, 1-star, 2-star, 3-star, 4-star | per night |
| Food | street food, budget, mid-range, high-end | per day |
| Drinks | none, light, moderate, heavy (plus the unit price of one coffee) | per day |
| Activities | free, budget, mid-range, high-end | per day |

These are planning estimates. They are not quotes and not observed prices. Transport is not part of a city's
estimate; it is entered separately (section 6).

## 2. Where city values come from

A city's values come from one of three places, and each city records which:

| Source | Label | Method |
| --- | --- | --- |
| The reference dataset, `data/reference/city_costs_app_aud.csv` (121 cities, 58 countries, April 2026) | `base_csv_apr_2026` | v1 (section 7) |
| Generating a city in the app, or the batch script for adding cities | `llm_city_generation_v1_1` | v1.1 (sections 3 to 5) |
| Editing a city by hand in the Dataset page | `manual` | Whatever the user enters |

New and regenerated cities use v1.1. Reference cities stay on v1 until someone regenerates them; there is no bulk
migration.

## 3. Step 1: the model estimates ten prices in USD

The app sends one request to the selected language model (OpenAI, Anthropic or Gemini) using the prompt in
`docs/prompts/llm_prompt_new_cities_v1_1.md`. The model returns ten prices in USD:

| Anchor | Definition |
| --- | --- |
| `beer` | one domestic draft beer, standard serving, in a restaurant |
| `coffee` | one regular cappuccino |
| `inexp_meal_1p` | one meal at an inexpensive restaurant, one person |
| `midrange_meal_2p` | three-course mid-range restaurant meal for two, no drinks |
| `cocktail` | one standard cocktail at a bar or restaurant |
| `wine_glass` | one glass of wine at a restaurant |
| `hostel_dorm_1p` | one dorm bed in a registered hostel, one night |
| `hostel_private_2p` | one private hostel room for two, one night |
| `hotel_1star_2p` | one very basic hotel or guesthouse room for two, one night |
| `hotel_3star_2p` | one registered 3-star hotel room for two, one night |

The model estimates these from its general knowledge. It is told not to search the web for prices and not to claim
sources it did not read. It also returns a region, a confidence label (high, medium or low), a short note on
estimate quality, and the comparable city or regional basis it used, if any.

The model does no arithmetic. It does not calculate tiers or convert currency.

## 4. Step 2: the exchange rate

In the same request, the model uses web search for one thing only: the latest published Reserve Bank of Australia
(RBA) USD/AUD rate. It returns the rate, whether it is quoted as USD per AUD or AUD per USD, the observation date, and
the `rba.gov.au` page it came from.

The server rejects the whole response, and saves nothing, if:

- any field is missing, extra, or the wrong type;
- any anchor is not a positive finite number;
- the source URL is not an `https` page on `rba.gov.au`;
- the observation is more than seven days old or more than one day in the future;
- the rate is outside 0.1 to 10.

If the RBA quotes USD per AUD (the usual form, about 0.65), the server inverts it to get AUD per USD.

## 5. Step 3: the server calculates the tiers

The server calculates every tier in USD from the ten anchors, then converts each tier to AUD and rounds it to the
nearest dollar. The coffee unit price is converted and kept to the cent.

**Accommodation, per night, two people**

```
hostel dorm      = hostel_dorm_1p × 2
private room     = hostel_private_2p
1-star           = hotel_1star_2p
2-star           = (hotel_1star_2p + hotel_3star_2p) / 2
3-star           = hotel_3star_2p
4-star           = hotel_3star_2p × 1.8
```

**Food, per day, two people**

```
street meal      = inexp_meal_1p × 0.6
street food      = street meal × 3 meals × 2 people
budget           = (street meal × 2 + inexp_meal_1p) × 2
mid-range        = (street meal + inexp_meal_1p + midrange_meal_2p / 2) × 2
high-end         = mid-range × 1.5
```

**Drinks, per day, two people**

```
none             = coffee × 2
light            = coffee × 2 + beer × 2
moderate         = coffee × 2 + beer × 4 + cocktail × 2
heavy            = coffee × 2 + beer × 6 + cocktail × 4 + wine_glass × 2
```

"None" means no alcohol. It still includes one coffee each.

**Activities, per day, two people**

```
activity unit    = (inexp_meal_1p + 10) / 2        (USD)
free             = 0
budget           = activity unit × 2
mid-range        = activity unit × 5.5
high-end         = activity unit × 12
```

The activity tiers are a proxy based on meal prices. They are not attraction or tour prices.

These formulas are the same as v1. v1.1 changed who does the calculation, not the calculation.

### Worked example

Suppose the model returns: inexpensive meal 15, mid-range meal for two 60, beer 6, coffee 4, cocktail 12, wine 8,
dorm bed 30, private room 80, 1-star 90, 3-star 150 (all USD), and an RBA rate of 0.65 USD per AUD.

AUD per USD = 1 / 0.65 = 1.538462.

| Tier | USD | AUD (rounded) |
| --- | --- | --- |
| 3-star | 150 | 231 |
| 4-star | 150 × 1.8 = 270 | 415 |
| Mid-range food | (9 + 15 + 30) × 2 = 108 | 166 |
| Light drinks | 4 × 2 + 6 × 2 = 20 | 31 |
| Budget activities | (15 + 10) / 2 × 2 = 25 | 38 |

### What is saved

For every v1.1 estimate the app saves the ten USD anchors, their AUD equivalents, all 19 AUD values, the provider,
model and reasoning effort used, the prompt and formula versions, the confidence label and note, and the exchange rate
with its date, source URL and how it was derived. The Dataset page shows this as the city's generation history.

The confidence label is the model's own judgement. It is not a probability, a grade or an error range.

## 6. How a city estimate becomes a trip budget

The planner picks one tier per category for each leg of the trip, then adjusts for the number of travellers (1 to 5,
set in Settings). Stored values are for two people, so:

| Category | Scaling for *n* travellers |
| --- | --- |
| Hostel dorm | value × n / 2 (one bed each) |
| Rooms (private, 1 to 4 star) | value × rooms needed, where rooms = n / 2 rounded up |
| Food | value × n / 2 × (1 − 0.05 × (n − 2)), with no adjustment for 1 or 2 travellers |
| Drinks, activities | value × n / 2 |

So one traveller pays half a dorm price but a full room; three travellers pay for two rooms; food for five people
costs 2.5 × 0.85 = 2.125 times the two-person value.

A leg's total is:

```
leg total = daily cost × nights + intercity transport + miscellaneous expenses
daily cost = accommodation + food + drinks + activities + transport per day
```

- **Overrides.** A per-leg override replaces the scaled value for that category. It is the amount for the whole group
  (accommodation per night, others per day) and is not scaled again.
- **Transport per day** is a manual daily amount, zero unless entered.
- **Intercity transport** rows are added once per leg, not per night. They can be entered by hand or estimated by a
  separate model feature, described in `docs/product/transport-estimation.md`.
- **Miscellaneous expenses** are one-off group totals for the leg, not scaled by nights or travellers.

Saved plans store tier choices, not prices. If a city's values change later, saved plans change with them.

**Fallbacks for missing values.** If a city has no private-room value, the planner uses the average of the dorm and
1-star values (or whichever one exists). If it has no "none" drinks value, it uses the coffee price × 2. Any other
missing value counts as zero in the budget.

## 7. The reference dataset (v1)

The 121 reference cities were produced with the v1 prompt, `docs/prompts/llm_prompt_new_cities_1.md`. v1 used the
same ten anchors and the same formulas, but the model did everything in one step: it estimated the anchors, applied
the formulas, found an exchange rate and returned AUD values. Nothing checked its arithmetic, and the exchange rate
was not recorded.

v1 can still be selected for new cities by setting `CITY_COST_METHODOLOGY_VERSION=v1`. It is kept as a rollback.

## 8. Limitations

- The anchors come from model knowledge, not from current prices. They can be out of date, and the model does not
  know the season, neighbourhood or events of a particular trip.
- The tier multipliers (street meal 0.6, 4-star 1.8, high-end food 1.5, the activity formula) are fixed assumptions
  applied to every city. They were never fitted to data. The 4-star value in particular contains no information
  beyond the 3-star price.
- The activity tiers are not based on any activity prices.
- The confidence label is not calibrated.
- No accuracy figure is claimed. The estimates are accepted as reasonable for comparing cities and planning a budget,
  and further calibration work is deliberately out of scope.
- Reference cities and v1.1 cities were produced by different models at different times, so small differences
  between them can reflect the method rather than the cities.

When you know a real price, such as a booked hotel, use an override.

## 9. Code and files

| Path | Role |
| --- | --- |
| `docs/prompts/llm_prompt_new_cities_v1_1.md` | v1.1 prompt |
| `src/lib/city-cost-methodology-v1-1.ts` | Response schema, exchange-rate checks, tier formulas, AUD conversion |
| `src/lib/city-generation.ts` | Chooses v1 or v1.1 and calls the provider |
| `src/lib/cost-calculator.ts` | Traveller scaling, overrides and daily cost |
| `scripts/check-city-cost-v1-1.ts` | Checks formulas, rounding and that the reference CSV is unchanged |
| `scripts/add-cities-from-agent-responses.ts` | Adds cities in batches using the same v1.1 prompt and server path |

## 10. History of earlier methods

Only v1 and v1.1 have shipped. The others were researched between July and August 2026 and set aside. The full record
is in `LOG.md`, `methodology-v4.md`, `docs/prompts/README.md` and the archived branch `feat/city-cost-methodology-v6`.

### v1 (April 2026): replaced by v1.1

**What it did.** The model estimated the ten prices, applied the formulas and converted to AUD, all in one answer.

**Why it was replaced.** Its arithmetic and exchange rate could not be checked, and the rate was not recorded. An early
audit reported 17.5% average error, but it covered nine prices in three cities and most of the error came from one
city, so it did not show the prices were unusable. v1 still supplies the reference dataset and remains a rollback.

### v2.1: removed

Added an external hotel-price lookup on top of v1. The code was removed in a cleanup pass.

### v3 (July 2026): abandoned

**What it tried.** Collect every price directly from named sources, such as restaurant menus and hotel sites, for a
36-city pilot.

**Why it was not used.** Each tier needs several prices at once, so one missing price blanks every tier that uses it.
Street food alone blocked three food tiers in every pilot city. After weeks of collection it had 23% of the tier
values (156 of 684) and no complete city. It averaged one usable price per six web searches, and finishing all 121
cities would have taken about 17,300 lookups, repeated at every refresh.

### v4 (July 2026): never integrated

**What it tried.** Read food and drink prices from a crowd-sourced cost-of-living site and hotel prices from
booking-site pages, then derive the remaining prices from ratios fitted across 99 cities.

**Why it was not used.**

- Food and drink prices were exact when the site lookup worked, but the site blocked requests after about 40 in a row,
  and it had no usable page for 55% of low-cost destinations.
- Hotel prices read from booking pages came out about 50% high against direct quotes in Copenhagen, and the reading
  method was unstable between runs.
- Activity prices had no relationship to food prices, so activities could not be derived.
- The fitted ratios still missed by 18 to 22% (median), against a 15% target.

v4 also measured the 4-star to 3-star price ratio at about 1.3 across 16 cities, against the 1.8 the formulas use.
v1.1 kept 1.8 so as not to change existing behaviour.

### v5 (August 2026): rejected

**What it tried.** About 90 prompt experiments, each sending a model to find particular prices from particular
sources, including Expedia, Momondo, Expatistan and BudgetYourTrip.

**Why it was not used.** No source covered every price for every city. Many pages did not say whether a room was for
one or two people, or which star class it was. A single call asking for every price never returned a complete city.

### v6 and v6.1 (August 2026): rejected

**What it tried.** Three web-search calls per city to collect source prices, with statistical fallbacks for gaps and
graded estimates with ranges, staged as a full replacement of the 121 cities.

**Why it was not used.** Too large and fragile to run or refresh. In the final test, the searches found none of the
nine prices in three Japanese cities, so the estimates rested on fallback values anyway while costing several model
calls per city.

### What carried into v1.1

Public prices exist for large cities but often not for small destinations, and collecting enough of them to fill every
tier cost far more than the accuracy it added. v1.1 therefore keeps v1's model estimates and formulas, takes one model
call per city, and moves the arithmetic, currency conversion and checks into the app so everything it used is recorded.
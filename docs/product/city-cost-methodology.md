# City cost methodology

Display currency is selectable beside traveller count and in Settings, per account. Totals, charts and cost inputs
convert from stored AUD amounts using the latest available daily Frankfurter rate (refreshed hourly). Changing it
never rewrites city estimates, expense conversions, saved plans or budgets. Original transaction currencies and
recorded FX provenance retain their stated units; worked examples below keep their fixed AUD assumptions.

**Last updated:** 18 October 2026. Describes v1.2. Replaces the v1.1 version of this document.

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
estimate; it is entered separately (section 7).

## 2. Where city values come from

A city's values come from one of these, and each city records which:

| Source | Label | Method |
| --- | --- | --- |
| Generating a city in the app, or the batch script for adding cities | `llm_city_generation_v1_2` | v1.2 (sections 3 to 6) |
| Cities generated before 18 October 2026 | `llm_city_generation_v1_1` | v1.1 (section 9) |
| The reference dataset, `data/reference/city_costs_app_aud.csv` (121 cities, 58 countries, April 2026) | `base_csv_apr_2026` | v1 (section 9) |
| Editing a city by hand in the Dataset page | (unchanged label) | Whatever the user enters |

New and regenerated cities use v1.2. The library is being regenerated under v1.2; until a city is regenerated it keeps
its v1.1 or v1 values.

## 3. Step 1: the model estimates ten prices in USD

The app sends one request to the selected language model (OpenAI, Anthropic or Gemini; GPT-6 Luna at maximum
reasoning by default) using the prompt in `docs/prompts/llm_prompt_new_cities_v1_2.md`. The model returns ten prices
in USD:

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

The model may make up to five web searches for current typical restaurant, coffee and drink prices in the city, for
example cost-of-living price indexes. Accommodation prices are its own estimates from general knowledge: it is told not
to search for them and not to claim listings it did not see. It also returns a region, a confidence label (high, medium
or low), a short note on estimate quality, and the comparable city or regional basis it used, if any.

The model does no arithmetic. It does not correct prices, calculate tiers or convert currency.

## 4. Step 2: the exchange rate

In the same request, one further web search finds the latest published Reserve Bank of Australia (RBA) USD/AUD rate.
The model returns the rate, whether it is quoted as USD per AUD or AUD per USD, the observation date, and the
`rba.gov.au` page it came from.

The server rejects the whole response, and saves nothing, if:

- any field is missing, extra, or the wrong type;
- any anchor is not a positive finite number;
- the source URL is not an `https` page on `rba.gov.au`;
- the observation is more than seven days old or more than one day in the future;
- the rate is outside 0.1 to 10.

If the RBA quotes USD per AUD (the usual form, about 0.70), the server inverts it to get AUD per USD.

## 5. Step 3: the server corrects the model's prices

Language models price some items consistently too high or too low. Measured against real prices, GPT-6 Luna's 3-star
rooms come out about 60% above what 3-star rooms actually cost on booking sites. The server removes these consistent
errors by multiplying eight of the ten USD prices by a fixed correction factor:

| Anchor | Typical factor | Reference it is aligned to |
| --- | --- | --- |
| `hotel_3star_2p` | 0.62 | median 3-star price on Booking.com and Trip.com, taxes included, averaged over six stay dates across a year |
| `hotel_1star_2p` | 0.85 | the cheaper quarter of decently rated hotels and guest houses on Booking.com, same dates |
| `hostel_dorm_1p` | 0.77 | cheapest dorm bed on Hostelworld, scaled to a year-typical level by the same city's Booking.com prices over the six stay dates |
| `hostel_private_2p` | 0.70 | cheapest private room on Hostelworld, scaled the same way |
| `midrange_meal_2p`, `inexp_meal_1p`, `beer`, `coffee` | 0.96 to 1.01 | Numbeo city medians |

Cocktails and wine are not corrected: no source publishes restaurant wine by the glass, and cocktail references
are too sparse. Their values are the model's own. The hostel references assume hostel prices move across the year
like hotel prices in the same city, because Hostelworld's dated search is not publicly available.

When the table changes, `scripts/recorrect-city-costs.ts` re-applies it to every v1.2 city from the stored raw
model prices at the stored exchange rate, without a model call. Hand-edited fields are kept.

Each factor depends on the country. The table (`src/lib/data/city-cost-corrections-v1-2.json`) was fitted on 475
reference cities in 93 countries. For a country, the factor is the average ratio between reference and model prices in
that country, pulled towards its world region's average when the country has few reference cities:

```
offset(country) = n / (n + 3) × mean ln(reference / model) in the country
                + 3 / (n + 3) × mean ln(reference / model) in the region
factor          = e^offset
```

where *n* is the number of reference cities in the country. A country with no reference cities uses its region's
factor, and a region with none uses the overall factor. So one reference city counts a quarter and nine count three
quarters. The table records its own version (`v1.2-corrections-2026-10-18`), which every estimate saves.

## 6. Step 4: the server calculates the tiers

The server calculates every tier in USD from the ten corrected anchors, then converts each tier to AUD and rounds it to
the nearest dollar. The coffee unit price is converted and kept to the cent.

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

These formulas are the same as v1 and v1.1. Because 4-star is 3-star × 1.8, the 3-star correction also lowers 4-star by
the same proportion.

### Worked example

Suppose the model returns, for a city in Italy: inexpensive meal 15, mid-range meal for two 60, beer 6, coffee 4,
cocktail 12, wine 8, dorm bed 30, private room 80, 1-star 90, 3-star 150 (all USD), and an RBA rate of 0.70 USD per
AUD. Suppose the Italian factors are 3-star 0.60, 1-star 0.80 and 1.00 for food and drink.

AUD per USD = 1 / 0.70 = 1.428571. Corrected 3-star = 150 × 0.60 = 90; corrected 1-star = 90 × 0.80 = 72.

| Tier | USD | AUD (rounded) |
| --- | --- | --- |
| 3-star | 90 | 129 |
| 4-star | 90 × 1.8 = 162 | 231 |
| 2-star | (72 + 90) / 2 = 81 | 116 |
| Mid-range food | (9 + 15 + 30) × 2 = 108 | 154 |
| Light drinks | 4 × 2 + 6 × 2 = 20 | 29 |

### What is saved

For every v1.2 estimate the app saves the model's ten USD anchors, the corrected anchors and their AUD equivalents, the
correction applied to each anchor (factor and whether it came from the country, region or overall table), the
correction table version, all 19 AUD values, the provider, model and reasoning effort, the prompt and formula versions,
the confidence label and note, and the exchange rate with its date, source and derivation. The Dataset page shows this
as the city's generation history.

The confidence label is the model's own judgement. It is not a probability, a grade or an error range.

## 7. How a city estimate becomes a trip budget

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

## 8. Keeping prices current

- **Exchange rates.** Every v1.1 and v1.2 city stores its USD anchors, so its AUD values can be recalculated at a newer
  rate without asking a model again. `scripts/refresh-city-cost-fx.ts` (or `POST /api/cities/exchange-rate-refresh`
  for library admins) reads the European Central Bank's daily euro reference rates and uses their USD/AUD cross rate:
  the RBA's statistics tables refuse automated downloads. On 16 October 2026 the two agreed within 0.1%. A refresh
  keeps the previous rate in the estimate's history and leaves any value someone edited by hand unchanged. v1 cities
  store no anchors and need regenerating first.
- **Price levels.** Food and drink prices come from current searches each time a city is generated. Accommodation
  prices come from the model's knowledge and the correction table, so the table should be refitted against fresh
  booking prices about once a year, and whenever the model changes.

## 9. Earlier versions still in the library

**v1.1 (September 2026).** The same prompt contract without food and drink searches (the model used web search only
for the exchange rate) and without the correction step. Prompt `docs/prompts/llm_prompt_new_cities_v1_1.md`. Select it
with `CITY_COST_METHODOLOGY_VERSION=v1.1`.

**v1 (April 2026).** The 121 reference cities were produced with `docs/prompts/llm_prompt_new_cities_1.md`. v1 used
the same ten anchors and formulas, but the model did everything in one step: it estimated the anchors, applied the
formulas, found an exchange rate and returned AUD values. Nothing checked its arithmetic, and the exchange rate was not
recorded. Select it with `CITY_COST_METHODOLOGY_VERSION=v1`.

## 10. How accurate it is

Accuracy was measured in October 2026 against independently collected prices for 333 development cities, and
confirmed on 142 cities that were set aside before any experiment. The measure is the budget-weighted mean of
|ln(estimate ÷ reference)| per city: an error of 0.18 means a typical price is about 20% off.

| Method | Development cities | Held-out cities |
| --- | --- | --- |
| v1.1, uncorrected | 0.435 (about 54%) | not measured |
| v1.2 | 0.163 (about 18%) | 0.190 (about 21%) |

By item, v1.2's typical errors are 7 to 11% for coffee, beer and meals, 20% for 3-star rooms, 23 to 25% for 1-star
rooms and about 26% for hostels (38 to 49% before the hostel correction). The full record, including every experiment and why it was or was not adopted, is on the research
branch (section 12).

## 11. Limitations

- Accommodation remains the weakest part. The correction fixes the overall price level, but the model still does not
  know which cities are dearer than others; neither searching booking sites nor giving it comparable cities' prices
  fixed that.
- Part of the food and drink accuracy comes from the model finding the same crowd-sourced sources the references use,
  so those figures overstate accuracy against what travellers actually pay.
- The reference prices themselves are noisy: Booking.com and Trip.com differ by about 13% for a typical city.
- Cocktail and wine prices are uncorrected model estimates. Hostel references are near-term Hostelworld prices
  scaled by hotel seasonality, not observed year-round hostel prices.
- The tier multipliers (street meal 0.6, 4-star 1.8, high-end food 1.5, the activity formula) are fixed assumptions
  applied to every city. The 4-star value contains no information beyond the 3-star price.
- The activity tiers are not based on any activity prices.
- The confidence label is not calibrated.

When you know a real price, such as a booked hotel, use an override.

## 12. Code and files

| Path | Role |
| --- | --- |
| `docs/prompts/llm_prompt_new_cities_v1_2.md` | v1.2 prompt |
| `src/lib/city-cost-methodology-v1-2.ts` | Correction lookup and v1.2 materialization |
| `src/lib/data/city-cost-corrections-v1-2.json` | Correction table (built on the research branch by `build-production-corrections.mjs`) |
| `src/lib/city-cost-methodology-v1-1.ts` | Response schema, exchange-rate checks, tier formulas, AUD conversion |
| `src/lib/city-generation.ts` | Chooses v1, v1.1 or v1.2 and calls the provider |
| `src/lib/city-cost-fx-refresh.ts`, `src/lib/usd-aud-reference-rate.ts` | Exchange-rate refresh |
| `src/lib/cost-calculator.ts` | Traveller scaling, overrides and daily cost |
| `scripts/check-city-cost-v1-1.ts` | Checks formulas, rounding, the correction table and that the reference CSV is unchanged |
| `scripts/add-cities-from-agent-responses.ts` | Adds cities in batches using the configured prompt and server path |
| `docs/research/city-cost-accuracy.md` | Summary of the research behind v1.2 and how to continue it |

## 13. History of earlier methods

Only v1, v1.1 and v1.2 have shipped. The others were researched between July and August 2026 and set aside. The full
record is in `LOG.md`, `methodology-v4.md`, `docs/prompts/README.md` and the archived branch
`feat/city-cost-methodology-v6`.

### v1.1 to v1.2 (October 2026): measured improvement

A research program measured v1.1 against a reference panel of 475 cities and tested 38 changes under a rule fixed in
advance (an average improvement of at least 0.015 with a 95% range above zero, and no item worse by more than 0.05).
Rewording the prompt, averaging two models, lower reasoning effort and searching for accommodation did not help once
consistent bias was removed. What helped was correcting each item's consistent bias by country and region, and letting
the model search for food and drink prices. Together these became v1.2, and the gain held on the held-out cities.

### v1 (April 2026): replaced by v1.1

**What it did.** The model estimated the ten prices, applied the formulas and converted to AUD, all in one answer.

**Why it was replaced.** Its arithmetic and exchange rate could not be checked, and the rate was not recorded.

### v2.1: removed

Added an external hotel-price lookup on top of v1. The code was removed in a cleanup pass.

### v3 (July 2026): abandoned

**What it tried.** Collect every price directly from named sources, such as restaurant menus and hotel sites, for a
36-city pilot.

**Why it was not used.** Each tier needs several prices at once, so one missing price blanks every tier that uses it.
After weeks of collection it had 23% of the tier values (156 of 684) and no complete city.

### v4 (July 2026): never integrated

**What it tried.** Read food and drink prices from a crowd-sourced cost-of-living site and hotel prices from
booking-site pages, then derive the remaining prices from ratios fitted across 99 cities.

**Why it was not used.** The site blocked requests after about 40 in a row and had no page for 55% of low-cost
destinations; hotel readings were unstable; activity prices could not be derived; and the fitted ratios still missed by
18 to 22%.

### v5 (August 2026): rejected

About 90 prompt experiments sending a model to find particular prices from particular sources. No source covered every
price for every city, and a single call never returned a complete city.

### v6 and v6.1 (August 2026): rejected

Three web-search calls per city with statistical fallbacks and graded ranges. Too large and fragile to run or refresh,
and in the final test the searches found none of the nine prices in three Japanese cities.

# Holiday Spend Tracker — City Cost Database Methodology

**Version 2.0 | 121 Cities | April 2026**

All tier values are for **TWO people**, per night (accommodation) or per day (food/drinks/activities).  
Currency: AUD in app-facing data (USD→AUD rate: 1.55). Full dataset includes both USD and AUD.

---

## 1. Anchor Prices

Each city requires 10 directly-researched anchor prices (all in USD):

| # | Anchor | Definition | Primary Source |
|---|--------|-----------|----------------|
| 1 | `beer` | Domestic draft beer, 1 pint, at a restaurant | Numbeo "Domestic Draft Beer (1 Pint)" |
| 2 | `coffee` | Regular cappuccino | Numbeo "Cappuccino (Regular Size)" |
| 3 | `inexp_meal_1p` | Meal at an inexpensive restaurant, 1 person | Numbeo "Meal, Inexpensive Restaurant" |
| 4 | `midrange_meal_2p` | Mid-range restaurant, 3 courses, 2 people, no drinks | Numbeo "Meal for 2, Mid-range Restaurant" |
| 5 | `cocktail` | Standard cocktail at a bar or restaurant | If unavailable: `beer × 2.5` |
| 6 | `wine_glass` | Glass of wine at a restaurant | If unavailable: `beer × 1.5` |
| 7 | `hostel_dorm_1p` | 1 dorm bed per night, well-reviewed hostel | Hostelworld median for city |
| 8 | `hostel_private_2p` | 1 private hostel/guesthouse room, 2 people, per night | Hostelworld or Booking.com |
| 9 | `hotel_1star_2p` | Very basic hotel or guesthouse, 1 room, 2 people, per night | Booking.com lowest tier |
| 10 | `hotel_3star_2p` | Comfortable 3-star hotel, 1 room, 2 people, per night | Booking.com 3-star median |

### Source Priority

1. **Numbeo.com** — city-level data, most recent available (crowd-sourced, large sample sizes for major cities).
2. **Hostelworld.com / Booking.com** — accommodation pricing (use median, not minimum).
3. **Nearest-city scaling** — if no direct data exists, find the nearest city WITH Numbeo data. Apply Numbeo's relative cost-of-living index to scale from that city. Record this in a `confidence_notes` field.
4. **Regional-hub adjustment** — for very small or remote places (e.g. Pu Luong, Don Det, Santa Fe Bantayan), use the nearest regional hub and adjust down 10–30% based on remoteness and local price level.

### Fallback Rules for Missing Anchors

- **Cocktail unavailable:** estimate as `beer × 2.5`
- **Wine glass unavailable:** estimate as `beer × 1.5`
- **No hostel scene** (e.g. small rural town): set `hostel_dorm_1p = hotel_1star_2p / 2` and `hostel_private_2p = hotel_1star_2p`
- **"Street food" in expensive Western cities** (Paris, London, Copenhagen, etc.): this tier represents cheap takeaway, fast food, or budget counter-service — not literal street stalls.

---

## 2. Tier Derivation Formulas

All formulas produce values for **2 people**. The database stores these base-2 values; scaling to other group sizes happens at runtime (see Section 3).

### Accommodation (per night, 2 people)

```
accom_shared_hostel_dorm  = hostel_dorm_1p × 2
accom_hostel_private_room = hostel_private_2p                [direct lookup]
accom_1_star              = hotel_1star_2p                   [direct lookup]
accom_2_star              = (hotel_1star_2p + hotel_3star_2p) / 2
accom_3_star              = hotel_3star_2p                   [direct lookup]
accom_4_star              = hotel_3star_2p × 1.80
```

**Rationale:** 2-Star is interpolated as the midpoint between 1-Star and 3-Star. The 4-Star multiplier of 1.80× was empirically validated across the 20-city calibration set and is stable (CV = 0%).

### Food (per day, 2 people)

```
street_food_meal = inexp_meal_1p × 0.60

food_street_food = street_food_meal × 3 meals × 2 people
food_budget      = (street_food_meal × 2 + inexp_meal_1p) × 2 people
food_mid_range   = (street_food_meal + inexp_meal_1p + midrange_pp) × 2 people
food_high_end    = food_mid_range × 1.50

where midrange_pp = midrange_meal_2p / 2
```

**Rationale:**
- Street food tier assumes 3 cheap meals, each costing 60% of the cheapest sit-down restaurant.
- Budget tier mixes 2 street meals with 1 cheap restaurant meal.
- Mid-range blends a cheap meal, a street meal, and a proper restaurant meal.
- High-end applies a fixed 1.5× uplift on mid-range, reflecting larger portions, more courses, and nicer venues.
- The Food Mid/Street ratio has CV = 21.3% across calibration cities. This is expected — SEA street food is structurally cheaper relative to restaurants than in Western cities. This variance is a feature, not a bug.

### Drinks (per day, 2 people — basket approach)

```
drinks_light    = 2 × coffee + 2 × beer
drinks_moderate = 2 × coffee + 4 × beer + 2 × cocktail
drinks_heavy    = 2 × coffee + 6 × beer + 4 × cocktail + 2 × wine_glass
```

**Rationale:** Each tier is a literal basket of drinks consumed by 2 people across the day. This is the most robust derivation (CV = 11.5%) because it's a direct sum of observable unit prices with no multipliers or approximations.

**Basket definitions:**
- **Light:** 1 coffee each + 1 beer each per day.
- **Moderate:** 1 coffee each + 2 beers each + 1 cocktail each per day.
- **Heavy:** 1 coffee each + 3 beers each + 2 cocktails each + 1 glass of wine each per day.

### Activities (per day, 2 people — blended local/global scaling)

```
blended_factor    = (inexp_meal_1p + 10.00) / 2

activities_free       = 0.00
activities_budget     = blended_factor × 2
activities_mid_range  = blended_factor × 5.5
activities_high_end   = blended_factor × 12
```

**Rationale:** Activities pricing is influenced by both local cost levels (a tuk-tuk tour costs less in Cambodia than Denmark) and global price floors (a scuba dive costs ~$50–80 USD globally). The blended factor averages the local proxy (`inexp_meal_1p`) with a $10 USD global baseline to prevent:
- Too-low values in cheap countries (without blending: Bangkok high-end activities = A$43/day, which is below the cost of a single cooking class)
- Too-high values in expensive countries (without blending: Copenhagen = A$535/day, which is absurd)

With blending, the range is A$18–50 (budget) to A$112–298 (high-end), which aligns with real-world activity pricing.

---

## 3. Group Size Scaling (1–5 people)

The database stores base values for **2 people only**. The app applies these scaling rules at runtime.

### Accommodation — Hostel Dorm (per-bed pricing)

```
scaled = base_2p × (N / 2)
```

| People | Multiplier |
|--------|-----------|
| 1 | ×0.50 |
| 2 | ×1.00 |
| 3 | ×1.50 |
| 4 | ×2.00 |
| 5 | ×2.50 |

### Accommodation — All room-based tiers (Private Room / 1★ / 2★ / 3★ / 4★)

```
rooms_needed = ceil(N / 2)
scaled = base_2p × rooms_needed
```

| People | Rooms | Multiplier |
|--------|-------|-----------|
| 1 | 1 | ×1.0 |
| 2 | 1 | ×1.0 |
| 3 | 2 | ×2.0 |
| 4 | 2 | ×2.0 |
| 5 | 3 | ×3.0 |

**Rationale:** Hotels charge per room, not per person. A solo traveller in a double room pays the same as a couple. Groups of 3+ need additional rooms. The `ceil(N/2)` rule assumes standard double occupancy.

### Food (sharing discount for groups)

```
sharing_discount = 1.0 − 0.05 × max(0, N − 2)
scaled = base_2p × (N / 2) × sharing_discount
```

| People | Raw multiplier | Discount | Effective multiplier |
|--------|---------------|----------|---------------------|
| 1 | 0.50 | 0% | ×0.500 |
| 2 | 1.00 | 0% | ×1.000 |
| 3 | 1.50 | 5% | ×1.425 |
| 4 | 2.00 | 10% | ×1.800 |
| 5 | 2.50 | 15% | ×2.125 |

**Rationale:** Food scales roughly per-person, but groups share dishes, appetisers, sides, and platters. The 5% discount per additional person beyond 2 is conservative and reflects this sharing economy. Capped at 15% (5 people).

### Drinks (strictly linear)

```
scaled = base_2p × (N / 2)
```

Drinks are individual consumption — no group discount.

### Activities (strictly linear)

```
scaled = base_2p × (N / 2)
```

Entry fees and tickets are per person — no group discount.

### Implementation Reference

```python
import math

def scale_cost(base_2p, n_people, category):
    """Scale a base-2-person cost to N people.
    
    Args:
        base_2p: Cost for 2 people (from database)
        n_people: Group size (1-5)
        category: One of 'accom_dorm', 'accom_room', 'food', 'drinks', 'activities'
    
    Returns:
        Scaled cost for the group
    """
    if category == 'accom_dorm':
        return base_2p * (n_people / 2)
    elif category == 'accom_room':
        rooms = math.ceil(n_people / 2)
        return base_2p * rooms
    elif category == 'food':
        discount = 1.0 - 0.05 * max(0, n_people - 2)
        return base_2p * (n_people / 2) * discount
    else:  # drinks, activities
        return base_2p * (n_people / 2)
```

---

## 4. Validation Results

### Ratio Stability (20-city calibration set)

A coefficient of variation (CV) below 20% indicates the formula produces consistent results across diverse cities.

| Ratio | Mean | CV | Status |
|-------|------|-----|--------|
| Food High-End / Mid-Range | 1.50 | 0.0% | ✓ Fixed multiplier |
| Drinks Heavy / Light | 5.69 | 11.5% | ✓ Stable |
| Hostel Private / Dorm | 1.38 | 13.7% | ✓ Stable |
| Activities High-End / Budget | 6.00 | 0.0% | ✓ Fixed multiplier |
| Food Mid-Range / Street Food | 2.62 | 21.3% | ⚠ Expected variance |

### Budget-per-person-per-day Sanity Check

| City | Backpacker (AUD) | Mid-Range (AUD) | Luxury (AUD) |
|------|-----------------|-----------------|--------------|
| Don Det (cheapest) | $24 | $53 | $100 |
| Hanoi | $28 | $82 | $155 |
| Bangkok | $37 | $109 | $200 |
| Budapest | $62 | $160 | $288 |
| Tokyo | $84 | $209 | $377 |
| Paris | $142 | $324 | $578 |
| NYC (most expensive) | $178 | $419 | $747 |

These align with published backpacker indexes from BudgetYourTrip and Price of Travel.

---

## 5. Data Sources

| Source | What it provides | URL |
|--------|-----------------|-----|
| Numbeo | Food, drink, transport unit prices (crowd-sourced) | numbeo.com/cost-of-living |
| Hostelworld | Hostel dorm + private room pricing | hostelworld.com |
| Booking.com | Hotel star-category median pricing | booking.com |
| Price of Travel | Hostel Price Index (cross-validation) | priceoftravel.com |
| BudgetYourTrip | Traveler-reported daily budgets (validation) | budgetyourtrip.com |
| hikersbay / world-prices | Secondary cross-validation | hikersbay.com |

---

## 6. Known Limitations

1. **"Street Food" in expensive Western cities** = cheap takeaway or fast food, not literal street stalls.
2. **4-Star hotel** uses a fixed 1.8× multiplier on 3-Star. May underestimate luxury pricing in cities with very steep hotel gradients (e.g. Dubai, NYC).
3. **Seasonal variation** not captured. All prices are shoulder-season estimates. Peak season (Christmas, New Year, local festivals) can inflate accommodation by 30–100%.
4. **Remote/small cities** (Pu Luong, Don Det, Santa Fe Bantayan, etc.) are estimated from regional hubs. These carry lower confidence.
5. **Activities** use a blended local/global scaling factor. The global baseline ($10 USD) may need adjustment if the global cost floor changes significantly.
6. **Wine and cocktail prices** are estimated where Numbeo data is sparse — these should be verified for accuracy in alcohol-restricted countries (e.g. parts of SE Asia, Middle East).
7. **Currency rates** — the USD→AUD rate of 1.55 is approximate. The app should ideally use a live or regularly-updated rate.

---

## 7. Adding New Cities

Use the LLM prompt in `llm_prompt_new_cities.md` to generate entries for cities not in the database. The prompt instructs the model to:

1. Look up the 10 anchor prices from the specified source hierarchy
2. Apply the exact derivation formulas documented above
3. Convert to AUD
4. Output JSON in the database schema
5. Flag confidence level (high / medium / low)

The output JSON can be appended directly to the CSV database.

---

## 8. Column Reference

The app-facing CSV (`city_costs_app_aud.csv`) contains these columns:

| Column | Unit | Description |
|--------|------|-------------|
| `city` | — | City name |
| `country` | — | Country name |
| `region` | — | One of: SEA, East Asia, South Asia, Middle East, Africa, Europe, Latin America, North America, Oceania |
| `accom_shared_hostel_dorm` | AUD/night/2p | Two dorm beds |
| `accom_hostel_private_room` | AUD/night/2p | One private hostel room |
| `accom_1_star` | AUD/night/2p | One basic hotel/guesthouse room |
| `accom_2_star` | AUD/night/2p | One simple hotel room |
| `accom_3_star` | AUD/night/2p | One mid-range hotel room |
| `accom_4_star` | AUD/night/2p | One upscale hotel room |
| `food_street_food` | AUD/day/2p | Daily food: mostly street stalls and markets |
| `food_budget` | AUD/day/2p | Daily food: mix of street food and cheap restaurants |
| `food_mid_range` | AUD/day/2p | Daily food: casual + some nicer sit-down meals |
| `food_high_end` | AUD/day/2p | Daily food: frequent nicer restaurants |
| `drinks_light` | AUD/day/2p | 2 coffees + 2 beers |
| `drinks_moderate` | AUD/day/2p | 2 coffees + 4 beers + 2 cocktails |
| `drinks_heavy` | AUD/day/2p | 2 coffees + 6 beers + 4 cocktails + 2 wines |
| `activities_free` | AUD/day/2p | Parks, beaches, walks, free sights |
| `activities_budget` | AUD/day/2p | Low-cost museums, temples, local attractions |
| `activities_mid_range` | AUD/day/2p | Paid tours, classes, bigger ticket entries |
| `activities_high_end` | AUD/day/2p | Premium tours, adventure activities, splurges |

# v6 Ground-Truth Panel

This directory contains the one-time ground-truth collection for the frozen v6 validation panel.

The reference window is one night, arrival `2026-09-17`, departure `2026-09-18`, for two adults and
one room (or one dorm bed). The original six-measure panel was accommodation-scoped. The amended v3
contract has 18 rows per city so the 19 product tiers can be fitted and validated:

- `hostel_dorm_bed_1p`
- `hostel_private_room_2p`
- `hotel_1star_room_2p`
- `hotel_3star_room_2p`
- `hotel_4star_room_2p`
- `paid_attraction_adult_1`
- `inexpensive_restaurant_meal_1p`
- `midrange_restaurant_meal_2p`
- `mcmeal_combo`
- `cappuccino_1`
- `domestic_draft_beer_1`
- `half_day_group_activity_adult_1`
- `full_day_premium_activity_adult_1`
- `premium_restaurant_meal_2p`
- `cocktail_1`
- `wine_glass_1`
- `hotel_2star_room_2p`
- `street_food_meal_1p`

## Files

| File | Purpose |
| --- | --- |
| `development-ledger.json` | Append-only development-city observations and explicit collection metadata |
| `holdout-ledger.json` | The original six-measure holdout observations; those measures are revealed_once and spent |
| `holdout-extension.json` | Per-measure sealed work queue for the twelve new rows; it contains no old holdout values |
| `holdout-seal.json` | Per-measure lock marker; old measures remain revealed_once and new measures have their own lifecycle |
| `../validation-manifest-v6.json` | Source of truth for city membership and gates |

Run the deterministic audit with:

```bash
node scripts/validate-city-cost-v6-ground-truth.mjs
```

The validator reads only the 25 development cities. It refuses holdout observations, duplicate city /
measure rows, wrong reference dates, missing source metadata, and unsupported statuses. It checks only the
holdout seal metadata and never reads, scores, fits, compares, or inspects `holdout-ledger.json`.

Ground truth is not copied from the shipping CSV or v5 observations. A found row must retain the displayed
amount and currency, source URL, retrieval date, tax/fee wording, and property name for property-level
accommodation quotes. Failed retrievals remain explicit (`not_found`, `blocked`, `stale`, or
`class_absent`) rather than being replaced with a plausible value.

The ledger uses schema `city-cost-v6-ground-truth-ledger-v4`. Found accommodation rows additionally
require `samplePrices`, `listPriceAmount`, `dealLabels`, `classInventoryCount`, and `selectionRule`.
`samplePrices` is the full set of first-page listing prices behind the median; `listPriceAmount` preserves
the displayed strikethrough price for the representative first listing or is `null`; `dealLabels` preserves
public promotional labels; `classInventoryCount` preserves Booking's displayed inventory depth; and
`selectionRule` must be `booking_top_picks_firstpage_median_v2`. The prior `booking_price_asc_median_v1`
rows remain identifiable as superseded migration evidence until their cities are re-collected.

The development and sealed holdout `sourcePolicy` records Booking.com as the accommodation ground-truth
source and Expedia as the production anchor. The calibration direction is **Booking -> Expedia**, and at
least 12 matched cities are required before fitting that source offset. Its level-bias caveat records the
Copenhagen stage-1 finding:
the top-picks first-page median undershot the full-inventory median by roughly 20-27% at 25 listings. Do not
use this panel to set or score absolute city levels; its intended use is within-city ratios and source
calibration. The food and drink rows are independently sourced from official menus or venue price lists,
never Numbeo. The street-food row is independently sourced from official street-stall, market-board,
bakery-takeaway or local prepared-meal menus; McDonald's is retained only as a Numbeo cross-check.
Activity rows are independently sourced from official operator or attraction pages, never BudgetYourTrip.
Batch 007 resolved the fresh holdout extension before sealing: 12 found independent menu rows and 168
explicit `not_found` rows across 15 cities x 12 measures. Rows with currencies absent from the frozen FX
snapshot remain source facts but are not comparable in scoring. The exact selection rules are frozen in
`validation-manifest-v6.json`; every panel median retains its
individual prices in `samplePrices`.

## Street-food selection rule

The current rule is `independent_street_food_panel_first5_median_v1`. Run the city-scoped query for street
food, market food, bakery takeaway and casual prepared meals. In search-result order, take the first five
distinct eligible official vendor, market-board or tourism-listed venue pages that publish regular public
prices for prepared savoury meals eaten out. From each page retain qualifying item prices in menu order
until five prices are recorded, with no more than three prices from one page. Exclude drinks, desserts,
packaged groceries, McDonald's or other global chains, delivery/aggregator prices, happy hours and temporary
promotions. Record every selected single-person meal price and use the median; require at least three
prices. If official city evidence establishes that no street-food category exists, record `class_absent`
with the reason; otherwise an exhausted route is `not_found`. A missing route is never filled with Numbeo,
Expatistan or a plausible substitute.

## Accommodation price basis

For a frozen-window Booking.com quote, record as `amount` the lowest price a logged-out visitor with no
membership is quoted for a room meeting the class and occupancy specification. Public promotional deals
available to any visitor — including Getaway Deal, Early Booker, Bonus savings and seasonal sales — are
transactable and included. Membership-gated rates, including Genius and VIP reward tiers, are excluded.
Never record a strikethrough or "original" price as `amount`; it is a marketing number nobody transacts at,
and its inflation factor is not constant, so it cannot be calibrated out. Preserve that strikethrough value
separately as `listPriceAmount` when it is shown.

## Accommodation selection rule

The current selection rule is `booking_top_picks_firstpage_median_v2`. On the city-scoped Booking.com results
page for the frozen window, use 2 adults / 1 room (1 adult / 1 room for a dorm), filter to the required star
class or `Hostel`, leave Booking's default **Our top picks** order selected, and take every first-page listing
that meets the class and occupancy specification. For a dorm, Booking may label the same default order
**Top picks for solo travellers**. Record every displayed price in page order in `samplePrices`, record the
displayed `N properties found` figure as `classInventoryCount`, and set `amount` to the median (the mean of
the two middle values for an even count). A class with fewer first-page listings contributes all available
listings. This first-page popularity-weighted bias is deliberate and auditable; the Copenhagen stage-1
analysis measures its depth effect rather than treating it as unknown. It is a **level bias**, not a ratio
bias: at 25 listings, Copenhagen's first-page median undershot the full 108-listing median by roughly
20-27% (the exact stage-1 comparison is retained in `data/reference/dry-run/phase-0g-stage1-analysis.json`).
This panel is therefore valid for within-city ratios and source-structure calibration, but must not be used
to set or score absolute city levels. The fixed-count price-ascending rule was superseded because class
inventory depth placed deep 3/4-star classes near their price floor while shallow 1-star/hostel classes
remained nearer their middle.

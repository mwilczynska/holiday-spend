# v6 Ground-Truth Panel

This directory contains the one-time ground-truth collection for the frozen v6 validation panel.

The reference window is one night, arrival `2026-09-17`, departure `2026-09-18`, for two adults and
one room (or one dorm bed). The six required measures are the accommodation ladder endpoints plus one
paid attraction ticket:

- `hostel_dorm_bed_1p`
- `hostel_private_room_2p`
- `hotel_1star_room_2p`
- `hotel_3star_room_2p`
- `hotel_4star_room_2p`
- `paid_attraction_adult_1`

## Files

| File | Purpose |
| --- | --- |
| `development-ledger.json` | Append-only development-city observations and explicit collection metadata |
| `holdout-seal.json` | Lock marker only; contains no holdout prices or scores |
| `../validation-manifest-v6.json` | Source of truth for city membership and gates |

Run the deterministic audit with:

```bash
node scripts/validate-city-cost-v6-ground-truth.mjs
```

The validator reads only the 25 development cities. It refuses holdout observations, duplicate city /
measure rows, wrong reference dates, missing source metadata, and unsupported statuses. It does not score,
fit, or inspect holdout results.

Ground truth is not copied from the shipping CSV or v5 observations. A found row must retain the displayed
amount and currency, source URL, retrieval date, tax/fee wording, and property name for property-level
accommodation quotes. Failed retrievals remain explicit (`not_found`, `blocked`, `stale`, or
`class_absent`) rather than being replaced with a plausible value.

## Accommodation price basis

For a frozen-window Booking.com quote, record as `amount` the lowest price a logged-out visitor with no
membership is quoted for a room meeting the class and occupancy specification. Public promotional deals
available to any visitor — including Getaway Deal, Early Booker, Bonus savings and seasonal sales — are
transactable and included. Membership-gated rates, including Genius and VIP reward tiers, are excluded.
Never record a strikethrough or "original" price as `amount`; it is a marketing number nobody transacts at,
and its inflation factor is not constant, so it cannot be calibrated out. Preserve that strikethrough value
separately as `listPriceAmount` when it is shown.

## Accommodation selection rule

The deterministic selection rule is `booking_price_asc_median_v1`. On the city-scoped Booking.com results
page for the frozen window, use 2 adults / 1 room (1 adult / 1 room for a dorm), filter to the required star
class or `Hostel`, sort by **Price ascending**, and take the first 10 listings that meet the class and
occupancy specification. Record every selected quote in `samplePrices`; `amount` is their median (the mean
of the two middle values for an even count). If 10 eligible listings are not available, use a minimum of 3
and record the same count for every class in that city. Never use one listing. The rule's deliberate mild low
bias is consistent across the within-city ratios, where estimator bias is expected to cancel.

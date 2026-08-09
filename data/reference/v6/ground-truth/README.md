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

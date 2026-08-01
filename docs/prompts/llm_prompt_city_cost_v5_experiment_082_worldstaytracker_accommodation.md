# v5 Experiment 082 prompt — World Stay Tracker 3-/4-star accommodation panel

You are a strict source-feasibility extractor. Research exactly one city: `{{CITY}}, {{COUNTRY}}`. Return JSON only.

Issue exactly four ordered web operations, with no retries, fallback source, arithmetic, currency conversion, or cross-city evidence:

1. Search: `site:worldstaytracker.com/city {{CITY}} {{COUNTRY}} World Stay Tracker 3-star hotel prices`
2. Read the exact World Stay Tracker 3-star city result returned by search 1.
3. Search: `site:worldstaytracker.com/city {{CITY}} {{COUNTRY}} World Stay Tracker 4-star hotel prices`
4. Read the exact World Stay Tracker 4-star city result returned by search 3.

Accept a row only when the exact page visibly establishes the exact city and selected rating, a numeric USD city average,
the check-in date, booking/advance date or window, property count, and the source contract `2 adults / 1 night /
breakfast included / review score 7+`. Reject ranges, `from` prices, individual-property prices, wrong/nearby cities,
non-USD-only rows, missing rating, or pages without the explicit occupancy and inclusion basis. Preserve source URL/title
and exact evidence. Do not remove or estimate breakfast.

Return schema `city-cost-v5-worldstaytracker-accommodation-v1` with `hotel_3star_room_2p` and `hotel_4star_room_2p`
measures plus the standard telemetry object. These are source observations for a semantic/coverage screen only; do not
map product tiers or perform arithmetic.

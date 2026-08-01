# v5 Experiment 083 prompt — World Stay Tracker cityid/rating panel

You are a strict source-feasibility extractor. Research exactly one city: `{{CITY}}, {{COUNTRY}}`. Return JSON only.

Issue exactly three ordered web operations, with no retries, fallback source, arithmetic, currency conversion, or
cross-city evidence:

1. Search: `site:worldstaytracker.com/city {{CITY}} {{COUNTRY}} World Stay Tracker hotel prices`
2. Read the exact World Stay Tracker city result returned by search 1. It must visibly establish the exact city,
   its cityid URL parameter, and one selected rating.
3. Construct the same World Stay Tracker URL by changing only its `rating` query parameter to `4` while retaining
   the exact returned `cityid`, `advanceperiod`, and host/path, then read that exact URL. This is a deterministic URL
   parameter substitution, not a second search or fallback. If the page is unavailable or does not visibly establish
   the exact city and rating, return `not_found` for that class.

Accept a row only when the exact page visibly establishes the exact city and selected rating, a numeric USD city average,
the check-in date, booking/advance date or window, property count, and the source contract `2 adults / 1 night /
breakfast included / review score 7+`. Reject ranges, `from` prices, individual-property prices, wrong/nearby cities,
non-USD-only rows, missing rating, or pages without the explicit occupancy and inclusion basis. Preserve source URL/title
and exact evidence. Do not remove or estimate breakfast.

Return schema `city-cost-v5-worldstaytracker-cityid-rating-v1` with `hotel_3star_room_2p` and `hotel_4star_room_2p`
measures plus the standard telemetry object. These are source observations for a semantic/coverage screen only; do not
map product tiers or perform arithmetic.

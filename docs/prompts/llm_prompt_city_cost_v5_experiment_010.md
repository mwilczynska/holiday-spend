You are collecting accommodation ground truth for one city for Holiday Spend. Return one JSON object and
do not calculate, estimate, convert currency, or emit any product tier.

CITY: {{city}}
COUNTRY: {{country}}
REFERENCE DATE: 2026-07-31
CHECK-IN: 2026-09-15
CHECK-OUT: 2026-09-16

This is a source-contract test. Use the date-fixed, signed-out public source families below; do not switch
to city-level guidance or an unrelated source merely to fill a gap:

- Hostelworld (or a named hostel's own public booking/rates page) for `hostel_dorm_bed_1p` and
  `hostel_private_room_2p`.
- Booking.com or Hotels.com public result/property pages for `hotel_1star_room_2p` through
  `hotel_4star_room_2p`.

Search each source family deliberately with the fixed dates and two adults. A value is usable only when the
retrieved page or result states the exact city/property, the fixed one-night dates (or an unambiguous one
night total for those dates), currency, occupancy, and the requested class. Reject ranges, `from` prices,
package or multi-night totals, member/login/mobile rates, stale promotions, and prices requiring arithmetic.
Do not use a blended hostel listing as evidence for both dorm and private room. A hotel class must be
explicitly stated; do not infer stars from a property's name or review score. Record blocked or unavailable
pages as `blocked` or `not_found`; never replace them with a plausible value. No arithmetic or FX.

Measures:
- `hostel_dorm_bed_1p`: one individual bed in a shared hostel dorm (per-bed price)
- `hostel_private_room_2p`: one private hostel room for two
- `hotel_1star_room_2p`: one standard one-star hotel room for two
- `hotel_2star_room_2p`: one standard two-star hotel room for two
- `hotel_3star_room_2p`: one standard three-star hotel room for two
- `hotel_4star_room_2p`: one standard four-star hotel room for two

Return exactly this shape with all six keys:

{
  "city": "{{city}}",
  "country": "{{country}}",
  "referenceDate": "2026-07-31",
  "stay": {"checkIn": "2026-09-15", "checkOut": "2026-09-16", "adults": 2},
  "sourceContract": {"hostelSourceFamily": "hostelworld_or_property", "hotelSourceFamily": "booking_or_hotels", "signedOut": true},
  "directLookup": {"attempted": true, "outcome": "accepted|partial|blocked|no_page", "notes": "brief factual note"},
  "measures": {
    "<measure>": {
      "status": "found|not_found|class_absent|blocked",
      "value": 0.0,
      "currency": "EUR",
      "unit": "per_room_night|per_person_bed_night",
      "basis": "property_quote",
      "sourceFamily": "hostelworld|property_site|booking|hotels",
      "sourceUrl": "https://example.com/page",
      "retrievedAt": "2026-07-31",
      "note": "brief factual evidence or failure note"
    }
  }
}

For non-found statuses use null for value, currency, unit, basis, sourceFamily, and sourceUrl. A found
value requires a source URL and a factual basis note that mentions the dates, occupancy, and class. Return
JSON only; do not emit hotel ratios, estimates, or unsupported absence claims.

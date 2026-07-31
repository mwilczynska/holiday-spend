You are extracting accommodation ground-truth quotes for exactly one city. Do not search for or mention any
other city. Return one JSON object and do not calculate, estimate, convert currency, or emit product tiers.

CITY: Copenhagen
COUNTRY: Denmark
REFERENCE DATE: 2026-07-31
CHECK-IN: 2026-10-22
CHECK-OUT: 2026-10-29
STAY NIGHTS: 7
ADULTS: 2
ROOMS: 1

This is an interactive-page capability test. Open each supplied official property booking URL directly while
preserving the exact dates, two adults, and one room. These URLs are an oracle source list for this test; do
not generalise this URL list to other cities. Accept a quote only when the result page confirms the property,
dates, occupancy, room class, currency, and an exact payable total for the seven-night stay. Taxes and
mandatory fees must be stated or explicitly unknown. Public signed-out rates only; reject member/login rates,
ranges, `from` rates, defaults that reverted to other dates, and prices requiring arithmetic. Return the
payable total and stayNights; deterministic local code will divide by seven later.

Official property booking URLs:
1. Andersen Boutique Hotel — https://app.mews.com/distributor/6c720f48-b638-4d33-9208-aa7900b19381?mewsStart=2026-10-22&mewsEnd=2026-10-29&mewsAdultCount=2&mewsChildCount=0
2. Hotel Alexandra — https://simplebooking.hotelalexandra.dk/ibe2/hotel/3504/?guests=A%2CA&lang=EN&cur=DKK&in=2026-10-22&out=2026-10-29
3. Wide Hotel — https://be.synxis.com/?adult=2&arrive=2026-10-22&depart=2026-10-29&chain=33084&hotel=47789&locale=en-US&currency=DKK
4. Hotel Skt. Annæ — https://app.mews.com/distributor/c77f2ba9-8f6d-4834-a726-b14600800645?mewsStart=2026-10-22&mewsEnd=2026-10-29&mewsAdultCount=2&mewsChildCount=0
5. The Huxley Copenhagen — https://www.bestwestern.com/en_US/book/hotel-rooms.96062.html?adults=2&checkIn=2026-10-22&checkOut=2026-10-29&rooms=1

Return exactly this shape:

{
  "city": "Copenhagen",
  "country": "Denmark",
  "referenceDate": "2026-07-31",
  "stay": {"checkIn":"2026-10-22","checkOut":"2026-10-29","nights":7,"adults":2,"rooms":1},
  "quotes": [
    {
      "propertyName": "Andersen Boutique Hotel",
      "status": "found|not_found|blocked|wrong_dates|no_availability",
      "total": 0.0,
      "currency": "DKK",
      "nights": 7,
      "roomName": "exact displayed room",
      "rateName": "exact displayed public rate",
      "taxStatus": "included|excluded|unknown",
      "sourceUrl": "https://example.com",
      "evidenceNote": "brief factual confirmation of date, occupancy, room, total, and tax basis"
    }
  ],
  "outcome": "accepted|partial|blocked|no_page",
  "notes": "brief factual summary"
}

Return all five properties in the supplied order. For non-found statuses use null for total, currency,
nights, roomName, rateName, taxStatus, and sourceUrl. Return JSON only. Do not compute nightly values or a
median.

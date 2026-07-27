# Accommodation Collection And Class Ladder — v4

**Status:** Stages A–D complete, 27 July 2026. Evidence: `data/reference/dry-run/stage1/`,
`phase-0g-stage1-analysis.json`, `phase-0h-accommodation-class-ratios.json`.

## The requirement this serves

A small, cheap model must be able to fetch *some* hotel data for a new city, and the rest must be
modelled. That fixes the shape of the answer before any collection: the read has to be one plain URL
per city per class, signed out, no browser automation, no login, no pagination, no client-side
filtering. Anything requiring a headless browser fails the requirement no matter how accurate it is.

## What was measured

### Stage A — the first-page estimator is biased, and the headline is worse

Copenhagen has the only full-inventory read: 108 four-star properties captured in page order under the
platform default sort. That makes `median(first n)` exactly what a shallow collector would report, so
the bias is arithmetic rather than conjecture.

| Read | Median (AUD) | Error vs full inventory |
| --- | --- | --- |
| first 5 | 414 | −0.7% |
| first 10 | 395 | −5.2% |
| first 20 | 300 | −28.1% |
| first 50 | 331 | −20.7% |
| all 108 | 417 | 0% |

The curve is **non-monotonic** because the commercial sort *orders* price along the page rather than
scattering it. Sliding a 10-property window across the same 108 prices gives medians from **275 to
1085 — a 3.945× spread and 160.2% worst-case error**. The `n=10` reading landing at −5.2% is luck.

The platform headline average is not a usable substitute, and not for the reason expected. It is not
consistently inflated, it is **erratic**: 0.451× the list median in Hanoi, 1.834× in Vancouver, and in
Bangkok the 4-star headline prints *below* the 3-star one. Headlines are never read as values.

### Stage B — the channel that meets the requirement

`https://www.booking.com/{fourstars|threestars|twostars}/city/{cc}/{slug}.html` renders a first-page
property list on a plain signed-out fetch. Eleven further cities were collected across every region.

Both alternatives fail the requirement. Booking.com's live search returns no list without a browser.
Trip.com renders but **silently ignores `sort` and `star` parameters** — a request for 4-star Copenhagen
returned all 363 properties including a hostel — and two fetches of the same URL minutes apart returned
different prices and ordering, so it is not reproducible either.

### Stage D — the ladder is modellable from one anchor

Anchor on the 3-star class median; predict the others. Every relation is a within-city ratio, so
currency and city price level cancel and no FX is involved.

| Relation | n | Median ratio | IQR | R0 LOO / holdout | R1 LOO / holdout | Selected |
| --- | --- | --- | --- | --- | --- | --- |
| `4star / 3star` | 16 | **1.297** | 1.257–1.555 | **12.6% / 16.9%** | 17.2% / 21.8% | **R0** |
| `2star / 3star` | 16 | **0.734** | 0.679–0.903 | **15.8% / 14.1%** | 22.5% / 15.1% | **R0** |

Cost bands make both relations worse on leave-one-out *and* holdout, so the one-parameter form stands
under the Phase 0d rule that a more complex form is adopted only when both agree.

**Independent check.** Copenhagen's full-inventory, date-controlled read gives `417 / 273 = 1.527`,
inside the observed range. A ladder fitted on the biased first-page estimator transfers to an unbiased
one — which is the level-versus-structure separation working again: the estimator's bias is largely
common to both classes and cancels in their ratio.

**The incumbent constant is refuted.** `docs/prompts/llm_prompt_new_cities_1.md` asserts
`accom_4_star = hotel_3star × 1.80` for all 121 rows. Applied to these same anchors it overpredicts
**14 of 16 cities, median absolute error 38.8%**, reaching +80.1% in San Francisco. The observed IQR
does not contain 1.800.

## The method

**Estimand.** `hotel_Nstar_room_2p` = median displayed price across the properties on the platform's
star-class city page, read signed out. Recorded as `starClassBasis: platform_equivalent` — these are
platform star-equivalents, not official national classification.

**Collection, per city.** One fetch of the `threestars` page. Read every property price in the list.
Record the property names alongside the prices, the currency, and the city and country the page states
it is about. Report the median.

**Derivation.** `4star = 3star × 1.297`, `2star = 3star × 0.734`, both labelled `modelled` with the
fitted interval, never presented as observed evidence. The existing `evidenceBasis` / `imputedMeasures`
guardrail on `MaterializedCityCostTier` already enforces that distinction.

**Refresh.** One fetch per city per quarter, versus six for a full direct read. The ratios re-fit
annually.

### Mandatory rejection rules

These are the failure modes actually observed during Stages A–D, not hypotheticals.

1. **Never read the headline average.** Erratic in both directions; Bangkok inverts the classes.
2. **Confirm the page is about the requested city.** Both `mexico-city` and `ciudad-de-mexico` returned
   Mexico-wide content — León, Guadalajara, Monterrey, Mazatlán, Holbox — with plausible-looking prices
   and no error. A silent country-level fallback is the most dangerous failure here because nothing
   about the output looks wrong.
3. **Drop room nights below USD 12.** Nairobi returned 2.33 and 9.29, which cannot be two-adult room
   nights and are display defects.
4. **Reject a class list of fewer than four priced properties.** Auckland's 2-star page returned five,
   Budapest's four, Nairobi's six.
5. **Record single-brand lists as low confidence.** Nine of Dubai's ten 3-star entries were the same
   chain (Rove), making that a brand sample rather than a class sample.

### Known limitations, to be disclosed on `/estimates`

- **Undated.** The pages reflect an uncontrolled forward window and drift — Copenhagen's 4-star headline
  moved 334 → 326 within a single day. Copenhagen's own recon showed a **3.3× intra-year seasonal
  spread**, far larger than any class ratio, so seasonality remains the dominant unmodelled error.
- **Property-type contaminated.** Star-class pages include apartments, hostels, guesthouses, motels and
  pensions. Prague's 4-star list contains a hostel and two apartment blocks; San Francisco's 3-star list
  contains two hostels and several motels, which is the likely cause of its anomalous 1.000 ratio.
- **Geography leaks.** Split's 2-star list includes Kaštela, Šolta, Trogir and Omiš.
- **n = 16 cities.** The ratios are usable but thinly evidenced, and no 1-star, hostel-dorm or
  hostel-private relation is fitted at all. Those classes stay missing rather than being asserted.
- **The estimator is biased for levels.** Only the *ratios* are claimed to transfer. The absolute level
  a class page reports is not a defensible city price and must not be published as one.

## What is not solved

Level accuracy still depends on a date-controlled read, which needs a browser and therefore fails the
small-model requirement. The honest current position is a **modelled ladder on an unmodelled level**:
the ladder is validated, the anchor level is not. Closing that requires either browser automation for
the anchor class only, or a calibration of the first-page level bias across more than one city — and
Copenhagen is currently the only full-inventory read in existence.

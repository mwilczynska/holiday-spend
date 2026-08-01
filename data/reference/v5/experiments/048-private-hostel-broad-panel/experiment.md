# Experiment 048 — broad private-hostel property panel

## Hypothesis

The explicit two-adult private-hostel search route promoted by Experiment 047 generalizes to a larger, city-
stratified property panel without source throttling or loss of occupancy/tax evidence.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Twelve cities: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest, Istanbul, Seoul, Sydney, Vancouver,
  Nairobi, and Buenos Aires.
- Exactly two ordered searches per call: Hostelworld then Booking.com.
- No page reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence.

## Pre-registered verdict rules

- Report strict quote coverage and source/region composition; retain every rejected reason.
- Promote to a formal aggregation-design experiment only if at least 6/12 cities pass the strict quote contract.
- Accepted rows remain property-level ground truth. No city average, correction, or product mapping follows this
  panel without a separately declared selection/aggregation rule and 30-city/10-holdout validation.

## Results

The twelve-city panel produced **4/12 strict quotes**: Nairobi, Prague, Seoul, and Sydney. Each city used exactly
two ordered searches (24 total), with no reads, retries, arithmetic, FX conversion, averaging, or cross-city
evidence. The remaining rows failed closed because they were from/members-only, multi-night totals, nearby-city,
capsule-class, unknown-tax, or otherwise ambiguous.

**Verdict:** the pre-registered 6/12 promotion gate failed. Retain the four quotes as property-level ground-truth
candidates, but do not promote to aggregation or map to `accom_hostel_private_room`.

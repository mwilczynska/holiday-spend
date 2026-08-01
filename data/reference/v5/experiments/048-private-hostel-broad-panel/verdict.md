# Experiment 048 verdict — reject broad private-hostel promotion gate

## Decision

The 12-city panel does not pass its pre-registered 6/12 promotion gate. Do not promote the route to aggregation or
map it to `accom_hostel_private_room` yet. Preserve the four accepted quotes as property-level ground-truth
candidates and the rejected reasons as source-feasibility evidence.

## Evidence

- Twelve independent single-city Luna-class contexts: Amsterdam, Prague, Copenhagen, Dublin, Vienna, Budapest,
  Istanbul, Seoul, Sydney, Vancouver, Nairobi, and Buenos Aires.
- Exactly two ordered searches per city (24 total): Hostelworld then Booking.com.
- No page reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence.
- Strict accepted quotes: **4/12** — ZZZ Hostel (Nairobi), Celine Prague Luxury Hostel (Prague), Moonraejung Hostel
  (Seoul), and Maze Backpackers (Sydney).
- The 6/12 gate failed because other rows were from/members-only, multi-night totals, nearby-city, capsule-class,
  unknown-tax, or otherwise ambiguous.

The private-hostel route remains plausible but not production-ready. A new panel or source contract must address
tax/login and one-night quote failures before aggregation and the 30-city/10-holdout accuracy work.

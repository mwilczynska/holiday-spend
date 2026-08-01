# Experiment 047 — accommodation property panel

## Hypothesis

A broader explicit two-adult property panel using Hostelworld/Booking for private hostel rooms and Google
Hotels/Hotels.com for one-star hotels can supply definition-matched ground-truth candidates where city averages
and source-default occupancy failed.

## Protocol

- One independent GPT-5.6 Luna-class context per city; one city only.
- Six cities: Berlin, Rome, Madrid, Paris, Tokyo, and Mexico City.
- Exactly four ordered searches per call: two private-hostel searches and two one-star-property searches.
- No page reads, retries, arithmetic, FX conversion, averaging, or cross-city evidence.

## Pre-registered verdict rules

- Promote a property-panel route only if at least 3/6 cities pass the strict quote contract for that measure.
- Accepted quotes remain property-level ground truth; no city aggregation or product mapping follows this test.
- A city-wide anchor requires an independently declared aggregation rule and the 30-city/10-holdout accuracy gate.

## Results

The six-city panel produced **3/6 strict private-hostel quotes** and **1/6 strict one-star quotes**. Each city
used exactly four ordered searches (24 total), with no reads, retries, arithmetic, FX conversion, averaging, or
cross-city evidence. Berlin, Mexico City, and Tokyo supplied named private-hostel quotes with explicit two-adult
occupancy, one-night pricing, and tax/fee treatment. Only Tokyo supplied a strict one-star quote.

**Verdict:** promote the private-hostel route to a broader property-panel/ground-truth collection; reject the
one-star route for insufficient coverage. Do not aggregate or map either measure to a city-wide product value from
this experiment.

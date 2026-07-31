# Experiment 039 — hostel dorm/private boundary

## Hypothesis

A strict two-search, one-city prompt can retrieve both a definition-compatible central dorm-bed price and a
two-adult private-hostel-room price from free signed-out search results often enough to support a production
anchor or a validated derivation.

## Protocol

- One independent GPT-5.6 Luna-class subagent call per city.
- One city per call; six cities spanning Europe, Asia, Africa, and North America.
- Exactly two targeted searches per call; no page reads, retries, arithmetic, FX, fallback, or cross-city facts.
- Dorm accepts one-adult bed central average only. Private-room accepts explicit two-adult/two-guest basis only.
- `from`, lowest, ranges, ambiguous occupancy, and generic property quotes fail closed.

## Pre-registered verdict rules

- Promote only if at least 4/6 cities have both strict rows and private-room occupancy is explicit.
- If dorm succeeds but private occupancy fails, retain the dorm boundary only and reject private-room source
  coverage as a production anchor.
- No model, ratio, or correction is fitted from this source-feasibility panel.

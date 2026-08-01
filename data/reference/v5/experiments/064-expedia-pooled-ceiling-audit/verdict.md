# Experiment 064 verdict - Expedia evidence ceiling blocks fitting

## Decision

Do not fit or promote an accommodation ratio from the current Expedia evidence. The pooled source ceiling is
insufficient for the pre-registered validation gate, and the one-star/hostel boundary has no eligible observations.
Stop treating more identical Expedia panels as a complete methodology; pivot to a new data boundary for missing
classes while retaining Expedia as a possible 2-/3-/4-star source candidate.

## Evidence

- The deterministic audit pooled Experiments 028, 029, 059, 060, 061, and 063 without arithmetic, averaging, or
  coefficient fitting.
- It found 80 accepted rows across 36 unique cities, all with an explicit two-adult Expedia base-rate trend and
  `taxStatus: excluded`.
- Class coverage was 1-star 0/36 cities, 2-star 23, 3-star 30, and 4-star 27. Sixteen cities had all 2-, 3-, and
  4-star rows.
- Directly paired city counts were 20 for 2-star-from-3-star and 22 for 4-star-from-3-star, both below the required
  30 matched cities plus 10 locked holdouts. Hostel/private and one-star relationships had zero eligible rows.
- No included-tax rows were mixed into the pool; excluded tax remains a separate source basis.

No relationship is fit-eligible. The shipping CSV and asserted constants remain excluded from ground truth. Read
`results.json` for the complete city lists and provenance counts.

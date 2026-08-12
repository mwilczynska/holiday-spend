# Experiment 010 supersession — 12 August 2026

The committed registration, results and verdict remain immutable records of what ran. Their numerical
`0/20` result is superseded as a canary interpretation.

No provider call ran: the CLI process had no application provider credential. This is a credential
preflight failure, not measured source coverage. A later audit found that supplying a key would still not
have made this experiment valid:

- the city-cost provider client made ordinary JSON-completion requests without enabling the web-search
  tools required by all three prompts;
- Expedia arrival and departure were both rendered from the same `referenceDate`, producing a zero-night
  window rather than the registered one-night stay;
- the pass predicate omitted registered call-count and artifact-fraction gates and could treat all-prior
  materialization after blocked sources as source coverage;
- partial failed-city calls and field-by-field provenance equality were not retained or checked.

Do not rerun or mutate this experiment. The replacement sequence is Phase 7A production collection repair,
then a fresh delegated operational canary using the representative city frame and the corrected contract.
A separate small user-key provider smoke remains required before cutover.

# Experiment 024 — single-city accommodation ground-truth panel

Date: 2026-07-31

## Hypothesis

A strict, search-only six-class contract may identify enough definition-compatible city observations from
public class-average sources to design a 30-city/10-holdout accommodation panel.

## Production-shaped test

Each Luna-class invocation researches exactly one city and issues six bounded searches, one per accommodation
measure. The panel is a collection of independent one-city calls, not a multi-city prompt. No direct booking
engine reads, retries, arithmetic, currency conversion, cross-city substitution, or `from` prices are allowed.

## Acceptance rule

Retain only rows with exact city/class/occupancy/nightly identity, source URL, currency, and non-`from`
central price. This experiment measures retrieval feasibility and candidate evidence; it is not ground truth
accuracy. Fit no accommodation relationship unless a separately audited, definition-matched panel contains
at least 30 complete cities and a locked holdout of at least 10 complete cities.

The raw response should include the exact query per measure. If a delegated response omits that field but its
standalone telemetry preserves a one-to-one measure/query record, the audit may join the telemetry and must
record the provenance exception explicitly.

## Planned sample

Three independent cities are tested in this first tranche: Barcelona (Spain), Prague (Czechia), and Nairobi
(Kenya). Further cities will be added only if the source family produces compatible rows without relaxing the
contract.

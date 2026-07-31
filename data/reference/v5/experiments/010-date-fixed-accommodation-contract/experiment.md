# Experiment 010 — date-fixed accommodation contract

Date: 2026-07-31

## Hypothesis

A single GPT-5.6 Luna-class web-retrieval task can extract strict accommodation facts for a fixed 2026-09-15 to 2026-09-16 stay for two adults from Hostelworld/property pages and Booking.com/Hotels.com pages.

The exact contract is `docs/prompts/llm_prompt_city_cost_v5_experiment_010.md`. The five-city pilot covers Lisbon, Copenhagen, Hanoi, Prague, and Nairobi. A fact is accepted only if the result establishes the fixed dates, occupancy, city/property, requested class, currency, price, and permitted source family. Ranges, `from` prices, other dates, packages, promotions, inferred stars, and arithmetic are rejected.

This is a feasibility pilot, not final validation.

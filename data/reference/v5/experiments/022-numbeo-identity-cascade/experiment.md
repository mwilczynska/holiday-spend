# Experiment 022 — bounded Numbeo identity cascade

Date: 2026-07-31

## Hypothesis

Some 018/019 no-results are search-identity misses rather than absent city data. A second, country-qualified
identity query per measure may recover exact Kyoto/Helsinki facts without accepting wrong-city evidence, while
Don Det should remain an explicit sparse failure.

## Pre-registered method

- Prompt: `docs/prompts/llm_prompt_city_cost_v5_experiment_022_identity_cascade.md`.
- One independent GPT-5.6 Luna-class invocation per city: Kyoto, Helsinki, Don Det, Lisbon, Hanoi, and San
  Francisco.
- At most two non-identical searches per measure (canonical slug, then city+country identity query); maximum
  ten searches per city. No direct reads, third query, retries, source fallbacks, arithmetic, FX, or other-city
  evidence.
- A found fact requires exact requested city, exact row, central value, source currency, and canonical URL.

## Acceptance and reporting

Compare cell/city coverage with Experiments 018/019, query counts, source correctness, and incremental recovery
versus extra searches. Do not call a wrong-city or country-average result a recovery. This is source-route
feasibility, not independent price ground truth or 19-tier validation.

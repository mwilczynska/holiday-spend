# Experiment 080 — BudgetYourTrip per-person activity scaling panel

**Status:** Complete - promote deterministic scaling to definition validation

## Question

Can one-city BudgetYourTrip search snippets reliably return the three source-defined entertainment tiers on an explicit
one-person/day basis across a representative 30-city panel, so deterministic factor-of-two scaling can supply the
two-traveller activity fields without fitting a free parameter?

## Hypothesis

The source contract used by Experiments 035/036 will yield at least 28/30 complete cities and 28/30 protocol-compliant
calls. Because each accepted tier is explicitly per person per day, local code can multiply by two exactly; no LLM
arithmetic or fitted scaling coefficient is allowed. The ten named cities are locked holdout for a source/semantic audit.

## Pre-registered protocol

- One independent GPT-5.6 Luna-class context per city.
- Exactly two ordered BudgetYourTrip-restricted searches; no reads, retries, fallback, arithmetic, FX, or cross-city evidence.
- Accept only exact-city Budget/Mid-Range/Luxury entertainment rows with numeric non-`from` USD values and explicit
  one-person/day basis. The auxiliary average is retained but cannot fill a missing tier.
- The 30 cities are split into 20 development, 10 locked holdout. No city-level source tuning after holdout reveal.
- A pass authorizes only deterministic `2 * per_person_per_day` materialization and a separate product-definition review;
  it does not claim that BudgetYourTrip's reported-spend tiers are independently observed attraction tickets.

## Results

All 30 calls were protocol-compliant. Twenty-eight cities supplied all three strict per-person/day tiers (28/30 for
each tier), so the pre-registered source screen passed. The two failures were fail-closed: Fukuoka returned only
nearby/Japan-level results, and Rome's tier rows came from a multi-city itinerary URL and were rejected by the exact-city
analyzer. The locked holdout had 8/10 complete cities, below the final 95% one-call/complete-city gate.

The analyzer materialized the candidate two-traveller values by deterministic multiplication by two; no response
performed arithmetic and no free scaling parameter was fitted. This is a collection/scaling result only. There is
still no independent, definition-matched ground-truth panel proving that BudgetYourTrip reported-spend entertainment
tiers equal the product's ticket, half-day, or full-day activity estimands. Do not present these values as final product
observations until that validation and the activity-definition decision pass.

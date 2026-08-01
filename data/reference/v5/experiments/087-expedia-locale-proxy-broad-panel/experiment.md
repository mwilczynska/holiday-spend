# Experiment 087 — Expedia.com locale-proxy broad 2–4-star panel

**Status:** In progress

## Question

Can the guarded Expedia.com source-locale proxy provide enough exact 2-, 3-, and 4-star city-class rows to reach
the frozen 30-city matched relationship gates, after the 086 source/date screen and official locale audit?

## Hypothesis

The strict Expedia source has broad indexed class coverage, but bare-dollar currency presentation—not missing
class trends—is the dominant extraction loss. Recording bare-dollar values and applying only the versioned exact
`www.expedia.com` → USD deterministic guard will add enough matched cities for 2-star←3-star and 4-star←3-star
coverage without changing occupancy, tax, class, reference-period, or non-`from` requirements.

## Pre-registered protocol

- Twenty-four independent GPT-5.6 Luna-class contexts, one city per context.
- Exactly three ordered Expedia-restricted searches per city, using the 086 exact-heading queries. Search only:
  no page reads, retries, fallback sources, arithmetic, FX conversion, aggregation, or cross-city evidence.
- Preserve bare-dollar exact rows as `found_proxy`, `currency: null`, `currencyStatus: bare_dollar`; never infer
  USD in the Luna response. Deterministic code may map only exact `www.expedia.com` hosts with no locale override,
  carrying `evidenceBasis: source_locale_proxy` and `imputedMeasures: ["currency"]`.
- Reject generic/district/wrong-city/class-ambiguous, `from`/lowest, per-person, event-only, missing basis,
  unknown tax, and blocked rows. A proxy row remains source evidence only; no coefficient or product mapping is
  fitted here.
- The source-coverage gate is 23/24 protocol-compliant calls, at least 20 calls completed, and at least 30 pooled
  matched city relationships for both 2-star←3-star and 4-star←3-star after deterministic de-duplication with prior
  evidence. A pass authorizes only independent explicit-two-adult accuracy validation; it is not a DoD pass.

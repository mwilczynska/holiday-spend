# Experiment 003 Verdict — Derivation Contract Retained

The isolated v5 derivation function materializes all 19 tiers from a complete, post-FX anchor panel and
returns explicit missing cells when an input is unavailable. It preserves source IDs, model versions, and
imputed measures, and it distinguishes direct observations, deterministic baskets, modelled values,
imputations, and the definitional free-activity tier.

**Verdict:** retain as the deterministic derivation boundary. This experiment proves schema and provenance
behaviour only; it does not prove that the anchor sources are accessible to a target cheap model or that
the basket definitions are accurate. Statistical model selection and end-to-end source testing remain open.

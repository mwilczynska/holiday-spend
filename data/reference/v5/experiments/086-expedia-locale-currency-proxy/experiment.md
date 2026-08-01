# Experiment 086 — Expedia.com bare-dollar currency proxy

**Status:** In progress

## Question

Does the fixed `www.expedia.com` source locale provide a sufficiently stable deterministic currency basis for
exact Expedia class-trend rows that display `$` but omit a currency code? Experiment 085 rejected these rows under
the strict named-currency contract; this experiment records them without pretending that the symbol itself is USD.

## Hypothesis

For an exact Expedia.com class-trend result, a numeric non-`from` monthly trend with explicit two-adult basis,
tax treatment, and a fixed `www.expedia.com` URL host will have the same USD basis as the prior named-USD Expedia
rows. A deterministic host/locale guard can therefore create a labelled currency proxy while preserving an
imputed-currency evidence basis.

## Pre-registered protocol

- Twelve independent GPT-5.6 Luna-class contexts, one city per context, using cities with prior strict Expedia
  class rows so a same-city/class source-date audit is possible.
- Exactly three ordered Expedia-restricted searches, one per class, using the exact indexed heading phrase and
  `2 adults` / `taxes and fees` terms from Experiment 085.
- Search only. No page reads, retries, fallback sources, arithmetic, FX conversion, aggregation, or cross-city
  evidence.
- Accept a `found_proxy` row when the exact city/class, numeric non-`from` nightly trend, explicit two-adult
  basis, reference period, and tax treatment are established but the source exposes only a bare `$`. Preserve
  `currency: null`, `currencyStatus: bare_dollar`, and the raw evidence. A named currency remains `found_observed`.
- Do not call a bare `$` USD in the Luna response. The deterministic audit may map it to USD only when the source
  URL host is exactly `www.expedia.com`, no locale override is present, and the row has all other strict fields.
  Mapped rows carry `currencyBasis: source_locale_proxy` and `imputedMeasures: ["currency"]`; they are never
  observed values.
- Compare mapped or named rows to the latest prior named-USD row for the same city/class only as a source/date
  calibration, not independent ground truth. The screen requires at least 10 protocol-compliant calls, 10
  mapped/named rows, 10 same-city/class matches, median APE ≤25%, and p90 APE ≤50%. A screen pass authorizes
  only a broader proxy validation panel; it does not authorize product mapping or model fitting.

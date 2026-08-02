# Experiment 088 — targeted Expedia 2-/3-star URL-pattern panel

**Status:** Complete — reject targeted coverage gate

## Results

All 15 calls were protocol-compliant, but the panel produced only 12 accepted rows and no new paired 2-/3-star
city. After de-duplication with prior Expedia evidence, the pooled set contains 20 matched 2-/3-star cities,
still below the registered threshold of 30. Failures were predominantly generic all-city trend pages, wrong-city
or district pages, and sparse 2-star indexing. Bare-dollar rows remain source-locale proxies with imputed
currency; the audit did not treat them as observed USD.

**Verdict:** reject the targeted Expedia coverage gate. Retain the raw rows as source-access evidence only; do
not fit a 2-star/3-star relationship, map an accommodation product tier, or infer missing classes from this
panel. A subsequent accommodation experiment must use a materially different source/query or a separately
pre-registered semantic calibration, not another repetition of this URL-pattern search.

## Question

Can targeting Expedia's indexed `2Star-...-Hotels.s20` and `3Star-...-Hotels.s30` URL patterns recover the
missing 2-/3-star matched cities that broad heading searches failed to expose?

## Hypothesis and protocol

Fifteen independent one-city GPT-5.6 Luna contexts issue exactly two ordered Expedia-restricted searches per city,
one for 2-star and one for 3-star, with the class URL-pattern token and exact heading phrase. Search only: no page
reads, retries, fallback, arithmetic, FX, aggregation, or cross-city evidence. Exact city/class, numeric non-`from`
nightly trend, explicit two-adult basis, reference period, tax treatment, and exact `www.expedia.com` host remain
required. Bare-dollar rows are `found_proxy` with `currency:null`; the deterministic host guard may label their
currency `source_locale_proxy`/imputed, never observed.

Promotion requires at least 14/15 compliant calls, eight new paired 2-/3-star cities, and pooled 2-star←3-star
coverage of at least 30 after de-duplication with prior evidence. This is source-coverage evidence only; no
coefficient or product mapping is authorized. The 4-star←3-star gap is outside this two-class panel.

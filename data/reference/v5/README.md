# City Cost v5 Evidence Inventory

This directory contains current v5 methodology contracts, experiment artifacts, and validation outputs.
It is separate from the live v1 CSV and the retained v3/v4 evidence. Existing files under
`data/reference/` are not moved or renamed.

## Contracts

| Path | Status | Purpose |
| --- | --- | --- |
| `data-dictionary-v5.md` | **CURRENT** | Frozen estimands, units, bases, and missingness semantics for v5 experiments |
| `validation-manifest-v5.json` | **CURRENT** | City-level development/validation/holdout contract and acceptance gates |

## Experiments

| Path | Status | Purpose |
| --- | --- | --- |
| `experiments/000-baseline-reassessment/` | **COMPLETE — candidate baseline rejected** | Reproducible audit of what v3/v4 evidence can and cannot support |
| `experiments/001-one-call-harness/` | **CURRENT — API telemetry optional** | One-call extractor contract, fixture, and provider telemetry harness |
| `experiments/002-accommodation-ladder/` | **COMPLETE — candidate rejected** | Accommodation ratio and hostel-unit identifiability audit |
| `experiments/003-derivation-contract/` | **COMPLETE — contract retained** | Pure 19-tier derivation and provenance propagation contract |
| `experiments/005-target-model-subagent/` | **COMPLETE — revise and retest** | GPT-5.6 Luna-class prompt-feasibility outputs for difficult cities |
| `experiments/006-source-cascade-retest/` | **COMPLETE — revise and retest** | Explicit source-cascade retest on the same five difficult cities |
| `experiments/007-minimal-anchor-retest/` | **COMPLETE — promote to model-boundary validation** | Nine-anchor prompt feasibility and coverage comparison |
| `experiments/008-omitted-anchor-ground-truth/` | **COMPLETE — broad collection rejected** | Omitted-anchor ground-truth feasibility and basis audit |
| `experiments/009-accommodation-panel-feasibility/` | **COMPLETE — broad accommodation panel rejected** | Narrow six-class accommodation collection feasibility and basis audit |
| `experiments/010-date-fixed-accommodation-contract/` | **COMPLETE — search-index contract rejected** | Date-fixed source-family accommodation feasibility |
| `experiments/011-direct-class-page-templates/` | **COMPLETE — partial promotion** | Direct class-page URL template feasibility; Booking 3/4-star averages promoted for broader audit |
| `experiments/012-single-city-production-shape/` | **COMPLETE — shape promoted, source rejected** | Three independent one-city Copenhagen calls, repeatability, and 4-star basis comparison |
| `experiments/013-interactive-official-quote-extraction/` | **COMPLETE — target web route rejected** | Three one-city Copenhagen calls against known official booking engines |
| `experiments/014-single-city-numbeo-food-drink/` | **COMPLETE — revise URL normalization** | Three one-city Numbeo calls; Lisbon succeeded via canonical case-correct URL |
| `experiments/015-numbeo-canonical-url-retest/` | **COMPLETE — direct page route rejected** | Canonical Copenhagen/Prague Numbeo calls returned 503/429 |
| `experiments/016-numbeo-search-snippet-fallback/` | **COMPLETE — promote to broader validation** | Two one-city search-only calls returned 10/10 food/drink anchors |

The API key is optional for prompt feasibility: the delegated GPT-5.6 Luna-class sub-agent can run the
candidate contract without a provider credential. Provider API telemetry remains separately pending.

Raw model responses, source captures, and generated reports must retain retrieval dates, schema/version
metadata, source URLs, currencies, and evidence basis. Do not store copied page content when a URL and
structured extracted facts are sufficient.

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
| `experiments/000-baseline-reassessment/` | **IN PROGRESS** | Reproducible audit of what v3/v4 evidence can and cannot support |

Raw model responses, source captures, and generated reports must retain retrieval dates, schema/version
metadata, source URLs, currencies, and evidence basis. Do not store copied page content when a URL and
structured extracted facts are sufficient.

# Docs

This folder holds the non-code documentation for Wanderledger.

## Layout

- `ops/` - deployment and operational runbooks
- `product/` - product-facing reference material such as methodology docs
- `prompts/` - tracked LLM prompt templates used by the app
- `dev/` - implementation plans, handoffs, and historical development notes

## Repo Hygiene

- Keep the repo root focused on app code, config, and the main `README.md`.
- Put public documentation under `docs/` instead of adding new root-level markdown files.
- Use `.local/` for personal notes, scratch files, imports, exports, and screenshots you do not want committed.

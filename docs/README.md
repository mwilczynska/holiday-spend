# Docs

Non-code documentation for Holiday Spend.

## Start here

| File | Purpose |
| --- | --- |
| `README.md` (repository root) | Project overview |
| `AGENTS.md` (repository root) | Project memory: what the app is and how it currently works. `CLAUDE.md` imports it |
| `docs/dev/PLAN.md` | Current plan, milestone status, open decisions |
| `docs/dev/LOG.md` | History: shipped features, methods tried and their results |

## Layout

- `product/`: how the app works. `city-cost-methodology.md` is the active city-cost method and is mirrored by the
  `/estimates` page; `transport-estimation.md`, `trip-climate.md` and `city-images.md` cover transport estimates,
  climate averages and city photos
- `prompts/`: runtime LLM prompts and their status register
- `analytics/`: product analytics events, metrics, controls and verification
- `ops/`: deployment and operational runbooks
- `research/`: summary of the city-cost accuracy research and how to continue it
- `dev/handoffs/`: current workstream handoffs
- `images/`: screenshots used by the root README
- `*/archive/`: superseded material kept for provenance. Every file opens with a status banner naming what replaced it

## Repository hygiene

- The repository root holds app code, config, `README.md`, `AGENTS.md` and `CLAUDE.md`. Put other documentation
  under `docs/`.
- Use `.local/` (gitignored) for personal notes, scratch files, imports, exports and screenshots.
- Research tooling and data do not belong on `main`. Retired programmes are kept on tags; see
  `data/reference/README.md`.
- Mark superseded decisions with a date rather than deleting them.

# Development Notes

This folder holds developer-facing planning and historical context that is useful for implementation work but is not part of the app's public product or operations documentation.

For current work, read `/PLAN.md`. For what was tried and what it produced, read `/LOG.md`. For the active
methodology, read `docs/dev/plans/city-cost-methodology-v6-1.md`; resume it from
`docs/dev/handoffs/city-cost-v6.md`.

Structure:

- `plans/` - implementation plans for major workstreams; v6.1 is active and superseded plans are bannered
- `handoffs/` - branch handoff notes; `city-cost-v6.md` is the active cold-start handoff
- `PLAN-initial-spec.md` - the original historical project spec retained for context
- `PLAN-new-methodology.md` - an early v4 draft, **superseded by** `docs/product/methodology-v4.md`

Repo-root docs should stay minimal:

- `README.md` as the main project entry point
- `CLAUDE.md` / `AGENTS.md` as project memory
- `PLAN.md` for current work, `LOG.md` for history
- app/config files only

Current product, ops, and prompt assets live in `docs/product/`, `docs/ops/`, and `docs/prompts/`.

## Refreshing model suggestions

Model pickers use a three-tier discovery pipeline (live provider API -> no-key aggregator fetch -> generated curated snapshot). Tier 3 reads `src/lib/data/curated-models.generated.json`, which is a committed artifact refreshed from OpenRouter and models.dev.

- `npm run models:refresh` regenerates the snapshot and writes it to disk. Run this when provider model names drift and commit the resulting JSON.
- `npm run models:check` exercises the same pipeline in a dry-run without writing, so CI or pre-commit flows can detect stale snapshots.
- The refresh script reuses the same runtime filters that gate live aggregator responses, so the committed snapshot cannot contain ids that would be filtered out at runtime.

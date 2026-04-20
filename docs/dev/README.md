# Development Notes

This folder holds developer-facing planning and historical context that is useful for implementation work but is not part of the app's public product or operations documentation.

Structure:

- `plans/` - tracked implementation plans for major workstreams
- `handoffs/` - branch handoff notes and implementation summaries
- `PLAN-initial-spec.md` - the original historical project spec retained for context

Repo-root docs should stay minimal and public-facing:

- `README.md` as the main project entry point
- `CLAUDE.md` and `AGENTS.md` as project memory
- app/config files only

Current product, ops, and prompt assets live elsewhere:

- `docs/product/`
- `docs/ops/`
- `docs/prompts/`

Documents in `docs/dev/` are intentionally kept out of the repo root to reduce clutter while preserving useful build history and implementation context.

## Refreshing model suggestions

Model pickers use a three-tier discovery pipeline (live provider API -> no-key aggregator fetch -> generated curated snapshot). Tier 3 reads `src/lib/data/curated-models.generated.json`, which is a committed artifact refreshed from OpenRouter and models.dev.

- `npm run models:refresh` regenerates the snapshot and writes it to disk. Run this when provider model names drift and commit the resulting JSON.
- `npm run models:check` exercises the same pipeline in a dry-run without writing, so CI or pre-commit flows can detect stale snapshots.
- The refresh script reuses the same runtime filters that gate live aggregator responses, so the committed snapshot cannot contain ids that would be filtered out at runtime.

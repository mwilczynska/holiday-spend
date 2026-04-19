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

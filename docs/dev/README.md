# Development Notes

Developer-facing planning and history. None of this is product or operations documentation.

| Path | Contents |
| --- | --- |
| `PLAN.md` | Current plan, milestone status and open decisions |
| `LOG.md` | Append-mostly history: what was built, what was tried and what the evidence showed |
| `handoffs/` | Current workstream handoffs: `city-cost-v1-1.md`, `add-cities-europe.md` |
| `feature-qa-2026-10-02.md` | Feature QA pass of 2 October 2026 |
| `archive/` | Superseded plans, handoffs and loop prompts, each with a status banner |

## Refreshing model suggestions

Model pickers use a three-tier discovery pipeline (live provider API, then no-key aggregators, then a generated
curated snapshot). Tier 3 reads `src/lib/data/curated-models.generated.json`, a committed artifact refreshed from
OpenRouter and models.dev.

- `npm run models:refresh` regenerates the snapshot. Run it when provider model names drift and commit the JSON.
- `npm run models:check` runs the same pipeline without writing, so stale snapshots can be detected.
- The refresh reuses the runtime filters applied to live aggregator responses, so the snapshot cannot contain ids
  that would be filtered out at runtime.

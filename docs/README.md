# Docs

This folder holds the non-code documentation for Holiday Spend.

## Start here

The four root-level documents come first:

| File | Purpose |
| --- | --- |
| `README.md` | GitHub-facing project overview |
| `CLAUDE.md` / `AGENTS.md` | Project memory — what the app is and how it currently works |
| `PLAN.md` | Current plan, milestone status, open decisions |
| `LOG.md` | History — shipped features, methodologies tried and their results, dataset inventory |

## Layout

- `dev/plans/city-cost-methodology-v6-1.md` — **the active city cost methodology workstream**
- `product/methodology-v4.md` — prior methodology evidence and design principles
- `prompts/` - tracked LLM prompt templates. `llm_prompt_city_anchors_v4.md` is **generated** from
  `product/methodology-v4.md` §9.1 — never edit it directly
- `ops/` - deployment and operational runbooks
- `dev/plans/`, `dev/handoffs/` - current workstream documents; superseded plans carry a status banner
- `*/archive/` - superseded material, retained for provenance. Every file carries a status banner
  naming what replaced it. Nothing here describes how the project currently works

## Status convention

Every document under an `archive/` folder opens with a `> **SUPERSEDED**` banner giving the date and the
replacement. If you open a file and it has no banner, it is current.

## Repo Hygiene

- Keep the repo root focused on app code, config, and the four documents above.
- Put other documentation under `docs/` instead of adding new root-level markdown files.
- Use `.local/` for personal notes, scratch files, imports, exports, and screenshots you do not want committed.
- Record superseded decisions as superseded — mark and date them rather than deleting, so the reasoning
  that replaced them stays legible.

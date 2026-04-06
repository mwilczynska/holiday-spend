# Wanderledger — Build Progress & Notes

## Project Location
- App code: `wanderledger/` subdirectory
- Spec: `PLAN.md` (root)
- DB: `wanderledger/data/travel.db` (SQLite, gitignored)
- Dev PIN: `1234` (in `.env.local`)

## Tech Stack (as implemented)
- Next.js 14 (App Router) + TypeScript + Tailwind CSS v3 + tailwindcss-animate
- shadcn/ui components (rewrote all to use @radix-ui — see fix notes below)
- Drizzle ORM + better-sqlite3
- Zod v4 (note: uses `.issues` not `.errors` for validation errors)
- Recharts (installed, not yet used)
- SWR (installed, not yet used — pages currently use raw fetch)

## Important Fix Notes

### shadcn/ui v4 → Radix v3 Component Rewrite
- `npx shadcn@latest init` installed shadcn v4 which uses `@base-ui/react` (NOT `@radix-ui`)
- **v4 components are INCOMPATIBLE** with standard Radix-style API (`asChild`, `data-[state=open]`, etc.)
- v4 uses: `render` prop instead of `asChild`, `data-open`/`data-closed` instead of `data-[state=open]`, oklch colors
- **Fix applied:** Rewrote ALL actively-used ui components to use `@radix-ui/react-*` primitives:
  - `button.tsx` — Radix Slot for asChild
  - `card.tsx` — plain HTML with cn()
  - `input.tsx` — plain HTML input
  - `label.tsx` — plain HTML label
  - `badge.tsx` — cva variants, plain div
  - `dialog.tsx` — @radix-ui/react-dialog
  - `select.tsx` — @radix-ui/react-select
  - `switch.tsx` — @radix-ui/react-switch
  - `separator.tsx` — @radix-ui/react-separator
  - `sheet.tsx` — @radix-ui/react-dialog (reused)
  - `command.tsx` — cmdk + our new dialog
- **Still v4 (unused, not imported):** `dropdown-menu.tsx`, `popover.tsx`, `scroll-area.tsx`, `tabs.tsx`, `tooltip.tsx`
  - These will need rewriting when first used in Phase 2+

### CSS/Tailwind
- `globals.css` uses HSL color variables (NOT oklch)
- `tailwind.config.ts` has full shadcn color theme via `hsl(var(--...))` format
- `tailwindcss-animate` plugin installed for animations

### Font Setup
- Next.js 14 doesn't have `Geist` in `next/font/google` — use `localFont` with bundled `GeistVF.woff`

### Zod v4
- Installed version is Zod v4 which uses `.issues` not `.errors` on ZodError

### Database
- Seed script: `npx tsx src/db/seed.ts` — creates tables + seeds 8 countries and 8 cities
- DB already seeded at `wanderledger/data/travel.db`
- Drizzle schema at `src/db/schema.ts` covers ALL tables from PLAN.md §4.1

---

## Phase 1: Core Planning — COMPLETE (build passes, dev server runs)

### 1a. Project Scaffold — DONE
- [x] Next.js 14 + TypeScript + Tailwind + shadcn/ui + Drizzle
- [x] SQLite via better-sqlite3
- [x] Full database schema (all tables from PLAN.md §4.1)
- [x] `.env.example` and `.env.local` (PIN=1234)
- [x] Seed data JSON + seed script (8 countries, 8 cities)
- [x] PIN auth middleware + login page + `/api/auth/login`
- [x] Responsive app shell: DesktopSidebar + MobileNav + root layout
- [x] Types file with all tier types, constants, interfaces

### 1b. City Cost Data — DONE
- [x] Xotelo client, estimation orchestrator (Xotelo-only)
- [x] Exchange rate utility (frankfurter.app + DB caching)
- [x] Cost calculator (tier → daily AUD cost)
- [x] Countries/Cities/Estimate API routes
- [x] City cost editor page (`/settings/cities`)

### 1c. Itinerary Builder — DONE
- [x] Itinerary/Legs/Reorder/Fixed-costs/Rates API routes
- [x] LegCard, TierSelector, CostSummary components
- [x] Plan page (`/plan`) — full builder with add, reorder, real-time totals
- [x] Settings page (`/settings`) — fixed costs manager
- [x] Dashboard (`/`) — summary cards + navigation

### Placeholder Pages — DONE
- [x] `/track`, `/track/add`, `/track/import`, `/track/tags`

---

## Phase 2: Expense Tracking — COMPLETE (build passes)

### 2a. Quick-Add & Expense CRUD — DONE
- [x] Expenses CRUD API routes (GET with filters, POST, PUT, DELETE, PATCH exclude, bulk actions)
- [x] Quick-add page (`/track/add`) — large amount, currency auto-detect from active leg, 6 emoji category buttons, split toggle, logged_by
- [x] Expense list (`/track`) — filters (category, source, date range), checkboxes, bulk exclude/include, edit dialog, delete

### 2b. Tagging System — DONE
- [x] Tags CRUD API routes (GET with counts/sums, POST, PUT, DELETE)
- [x] Expense-tag association (POST add, DELETE remove, GET tag expenses)
- [x] Tag management page (`/track/tags`) — list, detail view, create/edit/delete, color picker

### 2c. Wise CSV Import — DONE
- [x] `src/lib/wise-csv-parser.ts` — auto-categorisation, skip transfers/conversions/top-ups
- [x] CSV import API route — preview mode + confirm import, dedup by wise_txn_id
- [x] Import page (`/track/import`) — upload, preview (importable/skipped/duplicates), category editing, confirm

## Phase 3: Dashboard & Comparison — COMPLETE (build passes)

### Dashboard API Routes — DONE
- [x] `/api/dashboard/summary` — total budget, spent, projected, burn rates (trip/7d/30d), budget health, days elapsed/remaining
- [x] `/api/dashboard/planned-vs-actual` — per-country planned vs actual + category totals
- [x] `/api/dashboard/burn-rate` — cumulative spend data points over time

### Dashboard Page — DONE
- [x] Summary cards: budget, spent, projected total, remaining (with budget health indicator)
- [x] Secondary stats: days elapsed, days left, daily avg, 7-day avg, 30-day avg
- [x] Planned vs Actual stacked bar chart per country (Recharts)
- [x] Category breakdown pie chart (Recharts)
- [x] Cumulative spend line chart with budget ceiling reference line (Recharts)
- [x] Country comparison table with planned/actual/difference/status

### Utility — DONE
- [x] `src/lib/burn-rate.ts` — buildCumulativeSpend, calcBurnRate, projectTotal

## Phase 4: Polish & Deploy — COMPLETE (build passes)

### Docker Deployment — DONE
- [x] Dockerfile (multi-stage: deps → build → production with standalone output)
- [x] docker-compose.yml (app + nginx reverse proxy)
- [x] nginx.conf (HTTP→HTTPS redirect, self-signed TLS)
- [x] .dockerignore
- [x] scripts/backup.sh (daily SQLite backup, 7-day retention)
- [x] scripts/generate-certs.sh (self-signed cert generation)
- [x] next.config.mjs updated with `output: 'standalone'`

### LLM Estimation Engine — DONE
- [x] `src/lib/estimation/llm-provider.ts` — provider interface + async factory (Anthropic > OpenAI)
- [x] `src/lib/estimation/prompt.ts` — structured prompt template for all cost categories
- [x] `src/lib/estimation/providers/anthropic.ts` — Anthropic Claude provider
- [x] `src/lib/estimation/providers/openai.ts` — OpenAI GPT provider
- [x] Updated orchestrator to merge LLM + Xotelo with priority
- [x] Updated CityEstimator with Xotelo Only / LLM Only / Xotelo + LLM buttons
- [x] Updated estimate API route with reasoning, confidence, llmProvider metadata
- [x] Source badges and confidence display in estimation results

### Data Export — DONE
- [x] `/api/export?format=json` — full trip data (all tables)
- [x] `/api/export?format=csv` — expenses as CSV
- [x] Export buttons on settings page

---

## File Structure
```
wanderledger/
├── .env.example, .env.local, drizzle.config.ts
├── seed-data/cities.json
├── data/travel.db (gitignored)
├── src/
│   ├── middleware.ts (PIN auth)
│   ├── types/index.ts
│   ├── db/ (schema.ts, index.ts, seed.ts)
│   ├── lib/ (api-helpers.ts, cost-calculator.ts, exchange-rates.ts, utils.ts)
│   │   └── estimation/ (orchestrator.ts, xotelo-client.ts)
│   ├── app/
│   │   ├── layout.tsx, page.tsx (dashboard), login/page.tsx
│   │   ├── plan/page.tsx (itinerary builder)
│   │   ├── track/ (page.tsx, add/page.tsx, import/page.tsx, tags/page.tsx)
│   │   ├── settings/ (page.tsx, cities/page.tsx)
│   │   └── api/ (auth, cities, countries, itinerary, fixed-costs, rates)
│   └── components/
│       ├── ui/ (Radix-based shadcn components)
│       ├── layout/ (DesktopSidebar.tsx, MobileNav.tsx)
│       ├── itinerary/ (LegCard.tsx, TierSelector.tsx, CostSummary.tsx)
│       └── cities/ (CostEditor.tsx, CityEstimator.tsx)
```

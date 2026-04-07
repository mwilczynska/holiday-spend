# Wanderledger â€” Build Progress & Notes

## Project Location
- App code: `wanderledger/` subdirectory
- Spec: `PLAN.md` (root)
- DB: `wanderledger/data/travel.db` (SQLite, gitignored)
- Dev PIN: `1234` (in `.env.local`)

## Tech Stack (as implemented)
- Next.js 14 (App Router) + TypeScript + Tailwind CSS v3 + tailwindcss-animate
- shadcn/ui components (rewrote all to use @radix-ui â€” see fix notes below)
- Drizzle ORM + better-sqlite3
- Zod v4 (note: uses `.issues` not `.errors` for validation errors)
- Recharts (installed, not yet used)
- SWR (installed, not yet used â€” pages currently use raw fetch)

## Important Fix Notes

### shadcn/ui v4 â†’ Radix v3 Component Rewrite
- `npx shadcn@latest init` installed shadcn v4 which uses `@base-ui/react` (NOT `@radix-ui`)
- **v4 components are INCOMPATIBLE** with standard Radix-style API (`asChild`, `data-[state=open]`, etc.)
- v4 uses: `render` prop instead of `asChild`, `data-open`/`data-closed` instead of `data-[state=open]`, oklch colors
- **Fix applied:** Rewrote ALL actively-used ui components to use `@radix-ui/react-*` primitives:
  - `button.tsx` â€” Radix Slot for asChild
  - `card.tsx` â€” plain HTML with cn()
  - `input.tsx` â€” plain HTML input
  - `label.tsx` â€” plain HTML label
  - `badge.tsx` â€” cva variants, plain div
  - `dialog.tsx` â€” @radix-ui/react-dialog
  - `select.tsx` â€” @radix-ui/react-select
  - `switch.tsx` â€” @radix-ui/react-switch
  - `separator.tsx` â€” @radix-ui/react-separator
  - `sheet.tsx` â€” @radix-ui/react-dialog (reused)
  - `command.tsx` â€” cmdk + our new dialog
- **Still v4 (unused, not imported):** `dropdown-menu.tsx`, `popover.tsx`, `scroll-area.tsx`, `tabs.tsx`, `tooltip.tsx`
  - These will need rewriting when first used in Phase 2+

### CSS/Tailwind
- `globals.css` uses HSL color variables (NOT oklch)
- `tailwind.config.ts` has full shadcn color theme via `hsl(var(--...))` format
- `tailwindcss-animate` plugin installed for animations

### Font Setup
- Next.js 14 doesn't have `Geist` in `next/font/google` â€” use `localFont` with bundled `GeistVF.woff`

### Zod v4
- Installed version is Zod v4 which uses `.issues` not `.errors` on ZodError

### Database
- Seed script: `npx tsx src/db/seed.ts` â€” creates tables + seeds 8 countries and 8 cities
- DB already seeded at `wanderledger/data/travel.db`
- Drizzle schema at src/db/schema.ts covers ALL tables from PLAN.md Â§4.1

### Current Planner Refinements
- Accommodation tiers expanded for planning/UI: shared hostel dorm, private room, then 1-star through 4-star
- Added `accomPrivateRoom` to the city cost model, schema, seed flow, and runtime DB bootstrap backfill
- Tier dropdowns now support richer option descriptions directly inside the menu
- Add-leg nights input now supports direct typing, clearing/retyping, and native number-step scrolling
- Added broad planner UI explanation copy in `src/lib/planner-ui-logic.ts` for later reuse in web/mobile UI
- Trip summary now includes a short explanation of how totals and monthly burn are derived
- Xotelo and LLM estimation inputs updated to support the new private-room tier

### Verification Status
- `npx tsc --noEmit` - passes
- `npm run build` - passes
- Build still reports the existing Next.js dynamic server usage note for `/api/export` because that route uses `request.url`, but the production build completes successfully

### Current Import / Dashboard Fixes
- Wise CSV import now consolidates repeated rows that share the same Wise transaction ID before insert
- Wise CSV import now assigns itinerary legs by transaction date during import
- Existing imported expenses are also resolved by date in dashboard comparisons when needed
- Dashboard actual-spend calculations now ignore raw non-AUD amounts if AUD conversion is missing, instead of treating local currency as AUD
- Dashboard spend is now limited to the actual trip window instead of all historical Wise account activity
- Added itinerary date validation so a leg cannot be saved with `endDate < startDate`
- Local data cleanup applied: `mui-ne` date range corrected so 2026-02-16 to 2026-02-18 Vietnam expenses no longer fall into `Unassigned`

---

## Phase 1: Core Planning â€” COMPLETE (build passes, dev server runs)

### 1a. Project Scaffold â€” DONE
- [x] Next.js 14 + TypeScript + Tailwind + shadcn/ui + Drizzle
- [x] SQLite via better-sqlite3
- [x] Full database schema (all tables from PLAN.md Â§4.1)
- [x] `.env.example` and `.env.local` (PIN=1234)
- [x] Seed data JSON + seed script (8 countries, 8 cities)
- [x] PIN auth middleware + login page + `/api/auth/login`
- [x] Responsive app shell: DesktopSidebar + MobileNav + root layout
- [x] Types file with all tier types, constants, interfaces

### 1b. City Cost Data â€” DONE
- [x] Xotelo client, estimation orchestrator (Xotelo-only)
- [x] Exchange rate utility (frankfurter.app + DB caching)
- [x] Cost calculator (tier â†’ daily AUD cost)
- [x] Countries/Cities/Estimate API routes
- [x] City cost editor page (`/settings/cities`)

### 1c. Itinerary Builder â€” DONE
- [x] Itinerary/Legs/Reorder/Fixed-costs/Rates API routes
- [x] LegCard, TierSelector, CostSummary components
- [x] Plan page (`/plan`) â€” full builder with add, reorder, real-time totals
- [x] Settings page (`/settings`) â€” fixed costs manager
- [x] Dashboard (`/`) â€” summary cards + navigation

### Placeholder Pages â€” DONE
- [x] `/track`, `/track/add`, `/track/import`, `/track/tags`

---

## Phase 2: Expense Tracking â€” COMPLETE (build passes)

### 2a. Quick-Add & Expense CRUD â€” DONE
- [x] Expenses CRUD API routes (GET with filters, POST, PUT, DELETE, PATCH exclude, bulk actions)
- [x] Quick-add page (`/track/add`) â€” large amount, currency auto-detect from active leg, 6 emoji category buttons, split toggle, logged_by
- [x] Expense list (`/track`) â€” filters (category, source, date range), checkboxes, bulk exclude/include, edit dialog, delete
- [x] Expense table refresh (`/track`) â€” desktop table with persistent horizontal scroll when needed, mobile card layout, city/country columns from itinerary assignment, and editable leg reassignment for flights, tickets, and other pre-paid items

### 2b. Tagging System â€” DONE
- [x] Tags CRUD API routes (GET with counts/sums, POST, PUT, DELETE)
- [x] Expense-tag association (POST add, DELETE remove, GET tag expenses)
- [x] Tag management page (`/track/tags`) â€” list, detail view, create/edit/delete, color picker

### 2c. Wise CSV Import â€” DONE
- [x] `src/lib/wise-csv-parser.ts` â€” auto-categorisation, skip transfers/conversions/top-ups
- [x] CSV import API route â€” preview mode + confirm import, dedup by wise_txn_id
- [x] Import page (`/track/import`) â€” upload, preview (importable/skipped/duplicates), category editing, confirm

## Phase 3: Dashboard & Comparison â€” COMPLETE (build passes)

### Dashboard API Routes â€” DONE
- [x] `/api/dashboard/summary` â€” total budget, spent, projected, burn rates (trip/7d/30d), budget health, days elapsed/remaining
- [x] `/api/dashboard/planned-vs-actual` â€” per-country planned vs actual + category totals
- [x] `/api/dashboard/burn-rate` â€” cumulative spend data points over time

### Dashboard Page â€” DONE
- [x] Summary cards: budget, spent, projected total, remaining (with budget health indicator)
- [x] Secondary stats: days elapsed, days left, daily avg, 7-day avg, 30-day avg
- [x] Planned vs Actual stacked bar chart per country (Recharts)
- [x] Category breakdown pie chart (Recharts)
- [x] Cumulative spend line chart with budget ceiling reference line (Recharts)
- [x] Country comparison table with planned/actual/difference/status

### Utility â€” DONE
- [x] `src/lib/burn-rate.ts` â€” buildCumulativeSpend, calcBurnRate, projectTotal

## Phase 4: Polish & Deploy â€” COMPLETE (build passes)

### Docker Deployment â€” DONE
- [x] Dockerfile (multi-stage: deps â†’ build â†’ production with standalone output)
- [x] docker-compose.yml (app + nginx reverse proxy)
- [x] nginx.conf (HTTPâ†’HTTPS redirect, self-signed TLS)
- [x] .dockerignore
- [x] scripts/backup.sh (daily SQLite backup, 7-day retention)
- [x] scripts/generate-certs.sh (self-signed cert generation)
- [x] next.config.mjs updated with `output: 'standalone'`

### LLM Estimation Engine â€” DONE
- [x] `src/lib/estimation/llm-provider.ts` â€” provider interface + async factory (Anthropic > OpenAI)
- [x] `src/lib/estimation/prompt.ts` â€” structured prompt template for all cost categories
- [x] `src/lib/estimation/providers/anthropic.ts` â€” Anthropic Claude provider
- [x] `src/lib/estimation/providers/openai.ts` â€” OpenAI GPT provider
- [x] Updated orchestrator to merge LLM + Xotelo with priority
- [x] Updated CityEstimator with Xotelo Only / LLM Only / Xotelo + LLM buttons
- [x] Updated estimate API route with reasoning, confidence, llmProvider metadata
- [x] Source badges and confidence display in estimation results

### Data Export â€” DONE
- [x] `/api/export?format=json` â€” full trip data (all tables)
- [x] `/api/export?format=csv` â€” expenses as CSV
- [x] Export buttons on settings page

---

## File Structure
```
wanderledger/
â”œâ”€â”€ .env.example, .env.local, drizzle.config.ts
â”œâ”€â”€ seed-data/cities.json
â”œâ”€â”€ data/travel.db (gitignored)
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ middleware.ts (PIN auth)
â”‚   â”œâ”€â”€ types/index.ts
â”‚   â”œâ”€â”€ db/ (schema.ts, index.ts, seed.ts)
â”‚   â”œâ”€â”€ lib/ (api-helpers.ts, cost-calculator.ts, exchange-rates.ts, utils.ts)
â”‚   â”‚   â””â”€â”€ estimation/ (orchestrator.ts, xotelo-client.ts)
â”‚   â”œâ”€â”€ app/
â”‚   â”‚   â”œâ”€â”€ layout.tsx, page.tsx (dashboard), login/page.tsx
â”‚   â”‚   â”œâ”€â”€ plan/page.tsx (itinerary builder)
â”‚   â”‚   â”œâ”€â”€ track/ (page.tsx, add/page.tsx, import/page.tsx, tags/page.tsx)
â”‚   â”‚   â”œâ”€â”€ settings/ (page.tsx, cities/page.tsx)
â”‚   â”‚   â””â”€â”€ api/ (auth, cities, countries, itinerary, fixed-costs, rates)
â”‚   â””â”€â”€ components/
â”‚       â”œâ”€â”€ ui/ (Radix-based shadcn components)
â”‚       â”œâ”€â”€ layout/ (DesktopSidebar.tsx, MobileNav.tsx)
â”‚       â”œâ”€â”€ itinerary/ (LegCard.tsx, TierSelector.tsx, CostSummary.tsx)
â”‚       â””â”€â”€ cities/ (CostEditor.tsx, CityEstimator.tsx)
```

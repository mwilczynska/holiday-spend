# Wanderledger

Wanderledger is a private travel budget and spend-tracking app for long multi-city trips.

It combines itinerary planning, city-by-city budget modelling, actual expense tracking, planned-vs-actual reporting, and LLM-assisted city cost generation for places that are not yet in the library.

## What It Does

- Build trips leg by leg in `/plan`
- Track real spend manually or by importing Wise CSV exports in `/track`
- Compare planned vs actual spend across the whole trip and by country on `/`
- Manage the city cost library and generate new city costs in `/settings/cities`
- Review the city-cost methodology, dataset, and generation history in `/estimates`

## Current Product Model

- Base city costs are stored in AUD for 2 travellers
- Planner and dashboard totals scale those stored values to the selected traveller count at runtime
- Intercity transport is manual by default, with optional LLM-backed estimation in the planner
- City cost generation and transport estimation are separate flows

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Radix-style UI primitives / shadcn components
- SQLite via `better-sqlite3`
- Drizzle ORM
- Zod
- Recharts

## Local Development

1. Copy `.env.example` to `.env.local`.
2. Set `APP_SECRET`. The local dev PIN in the current project memory is `1234`.
3. Install dependencies:

```bash
npm ci
```

4. Seed the local SQLite database:

```bash
npm run db:seed
```

5. Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run dev
npm run build
npx tsc --noEmit
npm run test:e2e
npm run db:seed
```

## Project Structure

- `src/app` - routes and API handlers
- `src/components` - planner, dashboard, city library, and UI components
- `src/lib` - calculators, import logic, LLM clients, planner helpers
- `src/db` - schema, runtime bootstrap, and seed script
- `data/travel.db` - local SQLite database
- `sample-data/` - local CSV samples for import testing

## Deployment

Deployment instructions live in [DEPLOYMENT.md](./DEPLOYMENT.md).

The short version is:
- run the app in Docker
- persist `./data`
- keep the app bound to localhost on the VPS
- terminate real TLS with a proper reverse proxy in front

## Current Gaps

The active backlog lives in `AGENTS.md` / `CLAUDE.md`. Current priorities are:

- deployment / production readiness
- real auth for future multi-user use
- DB-backed saved plans and plan comparison
- dashboard simplification

## Notes

- The repo still includes a temporary shared-secret gate for private use today
- OAuth and user-owned data are planned next-step foundation work for a future 2+ user-facing deployment

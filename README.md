# Wanderledger

Wanderledger is a private travel budget and spend-tracking app for long multi-city trips.

It combines itinerary planning, city-by-city budget modelling, actual expense tracking, planned-vs-actual reporting, and LLM-assisted city cost generation for places that are not yet in the library.

## What It Does

- Build trips leg by leg in `/plan`
- Track real spend manually or by importing Wise CSV exports in `/track`
- Compare planned vs actual spend across the whole trip and by country on `/`
- Manage the city cost library, dataset, and generation history in `/dataset`
- Review the city-cost methodology in `/estimates`

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
2. Set `NEXTAUTH_SECRET`.
3. For local development, either:
   - set `AUTH_DEV_PIN` for the built-in dev-only credentials login, or
   - set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for Google OAuth.
4. To test native email/password auth locally:
   - set `ENABLE_EMAIL_PASSWORD=true`
   - optionally set `APP_URL=http://localhost:3000`
   - add `RESEND_API_KEY` and `MAIL_FROM` for real email delivery, or leave them unset to log verification/reset links to the server console in development
5. Install dependencies:

```bash
npm ci
```

6. Seed the local SQLite database:

```bash
npm run db:seed
```

7. Start the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful Commands

```bash
npm run dev
npm run build
npx tsc --noEmit
npm test
npm run country-metadata:generate
npm run test:e2e
npm run db:seed
```

## Canonical Country Metadata

Country currency/region metadata is repo-owned and generated, not inferred from LLM output or typed manually in the UI.

- generated dataset: `src/lib/data/country-metadata.generated.json`
- app-specific overrides: `src/lib/data/country-metadata.overrides.json`
- generation command: `npm run country-metadata:generate`

Country rows are now auto-created from this canonical dataset during dataset city creation, planner new-city creation, and snapshot-import missing-city resolution.

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

- The app now uses real session auth with Google OAuth support and a dev-only local PIN fallback
- Native email/password auth now supports signup, verification, forgot-password, and reset flows
- User-owned trip data is now scoped per authenticated user, and saved plans are now database-backed

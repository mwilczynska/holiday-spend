# Scripts

Run `.ts` files with `npx tsx scripts/<file>` and `.mjs` files with `node scripts/<file>` unless an npm script is listed.

## Running the app

| npm script | File | Purpose |
| --- | --- | --- |
| `dev` (`predev`) | `start-next-dev.mjs`, `prepare-next-dev.mjs` | Development server with host-trusting auth; clears a dehydrated `.next-dev` cache |
| `start` (`prebuild`) | `start-next-production.mjs`, `prepare-next-build.mjs` | Production server; fails a build that a running server would block |
| `auth:set-local-password` | `set-local-password.ts` | Email/password login for a local user, prompted rather than passed as an argument |

## City library

| npm script | File | Purpose |
| --- | --- | --- |
| `methodology:v1.1:check` | `check-city-cost-v1-1.ts` | Formula, FX, correction-table and live-CSV integrity checks for v1.1 and v1.2 |
| — | `add-cities-from-agent-responses.ts` | Batch-add cities through the app's own generation path with answers supplied from file |
| — | `recorrect-city-costs.ts` | Re-apply the v1.2 correction table to stored raw anchors, no model call |
| — | `refresh-city-cost-fx.ts` | Recompute AUD costs at the latest ECB USD/AUD rate, no model call |
| — | `collect-city-images.ts` | Collect or refresh Wikimedia Commons photos for every city |
| — | `check-city-image-lookup.ts`, `city-image-probe.mjs`, `diff-city-image-picks.ts` | Read-only checks of the photo lookup |
| `country-metadata:generate` | `generate-country-metadata.mjs` | Regenerate canonical country metadata |
| `models:refresh`, `models:check` | `refresh-curated-models.ts` | Refresh or check the curated LLM model snapshot |

## Analytics

| npm script | File | Purpose |
| --- | --- | --- |
| `analytics:check` | `check-analytics-coverage.mjs` | Every product route and action is instrumented |
| `analytics:benchmark` | `benchmark-analytics.ts` | Report-read timings on a bulk-prepared database |
| `analytics:upgrade-check` | `check-analytics-upgrade.ts` | Rehearses the analytics upgrade on a restored copy of a full snapshot |
| — | `instrument-analytics.mjs` | One-time source annotation; never rewrites existing identifiers |
| — | `lib/analytics-query-worker.mjs` | Read-only worker thread for reports and exports |

## Performance

| npm script | File | Purpose |
| --- | --- | --- |
| `performance:check` | `check-webapp-performance.mjs` | Authenticated HTTP timings and HTML size limits |
| `performance:browser` | `check-browser-performance.mjs` | Playwright content-readiness and dialog timings |

## Deployment and backups

| npm script | File | Purpose |
| --- | --- | --- |
| `data:snapshot`, `data:verify` | `data-snapshot.ts`, `lib/data-snapshot.mjs` | Verified full or catalogue-only database and photo packages |
| — | `backup.mjs`, `backup.sh` | Consistent backups and restore into a new directory; `backup.sh` runs on the deployment host |
| — | `container-entrypoint.mjs`, `check-container.mjs` | Container startup checks and the Linux Docker smoke test |
| — | `check-email-delivery.mjs` | Sends a test email through the configured mail settings to an `AUTH_ADMIN_EMAILS` address |
| — | `generate-certs.sh` | Self-signed TLS certificates for development (`nginx/certs/`, gitignored) |
| — | `lib/production-config.mjs`, `lib/runtime-prompts.mjs`, `lib/security-headers.mjs` | Shared startup configuration, runtime prompt list and response headers |

Retired research tooling (the v1 audit and the v3 and v4 programmes) is on tag
`city-cost-v3-v4-research-final-2026-10-21`.

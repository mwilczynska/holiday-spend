# Product analytics

Holiday Spend collects first-party analytics on its own server. Collection is enabled by default and there is no
automatic retention expiry. Signed-in users can disable behavioral collection in Settings; signed-out users have
the same control below the authentication forms. Private plan revisions and necessary server diagnostics continue.
The public description is `/privacy`. Public registration remains a separate launch decision.

## Stores and delivery

`travel.db` contains `analytics_preferences`, a durable `analytics_outbox`, `plan_revisions` and erasure markers.
`analytics.db` beside it contains product events, daily counts, session/account bindings and LLM attempts. Override
the latter location with `HOLIDAY_SPEND_ANALYTICS_DB_PATH` only when the alternative is also persistent and backed up.

The Node startup hook establishes labelled baselines for existing accounts and saved plans, marks provider attempts
from an earlier process interrupted, and starts one delivery timer per process. The worker flushes 250 queued events
every five seconds. The destination transaction commits before the outbox acknowledgement, so replay cannot duplicate
events or daily counters. Pending events survive worker failure and process restart. Reporting uses the separate
database; planner history uses the same transaction as the corresponding mutation.

Browser collection flushes at five seconds or 20 events, with a best-effort page-hide flush. Requests contain at most
50 events/64 KiB; the browser queue is bounded at 200. A closed browser, unavailable JavaScript, an ad blocker, or an
overflow can lose interactions. Server write outcomes and private history remain authoritative. A user changing a
currency is distinct from the server confirming it. A successful server write with an unreadable acknowledgement is
not reclassified as a failed save.

Signed-out sessions use random first-party, per-tab identifiers with a 30-minute inactivity timeout. They contain
neither IP identity nor a fingerprint. Successful authentication can associate that anonymous session with a hashed
account ID. Logout clears the browser session; server-side account identity always comes from authentication.
Event IDs deduplicate delivery, while request/operation IDs correlate activity; none is an authorization credential.

## Event dictionary

All events have an ID, schema version, occurrence/receipt UTC timestamps, purpose, source, environment, release,
normalized route, account/session/page/operation/request IDs when available, device category and explicit properties.
Device category (`src/lib/analytics/device.ts`) uses `Sec-CH-UA-Mobile` when a Chromium browser sends it and otherwise
the user agent, because Safari and Firefox never send the hint; iPadOS reports a desktop user agent and counts as desktop.
Unknown event fields and property fields are rejected. Browser events cannot claim server event names or account IDs.
Dynamic paths and URL queries never become page-view properties.

| Event | Origin | Properties and meaning |
| --- | --- | --- |
| `page_viewed` | Browser | One normalized route view per navigation |
| `control_activated` | Browser | Source-defined control ID and mobile/desktop surface; keyboard and pointer activation share the same path |
| `selection_changed` | Browser | Control ID and an optional allowlisted tier, currency, provider, effort or traveller value |
| `workflow_step` | Browser/server | Named workflow/step, optional outcome and count; includes confirmed import preview, authentication and generation request stages |
| `currency_change_requested` | Browser | Previous and requested currency; a draft, not confirmation |
| `currency_change_confirmed` | Browser | Currency acknowledged by the client |
| `currency_change_succeeded` | Server | Previous/saved currency and dated FX observation |
| `mutation_committed` | Server | Controlled action, optional revision ID and canonical summary; no plan name or expense description |
| `request_completed` | Server | Route/method, HTTP status, duration and outcome; all instrumented API outcomes, including failures |
| `browser_error` | Browser | Error/rejection kind and locally calculated fingerprint; no message/stack |
| `server_error` | Server | Render/request phase and fingerprint from safe error identity; no body or raw error text |
| `web_vital` | Browser | LCP, INP, TTFB in milliseconds; CLS as a unitless score |
| `admin_accessed` | Server | Report, private revision, export or erasure access |

Source annotations live on controls as `data-analytics`. `scripts/instrument-analytics.mjs` is a one-time annotation
tool for new controls; it preserves existing IDs. Review IDs before committing. The inventory tool/check records
their source locations. New controls should declare meaningful stable IDs directly rather than deriving IDs from
user-provided text, DOM contents or translated labels.

Coverage includes navigation; account flows; planner legs/dates/tiers/status/order/transports/overrides/miscellaneous
costs; snapshots/import/export/comparison; display currencies; expense editing, tagging, filters and bulk actions;
Wise previews/confirmation; dataset generation/provenance/FX; provider settings; climate controls and retry actions.
Typing, search terms, file contents, chart hovering, arbitrary form text and screen recording are excluded.

## Private plan history

Each committed planner mutation creates an immutable revision of the complete resulting plan. History freezes
itinerary fields, notes, transport/miscellaneous costs, relevant account preferences, city costs, last cached display
FX observation, canonical AUD totals and a calculation-version label. Saved-plan renames are captured, deleted plans
retain their final state, and city-price updates create explicitly labelled dependent revisions. No past state is
invented: migration baselines start when this feature is installed. History is browse/diff/export only; restoration
is outside this release.

Original source missing values remain in the frozen inputs. Historical summary arithmetic follows the app's existing
AUD budget calculator; a cached display-FX observation is labelled as cached, not as evidence the user viewed it.
Future calculation changes must use a new `calculationVersion`; never rewrite prior revision totals or inputs.

## LLM metadata

There is one row per actual provider request, associated with its parent operation and request. It records provider,
requested model, effective effort where supplied, prompt hash, token/time limits, timestamps, duration, HTTP status,
provider request ID, reported usage, search evidence, completion status and attempt/retry ordering. Failed, incomplete,
cancelled and interrupted attempts remain visible. Cross-reference the operation's request outcome to establish
whether validation and persistence succeeded.

Missing usage stays null. OpenAI reasoning tokens are part of its output count and must not be added again. Gemini
candidate output and thinking counts are displayed separately. Search counts are provider-reported or derived from
explicit tool evidence. No pricing table is bundled, so cost is unavailable rather than guessed. The app uses users'
provider keys; token usage is not an application invoice. Prompts, outputs, keys and HTTP bodies are never copied to
analytics. Existing city estimate provenance remains the place for generated cost outputs.

## Reporting definitions

The dashboard keeps every filter and the open tab in the URL, so a reload or shared link reopens the same report.
Events are stored under the pseudonymous account ID. Each admin report response also carries an ID-to-email
directory (`src/lib/analytics/accounts.ts`), so tables show account emails, label the viewer's own account "You",
and the Account filter is a list of emails. Deleted or erased accounts no longer resolve and show a short ID.

`/admin/analytics` requires a valid account and analytics-admin permission on every page/API/export read. Set
`AUTH_ANALYTICS_ADMIN_EMAILS` for a separate role, otherwise the existing `AUTH_ADMIN_EMAILS` role applies. Ordinary
users cannot open other users' history. Full revision inspection and export produce audit events.

- Active accounts: distinct account IDs with behavioral activity in the selected window. Sessions are observed tab
  sessions; signed-out and signed-in activity can be linked only when an observed session supports it.
- Activation: first confirmed leg creation or manual expense creation. Day-1/7/30 retention uses a distinct subsequent
  UTC activity date. Only accounts old enough to have completed the return day enter that day's denominator.
- Funnels: ordered, distinct-user stages in a seven-day window. Planning is plan view → leg created → plan saved;
  Wise import is preview → confirmed import; city generation is request → successful generation endpoint response.
- Failures: unsuccessful HTTP outcomes are shown separately from cancellations and successful writes. LLM provider
  receipt alone does not imply a valid or saved estimate. Latency percentiles use completed measured durations.
- Daily buckets use UTC; timestamps render in the viewer's browser timezone. Browser occurrence time is observational;
  receipt time and revision sequence order server activity. The API excludes administrators by default; the
  dashboard includes them by default, because on this owner-run deployment they are most of the use. Other
  environments are excluded. Empty results and failed reads are distinct; prior results are labelled stale on refresh failure.
- Private revisions are operational history: environment/device/release filters do not apply to them. The account and
  date filters still apply. LLM attempts do not have device categories. These limitations are labelled in responses.

Date ranges are bounded to 366 days; raw timelines/history/attempts use 100-row cursor pages, newest first.
Web Vitals are summarised at the 75th percentile and rated against Google's good/poor thresholds. Aggregates are retained
alongside raw events. Exact daily counts and separate session membership are updated transactionally by SQLite
triggers on insertion, account association and erasure; summary upgrades rebuild from retained events. Overview
and retention use these summaries; operation filters use raw events. Funnels use an indexed generated identity.
Opt-outs, blockers and missing browser observations affect denominators; analytics must not be
used as a billing ledger or a security audit of all possible actions.

Reporting SQL and export reads run in a read-only worker thread so large reports do not block product requests.
The reader accepts at most 16 pending queries and stops after 15 seconds; narrower filters and Retry remain
available. Production packaging includes the worker script. These bounds protect responsiveness; they do not
establish a response-time guarantee on the deployment host.

Journeys offers background JSON Lines exports of all matching product/diagnostic events, beyond the current page.
The export fixes an upper sequence at request time, persists its query and progress, and resumes bounded chunks in
the worker. Downloads require the requesting administrator's current authorization. Exports have no scheduled
expiry; account erasure invalidates existing export jobs/chunks so they cannot retain erased events.

## Deployment and operations

1. `HOLIDAY_SPEND_RELEASE` is built into the image as `sha-<commit>` by Production checks; do not set it in the env
   file, which would override it. Set `HOLIDAY_SPEND_ANALYTICS_ENV=production`.
2. Restore the full existing database/photo package, then deploy normally. Do not seed as a migration. Startup adds
   analytics tables and labelled history baselines without replacing personal data or the city library.
3. Keep `analytics.db` on the same protected persistent volume as `travel.db`. No external analytics domain, CSP
   exception, provider key, extra container or paid service is required.
4. Open the admin dashboard as the owner, include administrator activity, create/edit a test leg, switch currency and
   inspect the linked revision/operation. Check opt-out across reload and another tab. Use a non-admin account to
   confirm reports and private exports are refused. Remove only the deliberately created test records afterwards.
5. Full backup/restore includes a verified `analytics.db` when present. Catalogue packages omit it and empty every
   private table, including history/outbox/preferences. Primary and analytics backups have separate SQLite snapshot
   instants; replay of a restored primary outbox is safe against already-delivered event IDs.
6. Monitor Health: five-minute pending delivery is delayed; disk use at 80% warns and 90% is critical. Unknown disk
   capacity is displayed unavailable. Interrupted attempts, collector errors and API/browser error groups are visible.
   Expand storage or stop optional collection during an incident; never silently expire history to reclaim space.
7. Indefinite retention still permits deliberate erasure. The protected admin DELETE endpoint accepts a pseudonymous
   account ID and erases its events, LLM records and private revisions, rebuilds affected aggregates, and leaves a
   durable replay-prevention marker. It does not delete the user's current app data or turn off future collection.
   Keep deletion-request identifiers separately from backups and reapply requests after restoring an older backup.
8. Review the published collection notice and the chosen default-on policy for the public audience before launch.

Analytics delivery is best effort during storage incidents and retries without misreporting successful product
actions. Private history is stronger: a failed revision write rolls back its associated mutation. Before rollback,
take a full verified backup. Previous app builds ignore the new tables; do not drop them when rolling code back.

## Verification

`npx vitest run src/lib/analytics` covers contracts, impersonation/admin boundaries, opt-out, duplicate delivery,
recovery, erasure replay, historical prices, renames/deletions, funnels/retention and all provider projections.
`tests/playwright/analytics.spec.ts` covers the owner UI, persisted opt-out, continued revisions and mobile reports.
`npx tsx scripts/benchmark-analytics.ts 1000000` creates throwaway fixtures, checks reporting and 66-leg mutation
overhead, and writes `.local/analytics-performance.json`. Workstation results do not establish performance on the VPS.
`node scripts/check-analytics-coverage.mjs` verifies API/control coverage and the generated source inventory; use
`--write` after deliberately changing controls. Health probes and analytics/admin internals are intentionally excluded.
Run the project baseline and Linux production checks before deployment, including an independent restored backup.

The 20 October 2026 optimized Windows million-event run takes 1,352 ms for Overview, 4 ms for Journeys,
1,615 ms for Funnels (including retention), 4 ms for LLM and 293 ms for Health. History adds 12.80 ms p95 for
a 66-leg plan. A 250-event insertion transaction with the production indexes/triggers takes 683.64 ms.
These are synthetic workstation measurements, not deployment-host guarantees.

The same mixed one-million-event fixture on Linux takes 519 ms for Overview, 2 ms for Journeys, 540 ms for
Funnels/retention, 3 ms for LLM and 102 ms for Health. History adds 8.35 ms p95; the 250-event insert takes
149.74 ms. Fast fixture preparation takes 44,298 ms. This is local WSL, not the deployment VPS.

Reproduce the report fixture with `npm run analytics:benchmark -- 1000000 --mixed --fast-fixture --profile`.
The fast mode bulk-loads events, then recreates the exact production indexes and summaries before timing reads.
Its 124,539 ms preparation time is not an ingestion benchmark. Omit `--fast-fixture` to measure production inserts;
`--keep-fixture` retains the disposable database for investigation. Query plans are recorded in the JSON artifact.
The browser source gzip figure remains a lower-bound proxy, not shipped bundle size.

`npm run analytics:upgrade-check -- --source <verified-full-snapshot> --destination <new-private-directory>`
restores a copy, runs real startup twice, verifies all pre-existing business table hashes, inserts a synthetic event
into only the copied analytics store, and checks full backup/restore of both databases including summaries.
It refuses an existing destination and never migrates the source. Treat the rehearsal directory as private data.
The deployed full package dated 20 October 2026 (21:42:05 UTC) passes this check on Linux: 531 cities, two users,
70 legs, 80 saved plans and 82 labelled history baselines. The source package remains unchanged.

Final Linux verification passes 99 files / 607 unit tests, TypeScript, the memory/methodology/coverage guards
and a zero-vulnerability production dependency audit. Both runner and seed images build; the production
container verifies native modules, prompts/assets, sign-in, all analytics views, guest denial, session revocation,
full backup/restore and restart. The build-worker migration race is fixed and covered by six concurrent workers.

Analytics is merged to main after integrating committed main through 88399203. The owner authorizes publication
and feature-branch cleanup. Linux/container
verification evidence is recorded in docs/dev/PLAN.md and docs/dev/LOG.md. Measure the deployment host after rollout; no live
production data or deployment has been changed by these checks.

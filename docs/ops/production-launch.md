# Production launch

Holiday Spend runs as one Next.js container with persistent SQLite databases (`travel.db`, `analytics.db`) and a
city-photo directory. A separate infrastructure repository owns public DNS, TLS, the shared reverse proxy and
scheduled backups. Public app origin: `https://spend.projectinfinitesummer.com`.

## What must be preserved

A working library contains every city added after the original 121-city CSV, with their estimates, climate records
and photos. Deploy a verified database/photo snapshot. **Do not run the CSV seed to migrate a library.** Seeding
refuses a nonempty library, and an empty seed contains only the original CSV cities.

A full deployment copy preserves the owner's user ID and personal records. It changes the owner's email only in the
copy, replaces the copied local password with an unknown random password, marks the email unverified, and revokes
copied authentication tokens, OAuth accounts and sessions. Other local fixture credentials are removed; their data is
retained. The original local database is unchanged.

Private data packages stay outside Git and the Docker build context. The city catalogue can be exported separately
with no users, trips or expenses.

## Prepare and verify data locally

Use Node 24 and the locked dependencies. Pause city-photo refresh while taking a snapshot. Other writes may continue;
SQLite's backup API produces a consistent database. If a photo or its metadata changes during copying, the snapshot
fails and must be retried into a new directory.

The Linux checks use npm 11.19.0. When refreshing the lockfile on an older npm, use
`npx --yes npm@11.19.0 install --package-lock-only --ignore-scripts`; npm 11.6.2 omitted an optional Sharp/WASM
runtime entry that Linux clean installs require.

```powershell
npm run data:snapshot -- --destination .local/deployment/backup --mode full
npm run data:snapshot -- --destination .local/deployment/production --mode full --owner-email YOUR_EMAIL
npm run data:snapshot -- --destination .local/deployment/catalogue --mode catalogue
npm run data:verify -- --destination .local/deployment/production
```

Each package contains `travel.db`, `city-images/`, and `manifest.json` with SHA-256 file and table-row hashes.
Verification checks SQLite integrity, foreign keys and every referenced successful photo. The catalogue retains all
cities, costs, estimate provenance, climate and licensed photos. Keep the full package private.

## Production settings

On the deployment host, copy `.env.production.example` to `.env.production.local`. This file is ignored by Git. Enter
secrets privately; never paste them into chat or a command argument. Keep any locally prepared copy under `.local/`
so Next.js does not load container paths into local builds. Compose accepts `HOLIDAY_SPEND_ENV_FILE` when a different
settings path is needed.

| Setting | Required value |
| --- | --- |
| `NEXTAUTH_SECRET` | A new random secret of at least 32 characters; do not reuse development secrets |
| `APP_URL`, `NEXTAUTH_URL` | The public HTTPS origin |
| `HOLIDAY_SPEND_DB_PATH` | `/app/data/travel.db` inside the container |
| `HOLIDAY_SPEND_REQUIRE_DATABASE` | `true` |
| `HOLIDAY_SPEND_TRUST_PROXY` | `true`, with the private upstream and proxy contract below |
| `AUTH_ADMIN_EMAILS` | Addresses that may change the shared city library; any address may register |
| `ENABLE_EMAIL_PASSWORD` | `true` |
| `RESEND_API_KEY` | Sending-only key restricted to the verified sending domain |
| `MAIL_FROM` | A sender on the verified sending domain, for example `Holiday Spend <no-reply@auth.example.com>` |

Remove `AUTH_DEV_PIN` and `APP_SECRET`. Do not set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`; startup
refuses them because any registered account could spend them. Google sign-in is optional. Application LLM keys
remain in the user's browser; do not copy them into deployment settings.

The container refuses to start with missing or inconsistent configuration, a missing/empty database, a failed SQLite
check, or missing runtime prompts. `/api/health` reports readiness without disclosing data. `npm start` remains
available for local use; the strict production preflight is the Docker entrypoint.

## Email

Verification and password-reset email is sent through Resend from a dedicated sending subdomain.

1. In Resend, add the sending domain and create exactly the DNS records the account shows (DKIM and the sending
   records). Keep any CNAME records DNS-only rather than proxied. Do not substitute records from older tutorials.
2. Keep receiving and link tracking disabled, so password-reset and verification links are not rewritten.
3. Create a **Sending access** API key restricted to that domain and store it privately in `RESEND_API_KEY`.
4. Preview a delivery test with
   `node --env-file=<settings file> scripts/check-email-delivery.mjs --to <an AUTH_ADMIN_EMAILS address>`. Add
   `--send` only when delivery is authorized. Confirm **Delivered** in Resend and receipt; acceptance by the API alone
   does not establish delivery.
5. Add a DMARC TXT record for the sending subdomain, starting with `v=DMARC1; p=none;`, and confirm `dmarc=pass` on a
   received message before tightening it. See [Resend DMARC guidance](https://resend.com/docs/dashboard/domains/dmarc).

No receiving mailbox exists, so do not publish a support or reply address.

## Restore on the deployment host

Transfer the verified production package through SSH to `incoming/production/` in the app checkout. Transfer
`.env.production.local` separately, set mode `600`, and protect the incoming package.

Do not build on a small host. Every push to `main` that passes Production checks publishes the tested runner image to
`ghcr.io/mwilczynska/holiday-spend` as `:main` and `:sha-<7-char commit>`, labelled with its source revision. The
package is public, so the host pulls without credentials. Compose uses `:main` unless `HOLIDAY_SPEND_IMAGE` names
another tag; pin a `sha-` tag to keep a known release and to roll back.

```sh
docker compose pull holiday-spend
docker tag ghcr.io/mwilczynska/holiday-spend:main holiday-spend:release
mkdir -p restore-staging
docker run --rm --user 0:0 \
  -v "$PWD/incoming:/incoming:ro" -v "$PWD/restore-staging:/restore" \
  --entrypoint node holiday-spend:release scripts/backup.mjs \
  --restore-from /incoming/production --destination /restore/runtime-data
sudo chown -R 1001:1001 restore-staging/runtime-data
test ! -e runtime-data
sudo mv restore-staging/runtime-data runtime-data
chmod 600 .env.production.local
docker compose up -d holiday-spend
curl --fail http://127.0.0.1:3000/api/health
```

Restoring into an existing directory is refused. The Compose bind mount is `./runtime-data:/app/data`; this
directory is distinct from the source checkout's `data/reference/`. UID/GID 1001 must own the databases, their
directory and photos so SQLite can create WAL/SHM files. Compare city and personal-table counts with the package
manifest before making the proxy public.

The one-off restore helper runs as container root so it can read a private incoming package owned by the SSH user.
Its input mount is read-only and its output is a new staging directory. Ownership is then assigned to UID/GID 1001;
the running app remains non-root.

## Proxy contract

- Route only the app's hostname to this app.
- The app binds to `127.0.0.1:3000` on the host for local health checks. A container proxy reaches it over a private
  Docker network shared only with the proxy (Compose joins the external `edge` network).
- Terminate HTTPS at the proxy and forward the public Host and protocol. Overwrite `X-Real-IP` from the connection's
  trusted address and clear `X-Forwarded-For`; never forward a client-supplied value. Do not expose the upstream
  directly to the Internet.
- Do not cache authenticated pages, `/api`, or auth responses. Preserve cookies and query strings. Allow long LLM
  requests beyond the configured deadline (default 600 seconds; the live proxy uses a 660-second read timeout) and a
  body limit suitable for CSV imports (20 MB).
- Keep one writable app replica with a local persistent filesystem. Do not put SQLite on ephemeral/serverless storage
  or a shared network filesystem.
- Package the five city/transport prompt files listed in `scripts/lib/runtime-prompts.mjs`; Docker copies them
  explicitly and a test fails if the Dockerfile and list differ.
- The app sends its own security headers (CSP with `frame-ancestors 'none'`, `X-Frame-Options`, HSTS,
  `Referrer-Policy: same-origin`, `nosniff`, `Permissions-Policy`). Do not add a second, conflicting set at the proxy;
  two CSP headers are both enforced. The app bundles its fonts and needs no Google Fonts access during a build.
- If a CDN proxy is placed in front of the website, configure the proxy's real-IP handling with the CDN's trusted
  ranges before relying on the restored client IP.

## First owner sign-in

The prepared owner's copied password is deliberately unknown. Once HTTPS and email delivery work:

1. Open `/forgot-password`, enter the owner's email, and use the received link to choose a password (at least ten
   characters, not all digits). Completing the reset also verifies the address.
2. Verification links from signup or **Resend verification email** ask for the account's password before verifying.
3. Sign in with the new password. Confirm the existing trip, expenses and saved plans are present. Do not create a
   second account or change ownership IDs.
4. Test sign-out, reset, change-password and a second browser's session revocation.

The library is shared. Any registered account can read it and keep its own trip and expense records; only
`AUTH_ADMIN_EMAILS` accounts can add, generate or edit shared city/country records. Signing in never claims unowned
legacy data.

## Backups, recovery and updates

Run backups with this app's `backup` Compose service, which uses SQLite's online backup API and includes every
referenced photo. The output directory must be owned by UID/GID 1001. Schedule it daily, keep a short local
retention, and copy each snapshot encrypted to off-host storage, checking the copy against the source. Run
`sh scripts/backup.sh` by hand before every update. Back up deployment secrets separately in a password manager.

For an update: take and verify a backup, retain the previous image tag, pull the new image, recreate the app with the
same bind mount, and check readiness and authenticated data. Do not reseed. For recovery: stop the app, restore a
verified package to a new directory, point the bind mount at it, and start the matching image. Never overwrite a
database while the app is running.

## Verification

`.github/workflows/production-checks.yml` builds the runner and a disposable CSV seed fixture, then
`scripts/check-container.mjs` verifies native modules, prompts/static assets, real NextAuth sign-in, guest permissions,
revocation, backup through a read-only source mount, restore and restart. These Linux checks do not establish that a
public host is configured: check HTTPS, redirects, proxy headers, `/api/health`, loopback-only upstream, sign-in and an
independent restore on the host itself.

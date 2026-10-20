# Production launch

Holiday Spend runs as one Next.js container with one persistent SQLite database and its city-photo directory. Project Infinite Summer owns the public DNS, TLS, reverse proxy and cutover. Public app origin: `https://spend.projectinfinitesummer.com`.

## What must be preserved

The local database contains 527 cities, including the cities added after the original 121-city CSV. Deploy a verified database/photo snapshot. **Do not run the CSV seed to migrate this library.** Seeding refuses a nonempty library, but an empty seed still contains only the original CSV cities.

The deployment copy preserves the owner's existing user ID, 66 itinerary legs, 68 transports, 1,543 expenses and 73 saved plans. It changes the owner's email only in the copy, replaces the copied local password with an unknown random password, marks email unverified, and revokes copied authentication tokens, OAuth accounts and sessions. Other local fixture credentials are removed; their data is retained. The original local database is unchanged.

Private data packages stay outside Git and the Docker build context. The city catalogue can be exported separately with no users, trips or expenses.

## Prepare and verify data locally

Use Node 24 and the locked dependencies. Pause city-photo refresh while taking a snapshot. Other writes may continue; SQLite's backup API produces a consistent database. If a photo or its metadata changes during copying, the snapshot fails and must be retried into a new directory.

The Linux checks use npm 11.19.0. When refreshing the lockfile on the older Windows runtime, use `npx --yes npm@11.19.0 install --package-lock-only --ignore-scripts`; npm 11.6.2 omitted an optional Sharp/WASM runtime entry that Linux clean installs require.

```powershell
npm run data:snapshot -- --destination .local/deployment/backup --mode full
npm run data:snapshot -- --destination .local/deployment/production --mode full --owner-email YOUR_EMAIL
npm run data:snapshot -- --destination .local/deployment/catalogue --mode catalogue
npm run data:verify -- --destination .local/deployment/production
```

Each package contains `travel.db`, `city-images/`, and `manifest.json` with SHA-256 file and table-row hashes. Verification checks SQLite integrity, foreign keys and every referenced successful photo. The catalogue retains all cities, costs, estimate provenance, climate and licensed photos. Keep the full package private.

## Production settings

On the deployment host, copy `.env.production.example` to `.env.production.local`. This file is ignored by Git. Enter secrets privately; never paste them into chat or a command argument. The owner's prepared local file is `.local/deployment/2026-10-12/.env.production.local`; keep it there so Next.js does not load container paths into local builds. Compose accepts `HOLIDAY_SPEND_ENV_FILE` when a different settings path is needed.

| Setting | Required value |
| --- | --- |
| `NEXTAUTH_SECRET` | A new random secret of at least 32 characters; do not reuse development secrets |
| `APP_URL`, `NEXTAUTH_URL` | `https://spend.projectinfinitesummer.com` |
| `HOLIDAY_SPEND_DB_PATH` | `/app/data/travel.db` inside the container |
| `HOLIDAY_SPEND_REQUIRE_DATABASE` | `true` |
| `HOLIDAY_SPEND_TRUST_PROXY` | `true`, with the private upstream and proxy contract below |
| `AUTH_ALLOWED_EMAILS` | Comma-separated private registration/sign-in allowlist |
| `AUTH_ADMIN_EMAILS` | Allowed addresses that may change the shared city library |
| `ENABLE_EMAIL_PASSWORD` | `true` |
| `RESEND_API_KEY` | Sending-only key restricted to the verified sending domain |
| `MAIL_FROM` | `Holiday Spend <no-reply@auth.projectinfinitesummer.com>` |

Remove `AUTH_DEV_PIN` and `APP_SECRET`. Do not set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`; startup refuses them because any allowlisted account could spend them. Google is optional and not required for the chosen email/password launch. Application LLM keys remain in the user's browser; do not copy them into deployment settings.

The container refuses to start with missing or inconsistent configuration, a missing/empty database, a failed SQLite check, or missing runtime prompts. `/api/health` reports readiness without disclosing data. Development `npm start` remains available for local use; the strict production preflight is the Docker entrypoint.

## Resend setup

1. Open [Resend Domains](https://resend.com/domains), select `auth.projectinfinitesummer.com`, and confirm **Verified**. This domain and its three DNS records were verified on 12 October 2026.
2. Use the exact DNS values shown in the account. This account currently uses a DKIM TXT record at `resend._domainkey.auth`, plus DNS-only CNAMEs `rsend.auth` and `send.auth` pointing to `rsend.forge.rmta.net` and `send.forge.rmta.net`. Older tutorials show MX/SPF records; do not substitute them for the account's current contract.
3. Receiving stays disabled. Tracking has not been configured; keep password-reset and verification links untracked.
4. In [Resend API Keys](https://resend.com/api-keys), create a **Sending access** key restricted to this domain. Save it privately in `RESEND_API_KEY`.
5. Preview a delivery test locally with `node --env-file=.local/deployment/2026-10-12/.env.production.local scripts/check-email-delivery.mjs --to YOUR_ALLOWED_EMAIL`. Add `--send` only when delivery is authorized. Confirm **Delivered** in Resend and receipt; acceptance by the API alone does not establish delivery.
6. A TXT record at `_dmarc.auth` with value `v=DMARC1; p=none;` was added with owner approval. This initial policy does not request quarantine/rejection and has no aggregate-report destination configured. Confirm `dmarc=pass` in a subsequent received message before considering a stricter policy. See [Resend DMARC guidance](https://resend.com/docs/dashboard/domains/dmarc).

The authorized test was delivered on 12 October, initially to Gmail spam. The owner confirmed receipt and marked it Not spam. Resend's test-message Insights reported missing DMARC before the additional record was saved. Its separate no-reply-address recommendation remains advisory: no receiving mailbox exists, so do not imply replies are supported by inventing a support address. Successful API delivery does not establish inbox placement or the public verification/reset flow.

## Restore on the deployment host

Transfer the entire verified production package through SSH to `incoming/production/` in the app checkout. Transfer `.env.production.local` separately, set mode `600`, and protect the incoming package. Existing blog containers and volumes stay in place.

Build on a machine with enough memory, or publish the Linux image from CI and pull it on the VPS. The current VPS has 2 GB RAM; do not assume a Next.js build fits alongside the existing blog.

```sh
docker build --target runner -t holiday-spend:release .
mkdir -p restore-staging
docker run --rm --user 0:0 \
  -v "$PWD/incoming:/incoming:ro" -v "$PWD/restore-staging:/restore" \
  --entrypoint node holiday-spend:release scripts/backup.mjs \
  --restore-from /incoming/production --destination /restore/runtime-data
sudo chown -R 1001:1001 restore-staging/runtime-data
test ! -e runtime-data
sudo mv restore-staging/runtime-data runtime-data
chmod 600 .env.production.local
docker compose up -d --build holiday-spend
curl --fail http://127.0.0.1:3000/api/health
```

Restoring into an existing directory is refused. The Compose bind mount is `./runtime-data:/app/data`; this directory is distinct from the source checkout's `data/reference/`. UID/GID 1001 must own the database, its directory and photos so SQLite can create WAL/SHM files. Verify the expected 527 cities and personal-table counts before making the proxy public.

The one-off restore helper runs as container root so it can read a private incoming package owned by the SSH user. Its input mount is read-only and its output is a new staging directory. Ownership is then assigned to UID/GID 1001; the running app remains non-root.

## Proxy contract for Project Infinite Summer

- Route only `spend.projectinfinitesummer.com` to this app. Keep the existing blog routes/volumes until the separate cutover is approved.
- The app binds to `127.0.0.1:3000` on the host. When using a container proxy instead, remove the host port and use a private Docker network shared only with the proxy.
- Terminate HTTPS at the existing proxy and forward the public Host and protocol. Overwrite `X-Real-IP` from the connection's trusted address; never forward the client's arbitrary value. Do not expose the upstream directly to the Internet.
- Do not cache authenticated pages, `/api`, or auth responses. Preserve cookies and query strings. Allow long LLM requests up to the configured deadline (default 600 seconds) and a suitable body limit for CSV imports.
- Keep one writable app replica with a local persistent filesystem. Do not put SQLite on ephemeral/serverless storage or a shared network filesystem.
- Package the five city/transport prompt files listed in `scripts/lib/runtime-prompts.mjs`; Docker copies them explicitly and a test fails if the Dockerfile and list differ.
- The app sends its own security headers (CSP with `frame-ancestors 'none'`, `X-Frame-Options`, HSTS, `Referrer-Policy: same-origin`, `nosniff`, `Permissions-Policy`). Do not add a second, conflicting set in nginx; two CSP headers are both enforced. The app includes its font locally and does not need Google Fonts access during a build.

Host nginx example for the existing TLS server block:

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 660s;
    client_max_body_size 20m;
}
```

If Cloudflare proxying is enabled for the **website** later, configure nginx's real-IP handling with Cloudflare's trusted ranges before using the restored client IP. The **email CNAME records** remain DNS only.

## First owner sign-in

The prepared owner's copied password is deliberately unknown. Once HTTPS and email delivery work:

1. Open `/forgot-password`, enter the owner's allowed email, and use the received link to choose a password (at least ten characters, not all digits). Completing the reset also verifies the address.
2. Verification links from signup or **Resend verification email** ask for the account's password before verifying.
3. Sign in with the new password. Confirm the existing trip, expenses and saved plans are present. Do not create a second account or change ownership IDs.
4. Test sign-out, reset, change-password and a second browser's session revocation. Confirm a blocked email cannot register. Additional accounts require adding their email to the allowlist and recreating the container.

The library is shared. Allowed guests can read it and use their own trip/expense records; only administrator emails can edit or generate shared city/country records. Signing in never claims unowned legacy data.

## Backups, recovery and updates

Create `backups/` owned by UID/GID 1001 and build the backup helper once with `docker compose --profile tools build backup`. Run `sh scripts/backup.sh` from the checkout. It uses SQLite's online backup API and includes all referenced photos; errors stop the command and no old backups are deleted.

Schedule that command daily with the deployment host's scheduler, and before every update. Copy each verified package to a separate machine/storage account over SSH. Off-host destination, credentials and schedule must be configured in Project Infinite Summer before launch; a backup on the same VPS is insufficient for machine loss. Keep at least one verified pre-update backup and test restore periodically into a new directory. Back up deployment secrets separately in the password manager.

For an update: take/verify the backup, retain the previous image tag, build/pull the new image, recreate the app with the same bind mount, and check readiness and authenticated data. Do not reseed. For recovery: stop the app, restore a verified package to a new directory, point the bind mount at it, and start the matching image. Never overwrite a database while the app is running, and never remove existing blog volumes.

## Launch evidence and remaining host checks

Linux Docker/native modules and container startup are verified at code checkpoint `e3e9045`: [passing workflow](https://github.com/mwilczynska/holiday-spend/actions/runs/38285498810). `.github/workflows/production-checks.yml` builds the runner and a disposable CSV seed fixture, then `scripts/check-container.mjs` verifies native modules, prompts/static assets, real NextAuth sign-in, guest permissions, revocation, backup through a read-only source mount, restore and restart. Windows baseline and the private 527-city restore/data-hash audit also pass.

The deployment host still needs these checks:

- Public HTTPS, redirects, host/proxy headers, readiness and private upstream are verified.
- Snapshot restore contains all 527 cities and expected personal records, with working photo attribution and both image sizes.
- Live verification and password-reset links open the public app and reach the owner's inbox.
- Daily and off-host backups are configured; an independent restore succeeds.
- Existing blog remains reachable before and after the separate cutover.

Local tests do not establish these public-host checks. Docker is not installed in the Windows development environment; record Linux CI/host evidence explicitly.

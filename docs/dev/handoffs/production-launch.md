# Production handoff

The Project Infinite Summer repository owns public deployment at `https://spend.projectinfinitesummer.com`.
The app's complete operational contract is [production-launch.md](../../ops/production-launch.md).

## Local private inputs

These files are available on the owner's machine and must be transferred privately through SSH, outside Git and Docker build contexts:

- Production database/photo package: `C:\Dev\holiday-spend\.local\deployment\2026-10-12\production\`
- Verified independent restore: `C:\Dev\holiday-spend\.local\deployment\2026-10-12\restore-test\`
- Original full backup: `C:\Dev\holiday-spend\.local\deployment\2026-10-12\backup\`
- Separate catalogue with no accounts, trips or expenses: `C:\Dev\holiday-spend\.local\deployment\2026-10-12\catalogue\`
- Prepared settings: `C:\Dev\holiday-spend\.local\deployment\2026-10-12\.env.production.local`

The production package preserves all 527 cities, 105 countries, 384 estimate rows, 383 saved climate records,
527 licensed-photo records and 1,054 photo files. Personal records remain owned by the existing user ID:
66 itinerary legs, 68 transports, 1,543 expenses and 73 saved plans. The CSV alone contains only 121 cities.
Never seed the production deployment as a migration.

The prepared settings contain a fresh auth secret, the private owner allowlist/admin identity and the owner-entered
Resend sending key. Do not print, commit or paste their contents. On the deployment host, use the filename
`.env.production.local`, mode 600, outside any image. The Compose bind mount is `runtime-data:/app/data` (a local
directory, not a named volume); UID/GID 1001 needs write access.

## Email and first access

`auth.projectinfinitesummer.com` is verified in Resend. Its DKIM TXT and two CNAME records are saved in Cloudflare;
the CNAMEs are DNS only. The owner approved the additional `_dmarc.auth` TXT record `v=DMARC1; p=none;`.
The delivery test reached Gmail spam, and the owner marked it Not spam. No receiving mailbox or tracking is configured.
Inbox placement and a received message's DMARC result still need confirmation on a subsequent legitimate account email.

The production copy deliberately has an unknown password and unverified owner email. Once the public HTTPS route is
live, use Forgot password, then Resend verification email, then sign in. This retains the existing account/data ID.
The owner must choose the password privately. Do not create a replacement account or copy local test credentials.

## Required deployment work

1. Review the Linux `Production checks` GitHub Actions result for the app commit. It builds the image and checks
   native modules, real cookie sign-in, permissions, revocation, static assets/prompts, backup/restore and restart
   using disposable data. This does not prove the public host is configured.
2. Build on CI/a machine with sufficient memory, or arrange a release image; do not assume the 2 GB VPS can build
   Next.js while serving the existing blog. This repository's workflow currently tests images and does not publish them.
3. Transfer/verify/restore the production package into a new directory; confirm the counts above and photo files.
   Keep one app replica on local persistent storage, with the private upstream reachable only by the proxy.
4. Configure spend DNS/TLS and the existing proxy per the operational contract. Preserve the current blog and its
   volumes. Test headers, cookies, readiness, protected routes, long provider requests and imports.
5. Complete live owner reset/verification/sign-in, confirm personal data, and verify session revocation in another browser.
6. Configure daily backups and an off-host destination with privately supplied credentials. Verify an independent
   restore before launch. No off-host service or scheduler has been provisioned in this app repository.

Windows unit/build/snapshot checks and Resend delivery are separate evidence from Linux CI and public-host checks.
Do not describe the app as publicly deployed until those host checks pass.

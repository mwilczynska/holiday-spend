# Deployment

This document covers the recommended VPS deployment path for Wanderledger.

It is written to fit the same server pattern already documented in your `travel-blog` project:

- Ubuntu VPS
- non-root `deploy` user
- SSH key access
- UFW, Fail2ban, and unattended upgrades
- Docker and Docker Compose
- domain-based deployment with real TLS at the reverse-proxy layer

This app should reuse that server baseline rather than inventing a different VPS model.

## Recommended Production Shape

Use this app as:

- one Docker container for the Next.js app
- SQLite persisted on disk in `./data`
- the app bound only to `127.0.0.1:3000` on the VPS
- real TLS terminated by a proper reverse proxy in front

This keeps the app simple and avoids shipping self-signed certificates inside the repo.

## How This Differs From `travel-blog`

`travel-blog` is a split frontend/backend app, so its deployment uses multiple application services.

Wanderledger should be simpler:

- one Next.js app container
- SQLite persisted on disk
- one private localhost port
- the same host-level reverse proxy / TLS pattern you already use for other apps

So the recommendation is:

- reuse the same VPS hardening and operations model
- do not copy the old frontend/backend container split into this repo

## Requirements

- Linux VPS
- Docker Engine with Compose plugin
- a domain name pointed at the VPS
- a reverse proxy that can manage real TLS
  - Caddy is the easiest option
  - host-level nginx plus Certbot also works

## Assumed VPS Baseline

This document assumes the VPS itself is already in the state described in the `travel-blog` deployment guide, or close to it:

- `deploy` user exists and has `sudo`
- root SSH login is disabled
- SSH key auth is already working
- UFW allows the public ports you actually use
- Fail2ban is running
- Docker and Docker Compose are installed
- you already have a working pattern for host-level reverse proxying and TLS

If that baseline is not already present, use the `travel-blog` guide for the server-level setup first, then come back here for the app-specific deployment shape.

## Environment

Create `.env.local` from `.env.example` and set at least:

```env
NEXTAUTH_SECRET=replace-with-a-long-random-secret
# NEXTAUTH_URL=https://wanderledger.example.com
DATABASE_URL=file:./data/travel.db
```

For production auth, also set Google OAuth credentials:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Optional LLM provider keys:

```env
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GEMINI_API_KEY=...
```

## First Deploy

From the repo root on the VPS:

1. Create the environment file.
2. Create the persistent data directory.
3. Build the images.
4. Seed the database once.
5. Start the app.

```bash
cp .env.example .env.local
mkdir -p data
docker compose build
docker compose run --rm seed
docker compose up -d wanderledger
```

The app will listen on `127.0.0.1:3000`.

## Updating The App

For a normal code update:

```bash
git pull
docker compose build
docker compose up -d wanderledger
```

If the seed dataset or DB bootstrap expectations change and you explicitly want to reseed a fresh database, do that on purpose. Do not casually reseed an in-use production DB.

## Health Check

The compose file now includes a container healthcheck against `/login`.

Useful commands:

```bash
docker compose ps
docker compose logs -f wanderledger
docker inspect --format='{{json .State.Health}}' $(docker compose ps -q wanderledger)
```

## Reverse Proxy

## Option A: Caddy

Recommended if you want the least manual TLS work.

Example `Caddyfile`:

```caddy
your-domain.example {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Caddy will obtain and renew certificates automatically.

## Option B: Host nginx + Certbot

Use host-level nginx, not the old self-signed repo-managed container setup.

If your VPS is already running host-level nginx for other projects, this is probably the most natural fit for Wanderledger too.

Minimal site config shape:

```nginx
server {
    listen 80;
    server_name your-domain.example;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Then add real TLS with Certbot in the normal host-level flow.

## Integration Recommendation For Your Existing VPS

When you are eventually ready to deploy, the intended shape is:

1. keep your existing VPS hardening model from `travel-blog`
2. run Wanderledger with Docker Compose from its repo directory
3. keep Wanderledger bound to `127.0.0.1:3000`
4. point your existing reverse proxy to that local port
5. terminate real TLS at the reverse proxy, not inside this repo

That keeps Wanderledger operationally consistent with your existing server without forcing the app into a more complex container topology than it needs.

## Database Notes

- The runtime creates `data/travel.db` if it does not exist
- `src/db/index.ts` performs runtime schema bootstrap/backfill for older DBs
- The canonical city dataset is not auto-seeded by simply starting the app
- Use the `seed` service on first deploy to populate countries/cities into a new DB

## Backups

The minimum backup target is:

- `data/travel.db`

Recommended:

- daily off-box copy of `data/travel.db`
- periodic repo snapshot or tagged release alongside DB backups

For SQLite, stop the app or use a SQLite-aware backup process if you want the safest copy during active writes.

## Current Production Caveats

- Auth is still a shared-secret gate today, not OAuth or full user auth
- Saved plans are still browser-local, not database-backed
- SQLite is fine for a small private deployment, but it is still a single-node filesystem database

Given those caveats, deployment polish should not outrun product readiness. The app can be made deployable now, but real multi-user auth and DB-backed saved plans are still the more important pre-launch tasks.

## Troubleshooting

## The app starts but the city library is empty

You probably skipped the seed step.

Run:

```bash
docker compose run --rm seed
docker compose up -d wanderledger
```

## The container is up but the site is unreachable externally

Check:

- DNS points to the VPS
- the reverse proxy is running
- ports `80` and `443` are open on the VPS firewall
- the app is reachable locally with `curl http://127.0.0.1:3000/login`

## LLM generation fails in production

Check:

- the relevant API key exists in `.env.local`
- the key name matches the current app expectation
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `GEMINI_API_KEY`
- the model name is valid for the chosen provider

## Useful Commands

```bash
docker compose logs -f wanderledger
docker compose restart wanderledger
docker compose up -d --build wanderledger
docker compose run --rm seed
```

# Stage 1: Dependencies
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm ci

# Stage 2: Build
FROM node:24-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2b: Seed helper
FROM builder AS seed
CMD ["npm", "run", "db:seed"]

# Stage 3: Production
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/docs/prompts/llm_prompt_new_cities_1.md /app/docs/prompts/llm_prompt_new_cities_v1_1.md /app/docs/prompts/llm_prompt_intercity_transport_1.md /app/docs/prompts/llm_prompt_intercity_transport_v1_1.md ./docs/prompts/
COPY --from=builder /app/scripts/container-entrypoint.mjs ./scripts/container-entrypoint.mjs
COPY --from=builder /app/scripts/lib/production-config.mjs ./scripts/lib/production-config.mjs
COPY --from=builder /app/scripts/lib/data-snapshot.mjs ./scripts/lib/data-snapshot.mjs
COPY --from=builder /app/scripts/backup.mjs ./scripts/backup.mjs

# Never retain build-time database or environment files in the runtime image.
RUN rm -rf /app/data /app/.env /app/.env.local /app/.env.production /app/.env.production.local && mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV HOLIDAY_SPEND_DB_PATH="/app/data/travel.db"
ENV HOLIDAY_SPEND_REQUIRE_DATABASE="true"

CMD ["node", "scripts/container-entrypoint.mjs"]

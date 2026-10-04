# syntax=docker/dockerfile:1.7
#
# Production image (Next.js standalone output).
#
# The build pre-renders the home page and other ISR pages from the database, so
# the build needs a reachable, migrated database. It is passed as a BuildKit
# secret so it never ends up in an image layer:
#
#   DATABASE_URL=postgresql://... docker build --network=host \
#     --secret id=database_url,env=DATABASE_URL \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://www.example.com \
#     -t mytmobiles .
#
# Migrations and the first-time seed run from the `migrate` target:
#
#   docker build --target migrate -t mytmobiles-migrate .
#   docker run --rm --env-file .env mytmobiles-migrate

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS builder
COPY . .
# Public values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID=""
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID \
    NEXT_OUTPUT=standalone
RUN --mount=type=secret,id=database_url,required=true \
    DATABASE_URL="$(cat /run/secrets/database_url)" npm run build

# Applies migrations, then seeds categories, settings, banners, the admin
# account and (only into an empty database) the catalogue.
# Needs no database at build time, so it can run before the first app build.
FROM deps AS migrate
COPY . .
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

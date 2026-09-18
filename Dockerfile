# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM dependencies AS builder
COPY . .
# Public browser configuration only. Server secrets are supplied at runtime.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL=https://clients.kre8ivtech.com
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_BUILD_WORKERS=1 NODE_OPTIONS=--max-old-space-size=1536
RUN pnpm run build:local

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

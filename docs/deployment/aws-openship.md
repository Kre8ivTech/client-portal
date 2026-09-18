# AWS OpenShip deployment

The application hostname remains `clients.kre8ivtech.com`. Hosting moves from Vercel to self-hosted OpenShip; Supabase database, authentication, storage, and realtime remain in the existing production project.

## Build and runtime

- Production baseline: `6214991909771126ebf5a9b4eaf9512f62d2c904`, verified against Vercel deployment `dpl_12GrfPcK272JMXJRBLDH351SPXy5`.
- Build the root Dockerfile for `linux/amd64`. It uses the committed pnpm lockfile and Node 22, required by existing Supabase and AI SDK dependencies.
- Supply the five `NEXT_PUBLIC_*` build arguments listed in the Dockerfile. Set `NEXT_PUBLIC_APP_URL=https://clients.kre8ivtech.com` at both build and runtime.
- Supply server environment variables only at runtime. Preserve the existing encryption secret and Supabase keys. Do not copy Vercel OIDC tokens, Vercel metadata, or Turbo cache variables.
- OpenShip start command: `node server.js`; port: `3000`. Do not override this with `next start`.
- `/api/health` checks process liveness only. Verify Supabase and authenticated application behavior separately.
- The image builds with `build:local`; it never runs database migrations.
- Keep the source environment files private and ignored. The Docker context excludes them.

## Cutover requirements

1. Verify host capacity and enforce container CPU/memory limits. Build off-host to avoid competing with the existing marketing website and OpenShip.
2. Deploy a candidate without public DNS changes, then verify health, login redirects, static assets, authenticated dashboard, tenant isolation, storage, realtime, and active integrations.
3. Preserve the public hostname and existing OAuth/webhook callback paths. Provision and validate TLS before switching traffic.
4. Preserve the old Cloudflare DNS-only CNAME `a690005202c9e532.vercel-dns-017.com` (TTL 600 seconds) as the rollback target.
5. Disable Vercel scheduled execution before enabling AWS schedules. The eight existing schedules are defined in `vercel.json`; do not invoke business jobs as smoke tests.
6. Production Vercel settings lacked `CRON_SECRET` at inspection. Configure authentication deliberately before enabling AWS jobs; do not assume existing Vercel cron calls succeeded.
7. Validate the public hostname after DNS changes and retain the old deployment for rollback.

## Infrastructure constraint observed September 17, 2026

The current OpenShip host is a 1-vCPU, 2-GB t2.small in us-west-2. It had about 781 MB available memory, 694 MB swap used, and 7.1 GB disk free. The EC2 standard On-Demand quota was 1 vCPU; an existing request for 8 vCPUs was still CASE_OPENED. A successful local build does not establish safe production capacity. Do not cut over solely because the container starts.

# Production readiness audit

This is a **living snapshot** of how the codebase lines up with a production launch. Use it with [deployment-checklist.md](deployment-checklist.md) and [security-hardening.md](security-hardening.md).

## Legend

| Status | Meaning |
|--------|--------|
| **Ready** | Works when env + infra are configured as documented. |
| **Config** | Code is fine; you must set keys, URLs, or DNS. |
| **Partial** | Works in limited cases or needs follow-up (see notes). |
| **Gap** | Known limitation or manual process outside the app. |

### Kre8ivTech production hostname

The live portal is served at **`https://clients.kre8ivtech.com`**. In Vercel and `.env` / `NEXT_PUBLIC_APP_URL`, use that URL as the **canonical app origin** (magic links, OAuth redirects, calendar callbacks, email links, CNAME verification hints).

- **This hostname** = the main deployment users hit unless a **partner** has their own verified `custom_domain` (white-label); partner subdomains still point at the same Vercel project.
- **Supabase Auth:** add `https://clients.kre8ivtech.com` and wildcard paths your flows need (e.g. `https://clients.kre8ivtech.com/**`, `/auth/callback`) under **Authentication → URL configuration**.
- **`WHITE_LABEL_CNAME_TARGETS`:** if Vercel shows a different CNAME target than `clients.kre8ivtech.com` (e.g. `cname.vercel-dns.com`), include it here so partner domain verification matches DNS.

---

## 1. Core platform

| Area | Status | Notes |
|------|--------|--------|
| Next.js App Router | Ready | `npm run build` runs migrations then `next build` (see `package.json`). |
| Supabase (DB + Auth + Storage) | Config | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY`; migrations via build or `supabase db push`. |
| Row-level security | Config | Policies in `supabase/migrations/`; verify with real roles in staging. |
| Middleware (session + security checks) | Ready | `middleware.ts` → `updateSession`; MFA/IP/session timeout in `src/lib/supabase/middleware.ts`. |
| TypeScript strict CI | Partial | `next.config.mjs` may use `ignoreBuildErrors: true`; `npm run type-check` can fail on `.next/types` vs Next version — see [security-hardening.md §3](security-hardening.md#3-typescript-strict-builds-ignorebuilderrors). |

---

## 2. Feature areas (operational when configured)

| Feature | Status | Required configuration |
|---------|--------|-------------------------|
| **Login / magic link / password** | Config | Supabase Auth; [redirect URLs](#supabase-auth-and-custom-domains) for each public URL. |
| **SSO (Google, Microsoft, GitHub, Apple)** | Config | Provider keys in Supabase Dashboard + toggles in Admin Auth settings; `OAUTH_STATE_SECRET` in prod ([security-hardening.md](security-hardening.md)). |
| **MFA (TOTP)** | Ready | Supabase MFA + `app_settings` MFA flags; enforced in middleware when configured. |
| **Stripe (checkout, invoices)** | Config | `STRIPE_*`, webhook URL `https://<host>/api/webhooks/stripe`. |
| **Email (Resend)** | Config | `RESEND_API_KEY`; optional `EMAIL_FROM` patterns per your docs. |
| **Email (custom SMTP)** | Config | Global: Admin → Integrations or `/api/admin/email/smtp`. Per partner org: org SMTP API. |
| **DocuSign contracts** | Config | DocuSign app + webhook; env vars per integration docs. |
| **AWS S3 (files)** | Config | Env **or** encrypted config in Admin Integrations + `ENCRYPTION_SECRET`. |
| **AI chatbot** | Config | `ANTHROPIC_API_KEY` / app_settings AI keys; token limits env optional. |
| **Calendar OAuth (Google/Microsoft)** | Config | `GOOGLE_*`, `MICROSOFT_*`; redirect URIs must match `NEXT_PUBLIC_APP_URL`. |
| **File sync (Drive / OneDrive / Dropbox)** | Config | OAuth apps + cron `file-sync` ([vercel.json](../vercel.json)) + `CRON_SECRET`. |
| **Zapier** | Config | API keys + Zaps; see Zapier routes under `src/app/api/zapier/`. |
| **Cron jobs** | Config | `CRON_SECRET` + Vercel Cron entries; see [vercel.json](../vercel.json). Without secret, only admin session can hit routes manually. |
| **SLA / notifications cron** | Config | `/api/notifications/sla-check` in `vercel.json`; same `CRON_SECRET` pattern if protected. |
| **White-label branding** | Config | Partner org + branding + [custom domains §3](#3-white-label-custom-domains-for-agencies). |
| **Portal-wide branding (super_admin)** | Config | `portal_branding` row + Admin settings. |

---

## 3. White-label custom domains (for agencies)

Partners (`organizations.type = 'partner'`) can use a **custom hostname** so the portal matches the agency’s brand. Implementation is **host-based branding**, not a separate deploy per tenant.

### 3.1 Data model

- **`organizations.custom_domain`**: hostname only (e.g. `portal.agency.com`). Only **partner** orgs (`supabase/migrations/20260204000002_restore_custom_domain_for_partners.sql`, `organization.ts` validation).
- **`custom_domain_verified`**: must be **true** (and DNS must match) before tenant branding applies on that host.
- **Branding** lives in `organizations.branding_config` (JSON), edited under **Dashboard → Settings → White Label** (`/dashboard/settings/white-label`).

Resolution at runtime: `getPortalBranding()` loads default portal branding, then if the request `Host` matches a **verified** partner domain, it merges that org’s `branding_config` ([`src/lib/actions/portal-branding.ts`](../src/lib/actions/portal-branding.ts)).

### 3.2 Infrastructure checklist (you / agency)

1. **Vercel (or your host)**  
   - Add the agency’s domain to the **same** project that serves the app (e.g. *Settings → Domains*).  
   - Vercel will show the exact **CNAME target** (often `cname.vercel-dns.com` or a project-specific target).  
   - SSL is provisioned by the host after DNS propagates.

2. **Agency DNS**  
   - Create a **CNAME** from the chosen subdomain (e.g. `portal.agency.com`) to the target your host provides.  
   - The UI shows a hint using `NEXT_PUBLIC_APP_URL`’s hostname ([`organization-branding-form.tsx`](../src/components/settings/organization-branding-form.tsx)); verification uses [`getExpectedCnameTargets()`](../src/lib/white-label/domain-verification.ts).

3. **Environment variable `WHITE_LABEL_CNAME_TARGETS` (optional)**  
   - Comma-separated hostnames that are valid CNAME targets.  
   - Defaults include the hostname from `NEXT_PUBLIC_APP_URL`.  
   - If Vercel’s required target differs (e.g. only `cname.vercel-dns.com`), add it here so **Verify** in the app succeeds. See `.env.example`.

4. **In-app steps**  
   - Staff or partner enters **Custom domain** on White Label, saves.  
   - After DNS propagates, **Verify now** calls `POST /api/white-label/domains/verify` ([route](../src/app/api/white-label/domains/verify/route.ts)), which runs a DNS CNAME check and sets `custom_domain_verified`.  
   - Super_admin can also toggle verification via form where policy allows ([`organization.ts`](../src/lib/actions/organization.ts)).

5. **Supabase Auth and custom domains**  
   Magic links and OAuth redirects must hit **allowed URLs**. In Supabase Dashboard → **Authentication → URL configuration**:  
   - Add **Site URL** or **Redirect URLs** for `https://portal.agency.com` and `https://portal.agency.com/**` (and `/auth/callback` paths as you use them).  
   Without this, sign-in from the custom domain can fail after redirect.

6. **Single deployment**  
   All tenants share one app URL in code (`NEXT_PUBLIC_APP_URL` is the canonical app origin for links in emails unless you add more logic). Custom domains primarily affect **branding** and **which hostname users see**; ensure email templates and deep links use the correct public URL for each context if you white-label fully.

### 3.3 Child orgs (agency’s clients)

- Clients are typically separate `organizations` with `parent_org_id` pointing at the partner.  
- They do **not** get their own `custom_domain` in schema comments — **one custom domain per partner** is the intended model for “agency portal hostname.”  
- Per–child-org SMTP is not required; partner-level SMTP is available for partner org type in the admin white-label section.

---

## 4. Known gaps / follow-ups

| Topic | Detail |
|-------|--------|
| **npm audit** | Transitive issues (e.g. `tar`) may remain; see [security-hardening.md §2](security-hardening.md#2-dependency-vulnerabilities-npm-audit). |
| **CSP** | Content-Security-Policy not set in middleware; optional hardening. |
| **Rate limits** | Not globally enforced on all API routes; consider edge config or API gateway for sensitive endpoints. |
| **E2E coverage** | `npm run test:e2e` — run before major releases ([deployment-checklist.md](deployment-checklist.md)). |

---

## 5. Quick verification commands

```bash
npm run lint
npm run type-check    # may fail on .next/types until aligned; see docs
npm test
npm run build         # includes migrate + next build
```

---

## 6. Document map

| Doc | Purpose |
|-----|---------|
| [deployment-checklist.md](deployment-checklist.md) | Step-by-step Vercel + Supabase + webhooks. |
| [security-hardening.md](security-hardening.md) | CRON_SECRET, OAUTH_STATE_SECRET, audit, TS strict. |
| [tech.md §7](tech.md#7-security-implementation) | High-level security architecture. |

_Last updated: align this file when shipping major features or changing env vars._

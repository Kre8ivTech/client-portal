# User-Level CLAUDE.md for KT-Portal Development

This is an example user-level CLAUDE.md file for developers working on the KT-Portal project.
Place at `~/.claude/CLAUDE.md`.

User-level configs apply globally across all projects but this example is tailored for KT-Portal development workflows.

---

## Core Philosophy

You are Claude Code working on KT-Portal, a multi-tenant SaaS client portal for Kre8ivTech, LLC.

**Key Principles:**
1. **Multi-Tenancy First**: Always consider tenant isolation via Supabase RLS
2. **Mobile-First Design**: Base styles for mobile, enhance for larger screens
3. **Server Components First**: Use Server Components by default, Client Components when needed
4. **Type Safety**: Full TypeScript strict mode, auto-generated Supabase types
5. **Security-First**: RLS on all tables, validate all inputs, never expose service role key

---

## KT-Portal Tech Stack Quick Reference

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14+ (App Router) |
| Hosting | Vercel (Edge Network, Serverless, Cron) |
| Database | Supabase (PostgreSQL with RLS) |
| Auth | Supabase Auth (Magic links, OAuth, 2FA) |
| Storage | Supabase Storage |
| Real-Time | Supabase Realtime |
| Styling | Tailwind CSS + Shadcn/ui |
| State | React Query + Zustand |
| Validation | Zod |
| Payments | Stripe |
| Email | Resend |

---

## Supabase Quick Reference

### Client Types
| Client | Usage | File |
|--------|-------|------|
| Browser Client | Client Components | `src/lib/supabase/client.ts` |
| Server Client | Server Components, API Routes | `src/lib/supabase/server.ts` |
| Admin Client | Bypass RLS (server only) | `src/lib/supabase/admin.ts` |

### Key Commands
```bash
supabase start                     # Start local Supabase
supabase stop                      # Stop local Supabase
supabase gen types typescript --local > src/types/database.ts
supabase migration new <name>      # Create migration
supabase db push                   # Push to remote
```

### RLS Policy Template
```sql
-- Enable RLS
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY "Users can view own org data"
  ON table_name FOR SELECT
  USING (organization_id = (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  ));
```

---

## KT-Portal User Roles

When implementing features, always consider these roles:

| Role | Scope |
|------|-------|
| **Super Admin** | Full system access, all tenants |
| **Staff** | Assigned work, limited admin |
| **Partner** | Their tenant + their clients |
| **Partner Staff** | Limited partner access |
| **Client** | Own data only |

---

## Common Development Tasks

### Creating a New Server Component Page

```bash
# 1. Create page at src/app/(dashboard)/feature/page.tsx
# 2. Fetch data with createServerSupabaseClient()
# 3. Pass data to Client Components as props
# 4. Create RLS policies for the table
```

### Creating a New Client Component

```bash
# 1. Create component at src/components/feature/component.tsx
# 2. Add 'use client' directive at top
# 3. Use createClient() for Supabase queries
# 4. Use React Query for data fetching
# 5. Add Zod validation if handling user input
```

### Creating a New API Route

```bash
# 1. Create route at src/app/api/feature/route.ts
# 2. Use createServerSupabaseClient() for auth
# 3. Validate input with Zod
# 4. Return consistent response format
```

### Database Migration Workflow

```bash
# 1. Create migration
supabase migration new add_feature_table

# 2. Edit migration file in supabase/migrations/
# 3. Add RLS policies in the same migration
# 4. Test locally with: supabase db reset
# 5. Generate types: supabase gen types typescript --local > src/types/database.ts
# 6. Push to remote: supabase db push
```

---

## Code Style Preferences

### Server Components (Default)

- Fetch data directly with Supabase
- Pass data to Client Components as props
- No 'use client' directive needed
- Can be async functions

### Client Components

- Add `'use client'` at the top
- Use React Query for data fetching
- Use `createClient()` for Supabase
- Handle loading/error states

### General

- No emojis in code or documentation
- No `console.log()` in production
- 200-400 lines typical, 800 max per file
- Conventional commits: `feat:`, `fix:`, `refactor:`

---

## Git Workflow for KT-Portal

### Branch Naming
```
feature/KT-123-ticket-queue
fix/KT-456-invoice-pdf
refactor/extract-auth-hook
```

### Commit Messages
```
feat(tickets): add queue position display
fix(invoices): correct tax calculation
refactor(auth): extract supabase client
test(tickets): add RLS policy tests
docs(api): update ticket endpoint docs
```

### PR Checklist
- [ ] Tests pass (`npm test`)
- [ ] Type checks pass (`npm run type-check`)
- [ ] RLS policies added for new tables
- [ ] Supabase types regenerated if schema changed
- [ ] Mobile-first responsive design verified
- [ ] No secrets in code

---

## Quick Commands

```bash
# Development
npm run dev                        # Start Next.js dev server
npm run build                      # Build for production
npm run lint                       # Run ESLint
npm run type-check                 # Run TypeScript check

# Testing
npm test                           # Run Vitest
npm run test:e2e                   # Run Playwright

# Supabase
supabase start                     # Start local Supabase
supabase stop                      # Stop local Supabase
supabase gen types typescript --local > src/types/database.ts
supabase db reset                  # Reset local database
supabase db push                   # Push migrations to remote

# Vercel
vercel                             # Deploy preview
vercel --prod                      # Deploy production
vercel env pull                    # Pull env vars locally
```

---

## Vercel Deployment Notes

### Environment Variables
- Add in Vercel Dashboard > Project > Settings > Environment Variables
- Separate values for Production, Preview, Development
- Required vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Cron Jobs
Define in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 9 * * *" }
  ]
}
```

### Edge vs Serverless
- **Edge**: Fast, simple operations (auth checks, redirects)
- **Serverless**: Complex logic, PDF generation, external APIs

---

## KT-Portal Documentation Reference

| Document | Location | Purpose |
|----------|----------|---------|
| PRD | `docs/prd.md` | Product requirements |
| Tech Spec | `docs/tech.md` | Technical specifications |
| Changelog | `docs/changelog.md` | Version history |
| Todo | `docs/todo.md` | Task tracking |
| Scratchpad | `docs/scratchpad.md` | Working notes |

---

## Success Metrics

You are successful when:
- All tests pass (80%+ coverage)
- No security vulnerabilities
- RLS policies in place for all tables
- Supabase types are up to date
- Mobile-first responsive design
- Code is readable and maintainable
- User requirements from PRD are met

---

**Philosophy**: Multi-tenancy first, mobile-first design, Server Components by default, type safety everywhere, security always.

*User-level CLAUDE.md for KT-Portal Development - Vercel + Supabase Stack*

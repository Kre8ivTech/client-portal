# KT-Portal CLAUDE.md

Project-level instructions for AI assistants working on this codebase.

## Quick Navigation

**Core Documentation:**

- [Project Overview](#project-overview) - Multi-tenant SaaS architecture
- [Critical Rules](#critical-rules) - Multi-tenancy, security, code style
- [Setup & Installation](#setup--installation) - Getting started guide
- [Architecture](#architecture) - System design and patterns

**Development:**

- [Key Patterns](#key-patterns) - Code examples and best practices
- [Development Workflow](#development-workflow) - Day-to-day development
- [Testing](#testing) - Testing strategy and coverage
- [Common Pitfalls](#common-pitfalls) - Avoid these mistakes

**Reference:**

- [File Structure](#file-structure) - Project organization
- [CLI Commands](#cli-commands) - Available commands
- [Environment Variables](#environment-variables) - Configuration
- [Git Workflow](#git-workflow) - Branching and commits

## Project Overview

**KT-Portal** is a multi-tenant SaaS client portal for Kre8ivTech, LLC. It serves white-label partners and direct clients with ticketing, invoicing, contracts, knowledge base, live chat, and messaging capabilities.

**Tech Stack:**

- **Framework:** Next.js 14+ (App Router, TypeScript)
- **Hosting:** Vercel (Edge Network, Serverless Functions, Cron)
- **Database:** Supabase (PostgreSQL with RLS)
- **Auth:** Supabase Auth (Magic links, OAuth, 2FA)
- **Storage:** Supabase Storage
- **Real-Time:** Supabase Realtime (Postgres Changes, Presence, Broadcast)
- **Payments:** Stripe
- **Email:** Resend

**Design Approach:** Mobile-first responsive

## Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- Supabase CLI (`npm install -g supabase`)
- Git

### Initial Setup

1. **Clone and Install**

   ```bash
   git clone <repository-url>
   cd kt-portal
   npm install
   ```

2. **Environment Configuration**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

3. **Supabase Local Development**

   ```bash
   supabase start
   supabase gen types typescript --local > src/types/database.ts
   ```

4. **Run Development Server**

   ```bash
   npm run dev
   ```

5. **Verify Setup**
   - Open http://localhost:3000
   - Check Supabase Studio: http://localhost:54323
   - Run tests: `npm test`

### First-Time Development Setup

1. **Create your feature branch**

   ```bash
   git checkout -b feature/KT-XXX-your-feature-name
   ```

2. **Understand the codebase**
   - Review `docs/prd.md` for product requirements
   - Review `docs/tech.md` for architecture decisions
   - Check `src/app/(dashboard)` for main application structure

3. **Set up your IDE**
   - Install recommended VS Code extensions (TypeScript, ESLint, Tailwind)
   - Enable TypeScript strict mode checking
   - Configure Prettier for consistent formatting

## Critical Rules

### 1. Multi-Tenancy First

Supabase RLS handles most isolation, but always be explicit about tenant context.

```typescript
// WRONG - Relying only on RLS without understanding context
const { data } = await supabase.from("tickets").select("*");

// CORRECT - Explicit about what you're querying
const { data } = await supabase
  .from("tickets")
  .select("*, created_by:profiles!created_by(name)")
  .eq("status", "open")
  .order("created_at", { ascending: false });
```

Always verify RLS policies exist before assuming data is filtered.

### 2. Code Organization

- Many small files over few large files
- High cohesion, low coupling
- 200-400 lines typical, 800 max per file
- Organize by feature/domain, not by type
- Colocate tests with components
- One component per file

### 3. Code Style

**General:**

- No emojis in code, comments, or documentation
- No `console.log()` in production code (use proper logging)
- Proper error handling with try/catch
- TypeScript strict mode enabled
- Input validation with Zod

**TypeScript/React:**

- Functional components only
- Immutability always - never mutate objects or arrays
- Use React Query for all server state
- Use Zustand sparingly for client-only state
- Prefer Server Components where possible
- Use `'use client'` directive only when needed

**Supabase:**

- Always use typed client (`Database` generic)
- Handle errors explicitly, don't ignore them
- Use `.single()` when expecting one row
- Use realtime subscriptions for live data

### 4. Testing

- Write tests for new features
- 80% minimum coverage target
- Unit tests with Vitest
- E2E tests with Playwright for critical flows
- Test RLS policies with different user contexts

### 5. Security

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client
- Use `createServerSupabaseClient()` in Server Components and API routes
- Use `createClient()` (browser client) only in Client Components
- Validate ALL user inputs with Zod schemas
- Sanitize file uploads (type, size)
- RLS policies are mandatory on all tables

### 6. API Design

- Use Next.js API Routes for complex logic
- Use Supabase direct queries for simple CRUD
- Consistent response format
- Proper HTTP status codes
- Rate limiting via Vercel

### 7. Database

- All tables must have RLS enabled
- Use UUID for primary keys
- Use TIMESTAMPTZ for timestamps
- JSONB for flexible structured data
- Create indexes for frequently queried columns
- Use Supabase migrations for schema changes

## Architecture

### System Overview

KT-Portal is a multi-tenant SaaS application built on the Vercel + Supabase stack:

- **Frontend**: Next.js 14+ with App Router (React Server Components)
- **Backend**: Next.js API Routes + Supabase Database Functions
- **Database**: Supabase PostgreSQL with Row-Level Security (RLS)
- **Real-time**: Supabase Realtime (WebSocket-based)
- **Auth**: Supabase Auth (Magic links, OAuth, 2FA)
- **Storage**: Supabase Storage (S3-compatible)
- **Hosting**: Vercel Edge Network
- **Payments**: Stripe
- **Email**: Resend

### Multi-Tenancy Architecture

**Tenant Isolation Strategy:**

1. **Database Level**: RLS policies enforce organization-level data isolation
2. **Application Level**: All queries explicitly filter by `organization_id`
3. **Auth Level**: User profiles linked to single organization
4. **White-Label Support**: Partners (parent orgs) can access client (child org) data via RLS

**Key Tables:**

- `organizations` - Tenant entities (supports parent-child for white-label)
- `profiles` - User accounts (linked to organization)
- `tickets`, `invoices`, `contracts` - All have `organization_id` FK

### Data Flow Patterns

**Server Component Pattern (Preferred):**

```
User Request → Next.js Server Component → Supabase (with RLS) → Render HTML → Client
```

**Client Component Pattern (Interactive UI):**

```
User Interaction → React Query → Supabase Client (with RLS) → State Update → Re-render
```

**Real-time Pattern:**

```
Database Change → Supabase Realtime → WebSocket → React Query Invalidation → Re-fetch
```

### Security Model

**Defense in Depth:**

1. **Row-Level Security (RLS)**: Primary tenant isolation at database
2. **Server-Side Auth Check**: Verify user session in API routes
3. **Input Validation**: Zod schemas for all user inputs
4. **CORS/CSP**: Vercel default security headers
5. **API Rate Limiting**: Vercel built-in rate limiting

**Service Role Usage:**

- Admin client (`supabaseAdmin`) ONLY used in server-side API routes
- Never exposed to client
- Used for cross-org operations (partner viewing client data)

## File Structure

```
kt-portal/
├── CLAUDE.md
├── docs/
│   ├── prd.md
│   ├── tech.md
│   ├── changelog.md
│   ├── todo.md
│   └── scratchpad.md
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/               # Auth route group
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   └── callback/route.ts
│   │   │
│   │   ├── (dashboard)/          # Protected route group
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx          # Dashboard home
│   │   │   ├── tickets/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── invoices/
│   │   │   ├── contracts/
│   │   │   ├── messages/
│   │   │   ├── knowledge-base/
│   │   │   └── settings/
│   │   │
│   │   ├── api/                  # API Routes
│   │   │   ├── webhooks/
│   │   │   │   ├── stripe/route.ts
│   │   │   │   └── supabase/route.ts
│   │   │   ├── invoices/
│   │   │   │   └── [id]/pdf/route.ts
│   │   │   └── cron/
│   │   │       └── reminders/route.ts
│   │   │
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Landing page
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                   # Shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/               # Layout components
│   │   │   ├── sidebar.tsx
│   │   │   ├── bottom-nav.tsx
│   │   │   ├── header.tsx
│   │   │   └── page-container.tsx
│   │   │
│   │   ├── tickets/              # Feature components
│   │   │   ├── ticket-list.tsx
│   │   │   ├── ticket-card.tsx
│   │   │   ├── ticket-detail.tsx
│   │   │   └── create-ticket-form.tsx
│   │   │
│   │   ├── invoices/
│   │   ├── chat/
│   │   └── ...
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-auth.ts
│   │   ├── use-organization.ts
│   │   ├── use-realtime-tickets.ts
│   │   └── ...
│   │
│   ├── lib/                      # Utilities
│   │   ├── supabase/
│   │   │   ├── client.ts         # Browser client
│   │   │   ├── server.ts         # Server client
│   │   │   ├── admin.ts          # Service role client
│   │   │   └── middleware.ts     # Auth middleware
│   │   ├── utils.ts
│   │   ├── cn.ts                 # className helper
│   │   └── validators/           # Zod schemas
│   │       ├── ticket.ts
│   │       ├── invoice.ts
│   │       └── ...
│   │
│   ├── types/
│   │   ├── database.ts           # Auto-generated from Supabase
│   │   └── index.ts              # Custom types
│   │
│   └── stores/                   # Zustand stores (minimal)
│       └── ui-store.ts
│
├── supabase/
│   ├── config.toml
│   ├── migrations/               # Database migrations
│   │   ├── 20260120000000_initial.sql
│   │   └── ...
│   └── functions/                # Edge Functions
│       └── calculate-queue/
│           └── index.ts
│
├── public/
│   ├── manifest.json
│   └── icons/
│
├── tests/
│   ├── e2e/
│   └── unit/
│
├── middleware.ts                 # Next.js middleware
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── vercel.json
└── package.json
```

## Key Patterns

### Supabase Client Setup

```typescript
// lib/supabase/client.ts (Browser - Client Components)
import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// lib/supabase/server.ts (Server Components & API Routes)
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/types/database";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}

// lib/supabase/admin.ts (Service Role - Server Only, bypasses RLS)
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
```

### Server Component Data Fetching

```typescript
// app/(dashboard)/tickets/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TicketList } from '@/components/tickets/ticket-list'

export default async function TicketsPage() {
  const supabase = await createServerSupabaseClient()

  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('*, created_by:profiles!created_by(name, avatar_url)')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return <TicketList tickets={tickets} />
}
```

### Client Component with React Query

```typescript
// components/tickets/ticket-list.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { TicketCard } from './ticket-card'

export function TicketList({ initialTickets }) {
  const supabase = createClient()

  const { data: tickets } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    initialData: initialTickets,
  })

  return (
    <div className="space-y-4">
      {tickets?.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  )
}
```

### Realtime Subscriptions

```typescript
// hooks/use-realtime-tickets.ts
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeTickets() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("tickets-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        (payload) => {
          // Invalidate to refetch
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, supabase]);
}
```

### API Route Pattern

```typescript
// app/api/tickets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTicketSchema } from "@/lib/validators/ticket";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate input
    const body = await request.json();
    const result = createTicketSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 },
      );
    }

    // Get user's org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    // Insert
    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        ...result.data,
        organization_id: profile?.organization_id,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: ticket }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

### Zod Validation Schema

```typescript
// lib/validators/ticket.ts
import { z } from "zod";

export const createTicketSchema = z.object({
  subject: z.string().min(5).max(500),
  description: z.string().min(10).max(10000),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  category: z.string().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
```

### Mobile-First Component

```typescript
// components/tickets/ticket-card.tsx
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import type { Database } from '@/types/database'

type Ticket = Database['public']['Tables']['tickets']['Row']

interface TicketCardProps {
  ticket: Ticket
  onClick?: () => void
}

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        // Mobile first - base styles
        "p-4 cursor-pointer active:bg-muted",
        // Tablet and up
        "md:p-6 md:hover:shadow-md md:transition-shadow"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{ticket.subject}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {ticket.ticket_number}
          </p>
        </div>
        <Badge variant={getPriorityVariant(ticket.priority)}>
          {ticket.priority}
        </Badge>
      </div>

      {ticket.queue_position && (
        <p className="text-xs text-muted-foreground mt-2">
          Queue position: #{ticket.queue_position}
        </p>
      )}
    </Card>
  )
}
```

### Next.js Middleware for Auth

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to login if not authenticated and accessing protected route
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### RLS Policy Pattern

```sql
-- supabase/migrations/20260120000001_tickets_rls.sql

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Users can view tickets in their organization
CREATE POLICY "Users can view org tickets"
  ON tickets FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Users can create tickets in their organization
CREATE POLICY "Users can create org tickets"
  ON tickets FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Partners can view their clients' tickets
CREATE POLICY "Partners can view client tickets"
  ON tickets FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations
      WHERE parent_org_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
      )
    )
  );
```

## Environment Variables

```bash
# .env.local

# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Never expose to client!

# Stripe (required)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Email (required)
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=https://app.ktportal.app
```

## Available Commands

Use these slash commands when working with Claude on this project:

- `/plan` - Create implementation plan for a feature
- `/component` - Create a React component following project patterns
- `/api-route` - Create a Next.js API route
- `/migration` - Create a Supabase migration
- `/rls-policy` - Create RLS policies for a table
- `/hook` - Create a custom React hook
- `/validate` - Create a Zod validation schema
- `/test` - Create tests for a component or function

## Git Workflow

### Branch Naming

```
feature/KT-123-ticket-queue
fix/KT-456-invoice-pdf
refactor/extract-auth-hook
```

### Commit Messages (Conventional)

```
feat(tickets): add queue position display
fix(invoices): correct tax calculation
refactor(auth): extract to custom hook
```

### PR Rules

- Never commit directly to `main`
- All tests must pass
- Type check must pass
- At least one review required

## Development Workflow

### Daily Development Flow

1. **Pull latest changes**

   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create feature branch**

   ```bash
   git checkout -b feature/KT-XXX-description
   ```

3. **Make changes following patterns**
   - Use existing components as reference
   - Follow file organization conventions
   - Add tests for new features

4. **Run quality checks**

   ```bash
   npm run lint          # ESLint
   npm run type-check    # TypeScript
   npm test              # Vitest
   ```

5. **Commit with conventional commits**

   ```bash
   git add .
   git commit -m "feat(tickets): add queue position indicator"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/KT-XXX-description
   # Create PR via GitHub UI or gh CLI
   ```

### When Adding New Features

**Step 1: Plan**

- Review `docs/prd.md` for requirements
- Check if similar features exist
- Identify which tables/RLS policies are affected

**Step 2: Database First**

- Create Supabase migration if schema changes needed
- Add/update RLS policies
- Generate new TypeScript types

**Step 3: Backend**

- Create/update API routes if needed
- Add Zod validation schemas
- Implement server actions or API endpoints

**Step 4: Frontend**

- Create React components (prefer Server Components)
- Add Client Components only for interactivity
- Use React Query for client-side data fetching
- Implement real-time subscriptions if needed

**Step 5: Test**

- Write unit tests for utilities/hooks
- Add E2E tests for critical flows
- Test RLS policies with different user roles

### When Fixing Bugs

1. **Reproduce** - Write a failing test first (TDD)
2. **Locate** - Use browser DevTools, Supabase logs, Vercel logs
3. **Fix** - Make minimal change to fix root cause
4. **Verify** - Ensure test passes, no regressions
5. **Document** - Update CHANGELOG.md if user-facing

## CLI Commands

```bash
# Development
npm run dev                        # Start Next.js dev server
npm run build                      # Build for production
npm run start                      # Start production server
npm run lint                       # Run ESLint
npm run type-check                 # Run TypeScript check

# Testing
npm test                           # Run Vitest
npm run test:e2e                   # Run Playwright E2E tests
npm run test:coverage              # Run tests with coverage

# Supabase CLI
supabase start                     # Start local Supabase
supabase stop                      # Stop local Supabase
supabase gen types typescript --local > src/types/database.ts  # Generate types
supabase migration new my_migration_name  # Create new migration
supabase db push                   # Push migrations to remote
supabase db pull                   # Pull remote schema changes
supabase functions deploy fn-name  # Deploy Edge Function
supabase logs                      # View local logs
```

## Common Pitfalls

### Avoid These

```typescript
// BAD: Using service role key in client component
'use client'
import { supabaseAdmin } from '@/lib/supabase/admin' // NEVER!

// BAD: Not handling Supabase errors
const { data } = await supabase.from('tickets').select('*')
// Always check error!

// BAD: Mutating state
const handleUpdate = () => {
  ticket.status = 'closed'  // Never mutate!
  setTicket(ticket)
}

// BAD: Using useEffect for data fetching
useEffect(() => {
  fetch('/api/tickets').then(...)  // Use React Query!
}, [])

// BAD: Missing 'use client' directive
import { useState } from 'react'  // This will fail without 'use client'
```

### Do This Instead

```typescript
// GOOD: Proper client in client component
"use client";
import { createClient } from "@/lib/supabase/client";

// GOOD: Always handle errors
const { data, error } = await supabase.from("tickets").select("*");
if (error) {
  console.error("Failed to fetch tickets:", error);
  throw error;
}

// GOOD: Immutable updates
const handleUpdate = () => {
  setTicket((prev) => ({ ...prev, status: "closed" }));
};

// GOOD: React Query for data fetching
const { data: tickets } = useQuery({
  queryKey: ["tickets"],
  queryFn: fetchTickets,
});

// GOOD: Explicit client directive
("use client");
import { useState } from "react";
```

## Vercel-Specific

### Cron Jobs (vercel.json)

```json
{
  "crons": [{ "path": "/api/cron/reminders", "schedule": "0 9 * * *" }]
}
```

### Edge vs Serverless

- Use Edge for fast, simple operations
- Use Serverless (Node.js) for complex logic, PDF generation

```typescript
// Edge runtime
export const runtime = "edge";

// Node.js runtime (default)
export const runtime = "nodejs";
```

### Environment Variables in Vercel

- Add all env vars in Vercel Dashboard > Settings > Environment Variables
- Use different values for Preview, Development, and Production

## Troubleshooting

### Common Issues

#### "No Supabase client found" error

**Cause:** Using wrong client for context (browser vs server)
**Solution:**

- In Server Components/API Routes: Use `createServerSupabaseClient()`
- In Client Components: Use `createClient()`

#### RLS policy blocking queries

**Cause:** User lacks permissions or policy misconfigured
**Solution:**

1. Check policy in Supabase Dashboard → Authentication → Policies
2. Test query in Supabase SQL Editor as authenticated user
3. Verify `organization_id` matches in profiles and target table

#### Types out of sync with database

**Cause:** Database schema changed but types not regenerated
**Solution:**

```bash
supabase gen types typescript --local > src/types/database.ts
```

#### Real-time subscription not firing

**Cause:** Table not enabled for realtime or channel misconfigured
**Solution:**

1. Enable realtime in Supabase Dashboard → Database → Publications
2. Verify channel subscription matches table name
3. Check browser console for WebSocket errors

#### Build fails on Vercel

**Cause:** TypeScript errors or missing env vars
**Solution:**

1. Run `npm run build` locally first
2. Check Vercel build logs for specific error
3. Verify all env vars set in Vercel Dashboard

#### "Invalid API key" or "Unauthorized" errors

**Cause:** Environment variables not properly configured
**Solution:**

1. Verify `.env.local` exists and contains all required variables
2. Check that Supabase URL and keys are correct
3. Restart dev server after changing env vars
4. For Vercel deployment, verify env vars in dashboard

#### Components not updating with real-time changes

**Cause:** React Query not configured or subscription not invalidating queries
**Solution:**

1. Ensure React Query Provider wraps your app
2. Use `queryClient.invalidateQueries()` in subscription handler
3. Verify subscription is using correct table name
4. Check Network tab for active WebSocket connection

### Debugging Tools

- **Supabase Logs**: Dashboard → Logs (Postgres, API, Auth)
- **Vercel Logs**: Vercel Dashboard → Deployments → [deployment] → Logs
- **Browser DevTools**: Network tab for Supabase requests
- **React Query DevTools**: `@tanstack/react-query-devtools`
- **Supabase Studio**: http://localhost:54323 (local development)

### Performance Debugging

If experiencing slow queries or performance issues:

1. **Check Database Indexes**

   ```sql
   -- In Supabase SQL Editor
   EXPLAIN ANALYZE SELECT * FROM tickets WHERE organization_id = 'xxx';
   ```

2. **Review RLS Policies**
   - Complex RLS policies can slow queries
   - Check execution plan in Supabase Dashboard

3. **Monitor Bundle Size**

   ```bash
   npm run build
   # Check .next/analyze for bundle analysis
   ```

4. **Enable React Query DevTools**
   - Monitor refetch frequency
   - Check for unnecessary re-renders

---

_CLAUDE.md for KT-Portal - Vercel + Supabase Stack_
_Last updated: January 2026_

# KT-Portal CLAUDE.md

Project-level instructions for AI assistants working on this codebase.

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

## Critical Rules

### 1. Multi-Tenancy First

Supabase RLS handles most isolation, but always be explicit about tenant context.

```typescript
// WRONG - Relying only on RLS without understanding context
const { data } = await supabase.from('tickets').select('*')

// CORRECT - Explicit about what you're querying
const { data } = await supabase
  .from('tickets')
  .select('*, created_by:profiles!created_by(name)')
  .eq('status', 'open')
  .order('created_at', { ascending: false })
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
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// lib/supabase/server.ts (Server Components & API Routes)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}

// lib/supabase/admin.ts (Service Role - Server Only, bypasses RLS)
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

export const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
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
'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useRealtimeTickets() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('tickets-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tickets' },
        (payload) => {
          // Invalidate to refetch
          queryClient.invalidateQueries({ queryKey: ['tickets'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, supabase])
}
```

### API Route Pattern

```typescript
// app/api/tickets/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTicketSchema } from '@/lib/validators/ticket'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate input
    const body = await request.json()
    const result = createTicketSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    // Get user's org
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    // Insert
    const { data: ticket, error } = await supabase
      .from('tickets')
      .insert({
        ...result.data,
        organization_id: profile?.organization_id,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: ticket }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Zod Validation Schema

```typescript
// lib/validators/ticket.ts
import { z } from 'zod'

export const createTicketSchema = z.object({
  subject: z.string().min(5).max(500),
  description: z.string().min(10).max(10000),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.string().optional(),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>
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
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated and accessing protected route
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
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
'use client'
import { createClient } from '@/lib/supabase/client'

// GOOD: Always handle errors
const { data, error } = await supabase.from('tickets').select('*')
if (error) {
  console.error('Failed to fetch tickets:', error)
  throw error
}

// GOOD: Immutable updates
const handleUpdate = () => {
  setTicket(prev => ({ ...prev, status: 'closed' }))
}

// GOOD: React Query for data fetching
const { data: tickets } = useQuery({
  queryKey: ['tickets'],
  queryFn: fetchTickets,
})

// GOOD: Explicit client directive
'use client'
import { useState } from 'react'
```

## Vercel-Specific

### Cron Jobs (vercel.json)
```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 9 * * *" }
  ]
}
```

### Edge vs Serverless
- Use Edge for fast, simple operations
- Use Serverless (Node.js) for complex logic, PDF generation

```typescript
// Edge runtime
export const runtime = 'edge'

// Node.js runtime (default)
export const runtime = 'nodejs'
```

### Environment Variables in Vercel
- Add all env vars in Vercel Dashboard > Settings > Environment Variables
- Use different values for Preview, Development, and Production

---

*CLAUDE.md for KT-Portal - Vercel + Supabase Stack*
*Last updated: January 2026*

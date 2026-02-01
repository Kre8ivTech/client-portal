# Kre8ivTech Client Portal

**Project Codename:** KT-Portal
**Version:** 2.0
**Last Updated:** January 2026

---

## Overview

KT-Portal is a multi-tenant SaaS client portal for Kre8ivTech, LLC. It serves white-label partners and direct clients with ticketing, invoicing, contracts, knowledge base, live chat, and messaging capabilities.

### Tech Stack

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
| Payments | Stripe |
| Email | Resend |

> Note: The detailed technical specification in `docs/tech.md` currently describes the legacy FastAPI + React stack for KT-Portal v1. It is being updated to align with this Next.js + Supabase + Vercel architecture for v2.
---

## Project Structure

```
kt-portal/
├── .github/
│   └── copilot-instructions.md  # GitHub Copilot configuration
├── CLAUDE.md              # Legacy AI assistant config (see .github/)
├── statusline.json        # Status line configuration
├── docs/
│   ├── prd.md             # Product Requirements Document
│   ├── tech.md            # Technical Specification
│   ├── changelog.md       # Version history
│   ├── todo.md            # Task tracking
│   ├── scratchpad.md      # Working notes
│   ├── user-CLAUDE.md     # User-level config template
│   └── sessions/          # Example session notes
├── commands/              # Custom commands
├── contexts/              # Context files
├── hooks/                 # Git/workflow hooks
├── mcp-configs/           # MCP server configurations
├── plugins/               # Plugin definitions
├── rules/                 # Rule files
└── skills/                # Skill definitions
```

---

## AI Assistant Configuration

The project includes comprehensive configuration for GitHub Copilot and other AI assistants:

- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** - Primary configuration with codebase patterns, architecture, and conventions
- **CLAUDE.md** - Legacy configuration (maintained for compatibility)

The Copilot instructions include:
- Critical codebase-specific patterns (Supabase type workarounds, schema structure)
- Multi-tenant architecture and RLS patterns
- Role-based access control
- Testing requirements and conventions
- Common pitfalls and solutions

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/prd.md](./docs/prd.md) | Product Requirements - Features, user roles, modules |
| [docs/tech.md](./docs/tech.md) | Technical Specification - Architecture, database, APIs |
| [docs/changelog.md](./docs/changelog.md) | Version history and decisions |
| [docs/todo.md](./docs/todo.md) | Task tracking by phase |
| [docs/scratchpad.md](./docs/scratchpad.md) | Working notes and quick reference |

---

## Quick Start

1. **Understand the product** - Read [docs/prd.md](./docs/prd.md)
2. **Understand the tech** - Read [docs/tech.md](./docs/tech.md)
3. **AI Assistant Config** - Review [.github/copilot-instructions.md](./.github/copilot-instructions.md)
4. **Start working** - Update [docs/todo.md](./docs/todo.md)
5. **Take notes** - Use [docs/scratchpad.md](./docs/scratchpad.md)

---

## Key Decisions

| Decision | Resolution |
|----------|------------|
| Partner portal access | Free with relationship |
| Ticket visibility | Partners see client tickets; Clients see queue position |
| Payment terms | Admin-configurable |
| Knowledge base | Yes, all roles |
| Contracts | Yes, with e-signature |
| Live chat | Yes, real-time via Supabase |
| Form creation | Admin/staff only |
| Time tracking | Internal only |
| File storage | Supabase Storage (5GB/client) |
| Audit retention | 30 days |

---

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase CLI
- Vercel CLI (optional)

### Commands

```bash
# Development
npm run dev                 # Start Next.js dev server
npm run build               # Build for production
npm run lint                # Run ESLint
npm run type-check          # Run TypeScript check

# Testing
npm test                    # Run Vitest
npm run test:e2e            # Run Playwright

# Supabase
supabase start              # Start local Supabase
supabase stop               # Stop local Supabase
supabase gen types typescript --local > src/types/database.ts
supabase migration new <name>
supabase db push            # Push migrations to remote
```

### Test Accounts

For local development and testing, seed the database with test users:

```bash
npm run seed
```

Or run the SQL script directly:

```bash
psql "$DATABASE_URL" -f supabase/seed_test_users.sql
```

**Password for all test accounts:** `TestPassword123!`

| Email | Role | Organization | Description |
|-------|------|--------------|-------------|
| `super-admin@test.example.com` | super_admin | Kre8ivTech | Full system access |
| `staff@test.example.com` | staff | Kre8ivTech | Internal staff member |
| `partner@test.example.com` | partner | Test Partner | White-label partner admin |
| `partner-staff@test.example.com` | partner_staff | Test Partner | Partner staff member |
| `client@test.example.com` | client | Test Client Org | End client user |

**Organization Hierarchy:**

```
Kre8ivTech (type: kre8ivtech)
  - super_admin, staff roles

Test Partner (type: partner)
  - partner, partner_staff roles
  └── Test Client Org (type: client, child of Test Partner)
        - client role
```

Note: Test accounts are for local/staging environments only. Never seed test users in production.

---

## Project Summary

| Aspect | Details |
|--------|---------|
| **Product** | Multi-tenant client portal |
| **Clients** | White-label partners + Direct clients |
| **Stack** | Next.js + Supabase + Vercel |
| **Design** | Mobile-first responsive |
| **MVP Timeline** | 12-16 weeks |
| **Total Phases** | 4 phases |

---

## Contacts

| Role | Name | Contact |
|------|------|---------|
| Project Owner | TBD | - |
| Lead Developer | TBD | - |
| Designer | TBD | - |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

*KT-Portal - Kre8ivTech Client Portal*

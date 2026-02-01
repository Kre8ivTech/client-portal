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
├── CLAUDE.md              # Project-level AI assistant config
├── statusline.json        # Status line configuration
├── docs/
│   ├── prd.md             # Product Requirements Document
│   ├── tech.md            # Technical Specification
│   ├── changelog.md       # Version history
│   ├── todo.md            # Task tracking
│   ├── scratchpad.md      # Working notes
│   ├── user-CLAUDE.md     # User-level config template
│   └── sessions/          # Example session notes
├── agents/                # AI Agent definitions
├── commands/              # Custom commands
├── contexts/              # Context files
├── hooks/                 # Git/workflow hooks
├── mcp-configs/           # MCP server configurations
├── plugins/               # Plugin definitions
├── rules/                 # Rule files
└── skills/                # Skill definitions
```

---

## Available Agents

Specialized AI agents for different development tasks. Located in `agents/` folder.

| Agent | Description | When to Use |
|-------|-------------|-------------|
| **orchestrator** | Senior technical lead who delegates tasks to subagents. Never implements directly. | Complex multi-step projects requiring coordination |
| **architect** | Software architecture specialist for system design and scalability | Planning new features, refactoring large systems, architectural decisions |
| **planner** | Expert planning specialist for features and refactoring | Feature implementation, architectural changes, complex refactoring |
| **code-searcher** | Comprehensive codebase analysis and forensic examination | Finding functions, security analysis, pattern detection, code mapping |
| **code-reviewer** | Code review for quality, security, and maintainability | After writing or modifying code (recommended for all changes) |
| **security-reviewer** | Security vulnerability detection and remediation (OWASP Top 10) | Code handling user input, auth, API endpoints, sensitive data |
| **build-error-resolver** | Build and TypeScript error resolution with minimal diffs | When build fails or type errors occur |
| **tdd-guide** | Test-Driven Development specialist (Red-Green-Refactor) | Writing new features, fixing bugs, refactoring (80%+ coverage) |
| **e2e-runner** | End-to-end testing with Playwright | Generating, maintaining, running E2E tests |
| **doc-updater** | Documentation and codemap specialist | Updating codemaps, READMEs, guides |
| **refactor-cleaner** | Dead code cleanup and consolidation | Removing unused code, duplicates, safe refactoring |
| **memory-bank-synchronizer** | Syncs memory bank docs with codebase state | Ensuring docs match implementation reality |
| **ux-design-expert** | UX/UI design guidance and Tailwind CSS | User experience optimization, design systems |

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
3. **Configure Claude** - Review [CLAUDE.md](./CLAUDE.md)
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

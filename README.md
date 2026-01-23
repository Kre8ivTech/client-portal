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

---

## Project Structure

This repository serves as a template and configuration for the KT-Portal application. The complete application structure includes:

```
kt-portal/
├── CLAUDE.md              # Project-level AI assistant config
├── CONTRIBUTING.md        # Contribution guidelines
├── README.md              # This file
├── statusline.json        # Status line configuration
├── package.json           # Node.js dependencies
├── next.config.js         # Next.js configuration
├── tailwind.config.js     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
├── vercel.json            # Vercel deployment configuration
├── middleware.ts          # Next.js middleware for auth
│
├── docs/                  # Documentation
│   ├── prd.md             # Product Requirements Document
│   ├── tech.md            # Technical Specification
│   ├── changelog.md       # Version history
│   ├── todo.md            # Task tracking
│   ├── scratchpad.md      # Working notes
│   ├── user-CLAUDE.md     # User-level config template
│   └── sessions/          # Example session notes
│
├── src/                   # Application source code
│   ├── app/               # Next.js App Router
│   │   ├── (auth)/        # Auth route group
│   │   ├── (dashboard)/   # Protected dashboard routes
│   │   ├── api/           # API routes & webhooks
│   │   ├── layout.tsx     # Root layout
│   │   ├── page.tsx       # Landing page
│   │   └── globals.css    # Global styles
│   │
│   ├── components/        # React components
│   │   ├── ui/            # Shadcn/ui components
│   │   ├── layout/        # Layout components
│   │   ├── tickets/       # Ticket feature components
│   │   └── ...            # Other feature components
│   │
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities & helpers
│   │   ├── supabase/      # Supabase client configs
│   │   └── validators/    # Zod validation schemas
│   │
│   ├── types/             # TypeScript types
│   │   └── database.ts    # Auto-generated from Supabase
│   │
│   └── stores/            # Zustand state stores
│
├── supabase/              # Supabase configuration
│   ├── config.toml        # Supabase config
│   ├── migrations/        # Database migrations
│   └── functions/         # Supabase Edge Functions
│
├── public/                # Static assets
│   ├── manifest.json      # PWA manifest
│   └── icons/             # App icons
│
├── tests/                 # Test suites
│   ├── e2e/               # End-to-end tests (Playwright)
│   └── unit/              # Unit tests (Vitest)
│
├── agents/                # AI Agent definitions
├── commands/              # Custom commands
├── contexts/              # Context files
├── hooks/                 # Git/workflow hooks
├── mcp-configs/           # MCP server configurations
├── plugins/               # Plugin definitions
├── rules/                 # Rule files
└── skills/                # Skill definitions
```

> **Note:** The `src/`, `supabase/`, `public/`, and `tests/` directories will be created during application setup. This repository provides the configuration and documentation framework.

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

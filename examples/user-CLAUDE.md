# User-Level CLAUDE.md for KT-Portal Development

This is an example user-level CLAUDE.md file for developers working on the KT-Portal project.
Place at `~/.claude/CLAUDE.md`.

User-level configs apply globally across all projects but this example is tailored for KT-Portal development workflows.

---

## Core Philosophy

You are Claude Code working on KT-Portal, a multi-tenant SaaS client portal for Kre8ivTech, LLC.

**Key Principles:**
1. **Multi-Tenancy First**: Always consider tenant isolation in every feature
2. **Mobile-First Design**: Base styles for mobile, enhance for larger screens
3. **Type Safety**: Full type coverage in Python (type hints) and TypeScript (strict mode)
4. **Test-Driven**: Write tests alongside implementation, 80% coverage target
5. **Security-First**: RLS on all tables, validate all inputs, never expose secrets

---

## KT-Portal Tech Stack Quick Reference

| Layer | Technology |
|-------|------------|
| Backend | FastAPI (Python 3.11+) |
| Frontend | React 18+ with TypeScript |
| Database | PostgreSQL 15+ with RLS |
| Cache/Queue | Redis 7+ + Celery |
| Real-Time | FastAPI WebSockets |
| Styling | Tailwind CSS + Shadcn/ui |
| State | React Query + Zustand |
| Storage | AWS S3 |
| Payments | Stripe |
| Email | SendGrid / Postmark |

---

## Modular Rules

Detailed guidelines for KT-Portal development:

| Rule Area | Key Points |
|-----------|------------|
| Multi-Tenancy | RLS policies on all tables, tenant context via middleware |
| Authentication | JWT with refresh tokens, magic link support |
| API Design | RESTful, versioned (`/v1/`), consistent response format |
| Database | UUIDs, TIMESTAMPTZ, JSONB for flexibility |
| Testing | Pytest (backend), Vitest (frontend), Playwright (E2E) |
| Security | Pydantic/Zod validation, rate limiting, audit logging |

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

### Creating a New API Endpoint

```bash
# 1. Create schema in backend/app/schemas/{entity}.py
# 2. Create/update model in backend/app/models/{entity}.py
# 3. Create service in backend/app/services/{entity}.py
# 4. Create endpoint in backend/app/api/v1/{entity}.py
# 5. Add to router in backend/app/api/v1/router.py
# 6. Write tests in backend/tests/test_{entity}.py
```

### Creating a New React Component

```bash
# 1. Create component in frontend/src/components/{feature}/{component}.tsx
# 2. Add types in frontend/src/types/index.ts if needed
# 3. Create hook in frontend/src/hooks/use-{feature}.ts if needed
# 4. Add API client in frontend/src/api/{feature}.ts if needed
# 5. Write tests alongside component
```

### Database Migration Workflow

```bash
# 1. Modify models in backend/app/models/
# 2. Generate migration
alembic revision --autogenerate -m "description"
# 3. Review migration in backend/migrations/versions/
# 4. Apply migration
alembic upgrade head
# 5. Add RLS policy if new table
```

---

## Code Style Preferences

### Python (Backend)

- Async/await for all database operations
- Type hints on all function signatures
- Pydantic for request/response validation
- Dependency injection for DB sessions
- Use `HTTPException` for API errors
- Structured logging with `structlog`

### TypeScript (Frontend)

- Functional components only
- React Query for server state
- Zustand sparingly for client-only state
- Zod for runtime validation
- Tailwind for styling (mobile-first)
- No `any` types

### General

- No emojis in code or documentation
- No `print()` or `console.log()` in production
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
refactor(auth): extract jwt verification
test(tickets): add queue position tests
docs(api): update ticket endpoint docs
```

### PR Checklist
- [ ] Tests pass (`pytest` and `npm test`)
- [ ] Type checks pass
- [ ] RLS policies added for new tables
- [ ] Mobile-first responsive design verified
- [ ] No secrets in code
- [ ] API documented in OpenAPI

---

## Quick Commands

```bash
# Backend
uvicorn app.main:app --reload --port 8000
pytest --cov=app
alembic upgrade head
celery -A app.tasks worker -l info

# Frontend
npm run dev
npm test
npm run build

# Docker
docker-compose up -d
docker-compose logs -f api
```

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
- Mobile-first responsive design
- Code is readable and maintainable
- User requirements from PRD are met

---

**Philosophy**: Multi-tenancy first, mobile-first design, type safety everywhere, test before ship, security always.

*User-level CLAUDE.md for KT-Portal Development*

# KT-Portal CLAUDE.md

Project-level instructions for AI assistants working on this codebase.

## Project Overview

**KT-Portal** is a multi-tenant SaaS client portal for Kre8ivTech, LLC. It serves white-label partners and direct clients with ticketing, invoicing, contracts, knowledge base, live chat, and messaging capabilities.

**Tech Stack:**
- **Backend:** FastAPI (Python 3.11+)
- **Frontend:** React 18+ with TypeScript
- **Database:** PostgreSQL 15+ with Row-Level Security
- **Cache:** Redis 7+ (sessions, caching, pub/sub)
- **Task Queue:** Celery + Redis
- **Real-Time:** FastAPI WebSockets + Redis Pub/Sub
- **Search:** PostgreSQL FTS (Meilisearch in Phase 3)
- **Styling:** Tailwind CSS 3+ with Shadcn/ui components
- **State Management:** React Query + Zustand
- **Forms:** React Hook Form + Zod
- **Storage:** AWS S3
- **Payments:** Stripe
- **Email:** SendGrid / Postmark

**Design Approach:** Mobile-first responsive

## Critical Rules

### 1. Multi-Tenancy First

PostgreSQL RLS handles tenant isolation, but always be explicit about tenant context.

```python
# WRONG - Missing tenant context
async def get_tickets(db: AsyncSession):
    return await db.execute(select(Ticket))

# CORRECT - Tenant context set via middleware
async def get_tickets(db: AsyncSession, tenant_id: str):
    # RLS policy filters automatically after middleware sets:
    # SET app.current_org_id = 'tenant_uuid'
    return await db.execute(
        select(Ticket)
        .filter(Ticket.status == 'open')
        .order_by(Ticket.created_at.desc())
    )
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
- No `print()` or `console.log()` in production code (use proper logging)
- Proper error handling with try/except (Python) or try/catch (TypeScript)
- TypeScript strict mode enabled
- Input validation with Pydantic (backend) and Zod (frontend)

**Python/FastAPI:**
- Use async/await consistently
- Type hints on all function signatures
- Pydantic models for request/response validation
- Dependency injection for database sessions
- Use `HTTPException` for API errors

**TypeScript/React:**
- Functional components only
- Immutability always - never mutate objects or arrays
- Use React Query for all server state
- Use Zustand sparingly for client-only state
- Prefer component composition over prop drilling

**Database:**
- Always use parameterized queries (never string concatenation)
- Handle errors explicitly, don't ignore them
- Use transactions for multi-table operations
- Create indexes for frequently queried columns

### 4. Testing

- Write tests for new features
- 80% minimum coverage target
- Unit tests with Pytest (backend), Vitest (frontend)
- E2E tests with Playwright for critical flows
- Test RLS policies with different user contexts

### 5. Security

- Never expose secrets in client-side code
- Use environment variables for all credentials
- Validate ALL user inputs with Pydantic/Zod schemas
- Sanitize file uploads (type, size)
- RLS policies are mandatory on all tables
- JWT tokens with short expiry + refresh tokens
- Rate limiting on all public endpoints

### 6. API Design

- RESTful conventions for CRUD operations
- Consistent response format: `{ data, error, meta }`
- Proper HTTP status codes
- OpenAPI/Swagger documentation
- API versioning via URL prefix (`/v1/`)

### 7. Database

- All tables must have RLS enabled
- Use UUID for primary keys
- Use TIMESTAMPTZ for timestamps
- JSONB for flexible structured data
- Create indexes for frequently queried columns
- Use Alembic for schema migrations

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
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── config.py               # Settings/env vars
│   │   ├── database.py             # DB connection
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py             # Dependencies (auth, db)
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── router.py       # Main router
│   │   │       ├── auth.py
│   │   │       ├── tickets.py
│   │   │       ├── invoices.py
│   │   │       ├── organizations.py
│   │   │       └── ...
│   │   │
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── organization.py
│   │   │   ├── user.py
│   │   │   ├── ticket.py
│   │   │   └── ...
│   │   │
│   │   ├── schemas/                # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── ticket.py
│   │   │   ├── invoice.py
│   │   │   └── ...
│   │   │
│   │   ├── services/               # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── ticket.py
│   │   │   ├── queue.py
│   │   │   └── ...
│   │   │
│   │   ├── core/                   # Core utilities
│   │   │   ├── security.py         # JWT, hashing
│   │   │   ├── exceptions.py
│   │   │   └── middleware.py       # Tenant, auth middleware
│   │   │
│   │   └── tasks/                  # Celery tasks
│   │       ├── __init__.py
│   │       ├── email.py
│   │       └── reports.py
│   │
│   ├── migrations/                 # Alembic migrations
│   │   ├── versions/
│   │   └── env.py
│   │
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_tickets.py
│   │   └── ...
│   │
│   ├── requirements.txt
│   ├── Dockerfile
│   └── pyproject.toml
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   │
│   │   ├── api/                    # API client
│   │   │   ├── client.ts
│   │   │   ├── tickets.ts
│   │   │   └── ...
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                 # Shadcn/ui components
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   └── ...
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── bottom-nav.tsx
│   │   │   │   ├── header.tsx
│   │   │   │   └── page-container.tsx
│   │   │   │
│   │   │   ├── tickets/
│   │   │   │   ├── ticket-list.tsx
│   │   │   │   ├── ticket-card.tsx
│   │   │   │   └── create-ticket-form.tsx
│   │   │   │
│   │   │   └── ...
│   │   │
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-tickets.ts
│   │   │   └── ...
│   │   │
│   │   ├── lib/
│   │   │   ├── utils.ts
│   │   │   ├── cn.ts
│   │   │   └── validators/
│   │   │       ├── ticket.ts
│   │   │       └── ...
│   │   │
│   │   ├── pages/                  # Route pages
│   │   │   ├── dashboard/
│   │   │   ├── tickets/
│   │   │   ├── invoices/
│   │   │   └── ...
│   │   │
│   │   ├── stores/                 # Zustand stores
│   │   │   └── ui-store.ts
│   │   │
│   │   └── types/
│   │       └── index.ts
│   │
│   ├── public/
│   │   ├── manifest.json
│   │   └── icons/
│   │
│   ├── tests/
│   │   └── e2e/
│   │
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

## Key Patterns

### FastAPI Endpoint Pattern

```python
# app/api/v1/tickets.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.ticket import TicketCreate, TicketResponse
from app.services.ticket import TicketService

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    ticket_in: TicketCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new ticket."""
    service = TicketService(db)
    ticket = await service.create(
        data=ticket_in,
        user_id=current_user.id,
        org_id=current_user.organization_id,
    )
    return ticket


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a ticket by ID."""
    service = TicketService(db)
    ticket = await service.get_by_id(ticket_id)

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found",
        )

    return ticket
```

### Pydantic Schema Pattern

```python
# app/schemas/ticket.py
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class TicketBase(BaseModel):
    subject: str = Field(..., min_length=5, max_length=500)
    description: str = Field(..., min_length=10, max_length=10000)
    priority: str = Field(default="medium", pattern="^(low|medium|high|critical)$")
    category: Optional[str] = None


class TicketCreate(TicketBase):
    pass


class TicketUpdate(BaseModel):
    subject: Optional[str] = Field(None, min_length=5, max_length=500)
    description: Optional[str] = Field(None, min_length=10, max_length=10000)
    priority: Optional[str] = Field(None, pattern="^(low|medium|high|critical)$")
    status: Optional[str] = None


class TicketResponse(TicketBase):
    id: str
    ticket_number: str
    status: str
    queue_position: Optional[int] = None
    created_by: str
    assigned_to: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
```

### React Query Hook Pattern

```typescript
// hooks/use-tickets.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ticketsApi } from '@/api/tickets';
import type { TicketCreate, Ticket } from '@/types';

export function useTickets() {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: ticketsApi.list,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ['tickets', id],
    queryFn: () => ticketsApi.get(id),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TicketCreate) => ticketsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}
```

### Mobile-First Component Pattern

```tsx
// components/tickets/ticket-card.tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { Ticket } from '@/types';

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
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
  );
}
```

### Tenant Middleware Pattern

```python
# app/core/middleware.py
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.services.tenant import resolve_tenant


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        host = request.headers.get("host", "")
        tenant = await resolve_tenant(host)

        if not tenant:
            return JSONResponse(
                status_code=404,
                content={"error": "Tenant not found"}
            )

        request.state.tenant = tenant
        response = await call_next(request)
        return response
```

### WebSocket Real-Time Pattern

```python
# app/api/v1/websocket.py
from fastapi import WebSocket, WebSocketDisconnect, Depends
from app.core.websocket import ConnectionManager

manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str,
):
    user = await authenticate_ws(token)
    if not user:
        await websocket.close(code=4001)
        return

    await manager.connect(websocket, user.id, user.organization_id)

    try:
        while True:
            data = await websocket.receive_json()
            await handle_message(user, data)
    except WebSocketDisconnect:
        manager.disconnect(user.id)
```

## Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/ktportal
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
JWT_SECRET=your-secret-key-here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=kt-portal-files
AWS_REGION=us-east-1

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Email
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=noreply@kre8ivtech.com

# Monitoring
SENTRY_DSN=https://xxx@sentry.io/xxx

# App
APP_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:8000
CORS_ORIGINS=["http://localhost:3000"]
```

## Available Commands

Use these slash commands when working with Claude on this project:

- `/plan` - Create implementation plan for a feature
- `/component` - Create a React component following project patterns
- `/endpoint` - Create a FastAPI endpoint
- `/migration` - Create an Alembic migration
- `/rls-policy` - Create RLS policies for a table
- `/hook` - Create a custom React hook
- `/schema` - Create Pydantic/Zod validation schemas
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
# Backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html

# Create migration
alembic revision --autogenerate -m "migration_name"

# Run migrations
alembic upgrade head

# Start Celery worker
celery -A app.tasks worker -l info

# Frontend
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Build for production
npm run build

# Docker
docker-compose up -d                 # Start all services
docker-compose down                  # Stop all services
docker-compose logs -f api           # View API logs
```

## Common Pitfalls

### Avoid These

```python
# BAD: Not handling async properly
def get_tickets():  # Missing async
    return db.query(Ticket).all()

# BAD: SQL injection risk
query = f"SELECT * FROM tickets WHERE id = '{ticket_id}'"

# BAD: Missing error handling
ticket = await service.get_by_id(id)
return ticket  # What if ticket is None?

# BAD: Exposing internal errors
except Exception as e:
    return {"error": str(e)}  # Leaks implementation details
```

```typescript
// BAD: Mutating state
const handleUpdate = () => {
  ticket.status = 'closed';  // Never mutate!
  setTicket(ticket);
};

// BAD: Missing loading/error states
const { data } = useQuery(['tickets'], fetchTickets);
return <TicketList tickets={data} />;  // data could be undefined!

// BAD: useEffect for data fetching
useEffect(() => {
  fetch('/api/tickets').then(...)  // Use React Query!
}, []);
```

### Do This Instead

```python
# GOOD: Proper async handling
async def get_tickets(db: AsyncSession):
    result = await db.execute(select(Ticket))
    return result.scalars().all()

# GOOD: Parameterized queries (via SQLAlchemy)
ticket = await db.get(Ticket, ticket_id)

# GOOD: Proper error handling
ticket = await service.get_by_id(id)
if not ticket:
    raise HTTPException(status_code=404, detail="Ticket not found")
return ticket

# GOOD: Generic error response
except Exception as e:
    logger.error(f"Error: {e}")
    raise HTTPException(status_code=500, detail="Internal server error")
```

```typescript
// GOOD: Immutable updates
const handleUpdate = () => {
  setTicket(prev => ({ ...prev, status: 'closed' }));
};

// GOOD: Handle loading/error states
const { data, isLoading, error } = useQuery(['tickets'], fetchTickets);
if (isLoading) return <Skeleton />;
if (error) return <ErrorMessage error={error} />;
return <TicketList tickets={data} />;

// GOOD: React Query for data fetching
const { data: tickets } = useQuery({
  queryKey: ['tickets'],
  queryFn: fetchTickets,
});
```

---

*CLAUDE.md for KT-Portal - FastAPI + React + PostgreSQL Stack*
*Last updated: January 2026*

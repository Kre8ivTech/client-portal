# Kre8ivTech Client Portal
## Scratchpad
**Working Notes & Ideas**

---

## Quick Reference

### Project URLs (Confirmed)
```
Production:     https://clients.kre8ivtech.com
Partner:        https://{slug}.clients.kre8ivtech.com
Custom Domain:  https://portal.{partnerdomain}.com (partner-owned)
```

### Key Contacts
- Project Owner: [TBD]
- Lead Developer: [TBD]
- Designer: [TBD]

### Repository
- Main: [TBD]
- Docs: In `/docs` folder

---

## Current Focus

### Immediate Next Steps
1. Get stakeholder sign-off on PRD
2. Set up development environment
3. Create wireframes for priority screens
4. Initialize project repositories

### Questions to Resolve
- [x] Hosting provider preference? → Vercel (decided)
- [x] Existing AWS account or create new? → Using Supabase Storage instead
- [x] Branding assets available? → Will be provided by stakeholder
- [x] Beta partners identified? → Two existing clients confirmed

---

## Ideas & Brainstorming

### Potential Features (Not Yet Spec'd)
- Client portal mobile app (native)
- White-label mobile app for partners
- Integration marketplace
- Plugin system for custom extensions
- Client satisfaction dashboard
- Automated report generation
- AI ticket summarization
- Voice-to-ticket via phone
- Video support sessions
- Screen recording in tickets

### Marketing / Naming Ideas
- "KT Portal" (current)
- "Kre8iv Hub"
- "ClientSpace"
- "PartnerFlow"

### Potential Partner Integrations
- Basecamp / Asana / Monday.com
- Figma (design handoff)
- GitHub / GitLab (dev tickets)
- Intercom / Zendesk migration
- HubSpot CRM
- Salesforce

---

## Code Snippets & Patterns

### FastAPI Tenant Middleware
```python
from starlette.middleware.base import BaseHTTPMiddleware

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
        
        # Set RLS context
        async with db.acquire() as conn:
            await conn.execute(
                f"SET app.current_org_id = '{tenant.id}'"
            )
        
        response = await call_next(request)
        return response
```

### Queue Position Calculation
```python
async def calculate_queue_positions(priority: str, org_id: str = None):
    """
    Calculate queue positions for all open tickets of a given priority.
    Ordered by created_at (FIFO).
    """
    query = """
        WITH ranked AS (
            SELECT 
                id,
                ROW_NUMBER() OVER (ORDER BY created_at ASC) as position
            FROM tickets
            WHERE status IN ('new', 'open')
            AND priority = $1
            AND ($2::uuid IS NULL OR organization_id = $2)
        )
        UPDATE tickets t
        SET queue_position = r.position,
            queue_calculated_at = NOW()
        FROM ranked r
        WHERE t.id = r.id
    """
    await db.execute(query, priority, org_id)
```

### WebSocket Event Types
```typescript
// types/websocket.ts
type WSEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.assigned'
  | 'ticket.closed'
  | 'ticket.queue_updated'
  | 'invoice.created'
  | 'invoice.paid'
  | 'message.new'
  | 'chat.incoming'
  | 'chat.ended'
  | 'notification'
  | 'presence.update';

interface WSMessage {
  type: WSEventType;
  data: Record<string, any>;
  timestamp: string;
}
```

### Mobile Bottom Navigation
```tsx
// components/BottomNav.tsx
const navItems = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: Ticket, label: 'Tickets', href: '/tickets' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
  { icon: FileText, label: 'Invoices', href: '/invoices' },
  { icon: User, label: 'Account', href: '/account' },
];

export function BottomNav() {
  const pathname = usePathname();
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden">
      <div className="flex justify-around py-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center p-2 text-xs",
              pathname === item.href 
                ? "text-primary" 
                : "text-muted-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
```

---

## Meeting Notes

### [Date TBD] - Kickoff Meeting
*Notes to be added*

---

## Research & References

### Competitor Analysis
- **Freshdesk** — Good ticket UI, chat integration
- **Zendesk** — Robust but complex
- **Intercom** — Excellent chat, expensive
- **HelpScout** — Clean UI, good KB
- **ClientPortal.io** — Simple client portals
- **SuiteDash** — All-in-one approach

### Design Inspiration
- Linear (clean, fast UI)
- Notion (flexibility)
- Stripe Dashboard (data viz)
- Slack (messaging UX)

### Technical Resources
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Query](https://tanstack.com/query)
- [Tailwind CSS](https://tailwindcss.com/)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Stripe API](https://stripe.com/docs/api)

---

## Calculations & Estimates

### Storage Estimates
```
Per client (5GB limit):
- Average ticket: 50KB (text + small attachments)
- Average invoice PDF: 200KB
- Average KB article: 100KB (with images)

5GB = ~100,000 tickets or ~25,000 PDFs

Should be plenty for most clients.
```

### Traffic Estimates (Initial)
```
Assuming 50 partners, 500 clients:
- DAU: ~200 users
- Requests/day: ~50,000
- Peak concurrent: ~100

Infrastructure: Small VPS to start, scale as needed
```

### Cost Estimates (Monthly)
```
Infrastructure:
- VPS (API + Frontend): $50-100
- PostgreSQL (managed): $50-100
- Redis (managed): $20-50
- S3 storage (100GB): $5
- Cloudflare: Free tier

Services:
- SendGrid (10K emails): Free tier → $20
- Stripe: 2.9% + 30¢ per transaction

Total estimated: $150-300/month to start
```

---

## Risks & Concerns

### Technical Risks
1. **Multi-tenant complexity** — Mitigation: Start with proven patterns, thorough testing
2. **Real-time at scale** — Mitigation: Redis pub/sub, horizontal scaling plan
3. **Custom domain SSL** — Mitigation: Caddy auto-SSL or Let's Encrypt automation

### Business Risks
1. **Partner adoption** — Mitigation: Beta program, feedback loops
2. **Feature creep** — Mitigation: Strict MVP scope, phase gates
3. **Competition** — Mitigation: Focus on partner white-label differentiator

---

## Random Notes

*Dump anything here that doesn't fit elsewhere*

- Consider adding "quick reply" suggestions based on KB articles
- Partner dashboard could show "client health" indicators
- Maybe add Zapier/n8n triggers in Phase 2
- Look into Paddle as Stripe alternative for international
- Remember to add proper error boundaries in React
- Need to handle timezone display consistently
- Consider WebSocket reconnection strategy
- Add rate limit headers to all API responses
- Remember CORS configuration for custom domains

---

## Completed Items Archive

*Move completed scratchpad items here*

### 2026-01-20
- ✅ Initial requirements document created
- ✅ Tech stack decided (FastAPI + React + PostgreSQL)
- ✅ Database schema designed
- ✅ API specification drafted
- ✅ Consolidated documentation into project structure

### 2026-01-29
- ✅ All open business questions resolved
- ✅ Beta partners confirmed (2 existing clients)
- ✅ Compliance requirements defined (SOC 2 + GDPR)
- ✅ Multi-language support confirmed as requirement
- ✅ E-signature legal requirements acknowledged
- ✅ File upload limit confirmed (50MB)
- ✅ Live chat concurrency deferred to post-MVP

---

*Scratchpad for KT-Portal Project*
*Last Updated: January 29, 2026*

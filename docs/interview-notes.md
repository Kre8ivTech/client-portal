# KT-Portal Project Interview Notes

**Date:** January 23, 2026
**Status:** In Progress

---

## Confirmed Decisions

### Tech Stack
- **Hosting:** Vercel (confirmed)
- **Stack:** Next.js 14+ (App Router) + Supabase + TypeScript
- **Implication:** Ignore FastAPI references in tech.md - CLAUDE.md is the source of truth

### Scope Simplification
- **White-label deferred:** No partner/white-label features in MVP
- **Current clients:** 15 direct clients (no partners yet)
- **Partner features:** Partners can submit requests through normal system; white-label evaluated later
- **Removed from MVP:**
  - Custom domains & SSL provisioning
  - Per-tenant branding (logos, colors, custom CSS)
  - Partner hierarchy (parent/child organizations)
  - Partner dashboard
  - Partner Staff role

### Scale Expectations
- 15 clients currently
- ~30-100 total users realistically
- 5-20 concurrent users at peak
- Supabase Realtime sufficient (no need for dedicated WebSocket service)

---

## Ticket System Requirements

### Ticket Volume
- Hundreds of tickets per week (high volume)
- Current workflow: All via email (major pain point)

### Ticket Types
1. **Service Request** - New requirement/feature work (billable)
2. **Troubleshooting Ticket** - Break-fix support (may be covered by plan)

### Time & Billing
- **Time estimation:** AI-assisted + manual adjustment
- **Minimum billing:** 1 hour per ticket
- **Two rate types:**
  - Development rate
  - Support rate
- **Rates:** Per-client configuration (not global)

---

## Maintenance Plans & Retainers

### Plan Structure
- X hours per month of specified support types
- Specific coverage types (troubleshooting, dev, specific categories)
- **No rollover** - unused hours expire monthly
- **Auto-renew** monthly
- **Auto-deduct** when time is logged against tickets

### Plan Configuration Fields
| Field | Description |
|-------|-------------|
| Plan name | e.g., "Basic Maintenance" |
| Monthly hours included | e.g., 10 hours |
| Covered support types | Troubleshooting, WordPress, etc. |
| Development hourly rate | For dev work / overages |
| Support hourly rate | For support work / overages |
| Monthly fee | e.g., $500/month |
| Billing cycle start | e.g., 1st of month |

### Client Plan Rules
- **Direct clients:** Single plan per client
- **Partner clients:** Single plan OR dependent on their client requirements (flexible)

### Overage Handling
When client exceeds plan hours:
1. Notify the client
2. Notify staff internally
3. Auto-generate invoice for overage

### Client Visibility
- Dashboard shows remaining hours
- "You've used 7 of 10 hours this month"
- Clients can see their plan status

### Invoicing
- System handles ALL invoicing:
  - Monthly plan fees (auto-generated)
  - Overage charges (auto-generated)
  - Ad-hoc invoices

---

## Current Pain Points (to solve)

1. **No ticket tracking** - emails get lost, no visibility
2. **Manual invoicing** - PayPal/Stripe manual process
3. **Plan tracking from memory** - no system for hours/usage
4. **No client self-service** - clients can't check status

---

## Remaining Interview Topics

- [ ] AI time estimation feature details
- [ ] User roles & permissions
- [ ] UI/UX preferences (mobile-first confirmed in PRD)
- [ ] Notifications & communication preferences
- [ ] Security & compliance concerns
- [ ] Invoice customization needs
- [ ] Reporting requirements

---

## Open Questions

1. How should AI time estimation work? (client-facing or internal?)
2. What categories/tags for tickets?
3. Email notification preferences?
4. Any compliance requirements (SOC2, GDPR)?
5. Preferred payment methods beyond Stripe?

---

*Interview in progress - document will be updated as discussion continues*

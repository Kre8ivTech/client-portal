# Kre8ivTech Client Portal
## Product Requirements Document (PRD)
**Version:** 2.0  
**Last Updated:** January 20, 2026  
**Project Codename:** KT-Portal  
**Design Approach:** Mobile-First Responsive

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Context](#2-business-context)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Core Modules](#4-core-modules)
5. [Dashboard Specifications](#5-dashboard-specifications)
6. [User Flows](#6-user-flows)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Success Metrics](#8-success-metrics)
9. [Phased Rollout](#9-phased-rollout)
10. [Open Items & Risks](#10-open-items--risks)

---

## 1. Executive Summary

### 1.1 Product Vision

The Kre8ivTech Client Portal is a multi-tenant SaaS platform designed to centralize client interactions, support workflows, invoicing, project management, knowledge sharing, and real-time communication. The platform serves two distinct client segments—White Label Partners and Direct Clients—while offering complete white-label customization for partner agencies.

### 1.2 Key Objectives

- **Streamline Operations:** Centralize tickets, invoices, contracts, and communication
- **Enhance Client Experience:** Self-service portal with real-time visibility
- **Enable Partner Success:** White-label capabilities for agency partners
- **Scale Efficiently:** Multi-tenant architecture supporting growth
- **Improve Visibility:** Queue positions, work tracking, and analytics

### 1.3 Key Decisions

| Decision | Resolution |
|----------|------------|
| Partner portal access | Free with established relationship/retainer |
| Partner ticket visibility | Partners see all their clients' tickets |
| Client ticket visibility | Clients see queue position relative to others |
| Payment terms | Admin-configurable through settings |
| Partner commission | None, but track work volume per partner |
| Knowledge base | Yes, for clients, partners, and staff |
| Contracts/proposals | Yes, required feature |
| Design approach | Mobile-first responsive |
| Live communication | Live agent chat + async messaging |
| Form creation | Admin/staff only (partners cannot create) |
| Email domains | Use existing domains |
| Time tracking | Internal only (staff/admin visibility) |
| Audit log retention | 30 days |
| API access | Yes, tiered by role |
| File storage | 5GB per client (adjustable), AWS S3 |

---

## 2. Business Context

### 2.1 Client Segments

**White Label Partners**
- Agencies/companies Kre8ivTech works behind the scenes for
- Need branded experience for their end clients
- Require custom domains and full branding control
- Submit tickets and requests on behalf of clients
- Pay via retainer or established relationship

**Direct Clients**
- Businesses engaging Kre8ivTech directly
- Use Kre8ivTech branded portal
- Self-service ticket submission and tracking
- Direct invoicing and payment

### 2.2 Business Model

- Portal access is **free** for partners with established relationships
- Revenue from services (development, hosting, maintenance)
- Potential future: tiered storage/feature plans

---

## 3. User Roles & Permissions

### 3.1 Role Definitions

| Role | Description | Scope |
|------|-------------|-------|
| **Super Admin** | Kre8ivTech ownership/management | Full system access, all tenants |
| **Staff** | Kre8ivTech team members | Assigned work, limited admin |
| **Partner** | White label agency owners/managers | Their tenant + their clients |
| **Partner Staff** | White label agency team members | Limited partner access |
| **Client** | End customers (direct or via partner) | Own data only |

### 3.2 Permission Matrix

| Feature | Super Admin | Staff | Partner | Partner Staff | Client |
|---------|:-----------:|:-----:|:-------:|:-------------:|:------:|
| **Tenant Management** |
| View all tenants | ✓ | — | — | — | — |
| Manage system settings | ✓ | — | — | — | — |
| **User Management** |
| Manage staff | ✓ | — | — | — | — |
| Manage partners | ✓ | ✓ | — | — | — |
| Manage partner's clients | ✓ | ✓ | ✓ | ✓ | — |
| **Branding** |
| Configure branding | ✓ | — | ✓ | — | — |
| Custom domain setup | ✓ | — | Request | — | — |
| **Tickets** |
| Submit tickets | ✓ | ✓ | ✓ | ✓ | ✓ |
| View own tickets | ✓ | ✓ | ✓ | ✓ | ✓ |
| View queue position | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manage all tickets | ✓ | ✓ | — | — | — |
| Manage tenant tickets | ✓ | ✓ | ✓ | ✓ | — |
| **Invoicing** |
| Create invoices | ✓ | ✓ | ✓ | — | — |
| View own invoices | ✓ | — | ✓ | — | ✓ |
| Configure payment terms | ✓ | — | — | — | — |
| **Contracts** |
| Create contracts/proposals | ✓ | ✓ | ✓ | — | — |
| Sign contracts | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Knowledge Base** |
| Manage KB (system) | ✓ | ✓ | — | — | — |
| Manage KB (own tenant) | ✓ | ✓ | ✓ | — | — |
| View KB | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Forms** |
| Create/edit forms | ✓ | ✓ | — | — | — |
| Submit forms | ✓ | ✓ | ✓ | ✓ | ✓ |
| View submissions | ✓ | ✓ | ✓ (own) | — | — |
| **Communication** |
| Live chat (agent) | ✓ | ✓ | ✓ | ✓ | — |
| Live chat (client) | — | — | — | — | ✓ |
| Direct messaging | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Time Tracking** |
| Log time | ✓ | ✓ | — | — | — |
| View time reports | ✓ | ✓ | — | — | — |
| **Reporting** |
| View all reports | ✓ | ✓ | — | — | — |
| View tenant reports | ✓ | ✓ | ✓ | — | — |
| Partner volume tracking | ✓ | ✓ | ✓ (own) | — | — |
| **API Access** |
| Full API | ✓ | Scoped | — | — | — |
| Tenant-scoped API | ✓ | ✓ | ✓ | — | — |
| Read-only API | ✓ | ✓ | ✓ | ✓ | Optional |

---

## 4. Core Modules

### 4.1 Authentication & Multi-Tenancy

**Features:**
- Email/password authentication
- Magic link / passwordless login
- Two-factor authentication (TOTP, SMS)
- Single sign-on capability (future)
- Session management across domains
- Tenant isolation with row-level security

**Multi-Tenant Architecture:**
- Subdomain routing: `{partner-slug}.portal.kre8ivtech.com`
- Custom domain mapping: `portal.{partnerdomain}.com`
- Wildcard SSL for subdomains
- Let's Encrypt auto-provisioning for custom domains
- DNS CNAME/TXT verification

---

### 4.2 Trouble Ticket System

**Ticket Properties:**
- Unique ID (tenant-prefixed: `KT-1001`, `PARTNER-1001`)
- Subject & description (rich text)
- Priority: Low, Medium, High, Critical
- Status: New, Open, In Progress, Pending Client, Resolved, Closed
- Category: Technical Support, Billing, General Inquiry, Bug Report, Feature Request
- Attachments, internal notes, time tracking
- Queue position (real-time calculated)
- SLA tracking

**Queue Position System:**
- Clients see: "Your ticket is #X of Y in the [Priority] queue"
- Real-time updates via WebSocket
- Estimated response time based on historical data
- Position change notifications

**Partner Visibility:**
- Full view of all client tickets within tenant
- Aggregate stats and filtering
- Bulk actions capability

**Workflow Features:**
- Auto-assignment rules
- Escalation triggers
- Email + push notifications
- Canned responses
- Ticket merging and linking
- Satisfaction surveys

---

### 4.3 Service Request System

**Request Types:**
- New website development
- Website maintenance/updates
- Hosting setup
- Plugin development (ForgeWP integration)
- SEO services
- Design work
- Custom integrations
- Consulting/strategy

**Request Flow:**
1. Client selects service type
2. Dynamic form based on service type
3. File uploads (briefs, assets)
4. Auto-quote or staff review
5. Client approval
6. Contract generation (optional)
7. Converts to project

**Quote Features:**
- Line items with descriptions
- Optional vs. required items
- Package selection
- Validity period
- Digital acceptance
- Auto-convert to invoice

---

### 4.4 Invoicing System

**Invoice Properties:**
- Sequential invoice numbers (per tenant)
- Client/partner association
- Line items: description, quantity, rate, amount
- Tax calculations (configurable)
- Discounts (percentage or fixed)
- Status: Draft, Sent, Viewed, Partial, Paid, Overdue, Void

**Admin-Configurable Payment Terms:**
- Preset terms: Net 15, Net 30, Net 45, Net 60, Due on Receipt
- Custom terms creation
- Per-client/partner overrides
- Late fee settings (percentage, fixed, grace period)
- Early payment discounts

**Payment Integration:**
- Stripe (primary)
- PayPal
- ACH/Bank transfer
- Payment plans / installments

**Automation:**
- Recurring invoices
- Configurable reminder intervals
- Late fee calculation
- Auto-receipt generation
- Credit notes / refunds

---

### 4.5 Contract & Proposal Generation

**Document Types:**
- Service proposals
- Project contracts
- Maintenance agreements
- Retainer agreements
- NDAs
- Custom types

**Template System:**
- Pre-built templates
- Variable placeholders
- Conditional sections
- White-label branding support

**Workflow:**
1. Generate from template or service request
2. Customize content
3. Internal review (optional)
4. Send to client
5. Client views online
6. E-signature capture
7. Countersignature (if required)
8. Auto-create project/invoice

**E-Signature:**
- Built-in draw/type signature
- Audit trail (IP, timestamp, hash)
- PDF generation
- Integration with DocuSign/HelloSign (future)

---

### 4.6 Knowledge Base / Wiki System

**Content Structure:**
- Categories (3 levels deep)
- Articles with rich text, images, video
- Tags and related articles
- Version history

**Access Levels:**
- Public: All users
- Partner: Partners and their clients
- Internal: Staff only
- Client-specific: Per-client docs

**Features:**
- Full-text search
- Article feedback (helpful/not helpful)
- View analytics
- Auto-suggest during ticket creation
- PDF export
- White-label per partner
- Custom domain support: `help.{partnerdomain}.com`

---

### 4.7 Form Builder System

**Field Types (25+):**
- Text (single/multi-line), Email, Phone, Number, Currency
- Date, Date/Time, Time
- Dropdown (single/multi), Radio, Checkboxes, Toggle
- File upload, Image upload, Signature
- Rating, Slider, Hidden field
- Section header, Paragraph, Divider
- Address, URL, Color picker, Matrix/Grid

**Features:**
- Visual drag-and-drop builder
- Conditional logic (show/hide, skip, calculate)
- Validation rules
- Multi-page forms with progress
- Save draft capability
- Templates and cloning
- Submission limits and scheduling

**Access:**
- Only Admin/Staff can create forms
- Partners cannot create forms
- All roles can submit forms

**Analytics:**
- Completion rates
- Drop-off analysis
- Field-level metrics
- Export to CSV/Excel

---

### 4.8 Live Agent Chat & Messaging

**Live Chat (Real-Time):**

*Client Side:*
- Floating chat widget
- Pre-chat form
- Queue position + estimated wait
- Offline message option
- File sharing
- Typing indicators

*Agent Side:*
- Multi-chat handling
- Queue management
- Visitor info panel
- Chat transfer
- Canned responses
- KB article insertion
- Chat-to-ticket conversion
- Whisper mode

**Async Messaging:**
- Threaded conversations
- Direct messages (1:1)
- Group conversations
- Project-based channels
- @mentions
- Push notifications (mobile + browser)

**Presence:**
- Online/offline/away/DND status
- Business hours configuration
- Auto-responses
- Load balancing

---

### 4.9 White Label & Branding

**Customizable Elements:**
- Logo (header, favicon, email)
- Color scheme (primary, secondary, accent)
- Typography (Google Fonts)
- Custom CSS (advanced)
- Email templates
- Portal name/title
- Support contact info
- Terms/privacy URLs

**Domain Configuration:**
- Subdomain auto-provisioning
- Custom domain verification
- SSL auto-management
- Redirect rules

---

### 4.10 Notification Center

**Notification Center:**
- Unified inbox
- Filter by type
- Mark read/unread
- Click to navigate
- Bulk actions
- History

**User Preferences:**
- Per-notification-type settings
- Channels: Email, Push, In-App, SMS
- Digest options: Real-time, Hourly, Daily, Weekly
- Quiet hours

---

### 4.11 Global Search

**Search Scope:**
- Tickets, Messages, Invoices, Contracts
- Knowledge base articles
- Organizations, Users
- Forms & submissions
- Projects, Files

**Features:**
- Unified search bar (Cmd/Ctrl + K)
- Type-ahead suggestions
- Filters and advanced syntax
- Saved searches

---

### 4.12 Additional Modules

**Announcement System:**
- System-wide or targeted broadcasts
- Banner, modal, notification, email
- Scheduling and expiration
- Read tracking

**Audit Logging:**
- Track all sensitive actions
- 30-day retention
- Filterable and exportable
- Anomaly alerts

**Task Management (Internal):**
- Tasks separate from tickets
- Assignees, due dates, priorities
- Linked to tickets/projects
- Kanban and list views

**Email Integration:**
- Email-to-ticket creation
- Reply via email
- Branded templates
- Thread detection

**Custom Fields:**
- Per entity type (org, user, ticket, etc.)
- Same types as form builder
- Required/optional
- Conditional display

**Saved Views & Bulk Actions:**
- Save filter combinations
- Personal or shared views
- Bulk status/assignment changes

**Partner Work Volume Tracking:**
- Tickets, requests, projects per partner
- Revenue attribution
- Trend analysis
- Monthly reports

**File/Asset Management:**
- 5GB per client (adjustable)
- AWS S3 storage
- Organized by client/project
- Version history
- Sharing links with expiration

---

## 5. Dashboard Specifications

### 5.1 Admin Dashboard (Super Admin)

**Mobile Layout:** Collapsible cards, bottom nav, pull-to-refresh

**Widgets:**
- System health indicator
- Active tenants count
- Revenue overview (MRR, ARR)
- Ticket volume & SLA compliance
- New signups
- Staff workload
- Pending service requests
- Overdue invoices
- Live chat status
- Activity feed

**Quick Actions:**
- Create partner/staff account
- View all tickets
- View chat queue
- Generate reports
- System settings

---

### 5.2 Staff Dashboard

**Mobile Layout:** Active chats priority, swipe actions, quick timer

**Widgets:**
- Active chat sessions
- My assigned tickets
- Unassigned/escalated tickets
- My projects & tasks
- Time tracking summary
- Upcoming deadlines
- Recent messages
- KB shortcuts

**Quick Actions:**
- Accept chat
- Create ticket
- Log time
- View queue
- Search KB

---

### 5.3 Partner Dashboard

**Mobile Layout:** Client cards, ticket overview, quick search

**Widgets:**
- Active clients count
- Open tickets by client
- Client queue positions
- Pending service requests
- Work volume this month
- Revenue overview
- Activity feed
- Branding preview
- KB stats
- Message notifications

**Quick Actions:**
- Add client
- Create ticket for client
- Submit service request
- View invoices
- Message client
- Create proposal
- Customize branding

---

### 5.4 Client Dashboard

**Mobile Layout:** Queue position prominent, quick actions grid, chat launcher

**Widgets:**
- Open tickets with queue position
- "Your position: #3 in queue" display
- Estimated response time
- Recent ticket updates
- Pending invoices
- Project status
- Unread messages
- Announcements
- Quick links
- Recent KB articles

**Quick Actions:**
- Submit ticket
- Start live chat
- Request service
- Pay invoice
- Give feedback
- Search KB
- View messages

---

## 6. User Flows

### 6.1 Client Ticket Submission

```
Login (mobile-first)
    ↓
Dashboard shows queue positions
    ↓
Tap "Submit Ticket" (FAB)
    ↓
Select category → KB suggestions appear
    ↓
Fill form (subject, description, priority)
    ↓
Attach files (optional)
    ↓
Submit → Confirmation + ticket # + queue position
    ↓
Real-time queue updates via WebSocket
    ↓
Notification when agent responds
```

### 6.2 Partner Viewing Client Tickets

```
Login to white-labeled portal
    ↓
Dashboard shows all clients' ticket summary
    ↓
Filter by client, status, priority
    ↓
View aggregate queue positions
    ↓
Drill into specific client
    ↓
View all tickets for that client
    ↓
Add internal notes or escalate
```

### 6.3 Live Chat Flow

```
CLIENT                          AGENT
──────                          ─────
Click chat widget               Set status "Available"
    ↓                               ↓
Fill pre-chat form              See incoming in queue
    ↓                               ↓
Enter queue                     Accept chat
    ↓                               ↓
See position + wait time        View client info
    ↓                               ↓
Connected                       Send greeting
    ↓                               ↓
Real-time messaging             Insert KB articles
    ↓                               ↓
Issue resolved OR...            Transfer if needed
    ↓                               ↓
Convert to ticket               Create ticket + end
    ↓                               ↓
Satisfaction survey             Chat logged
```

### 6.4 Contract Generation

```
Service request approved / quote accepted
    ↓
Staff selects "Generate Contract"
    ↓
Choose template or start blank
    ↓
System auto-fills variables
    ↓
Staff reviews and edits
    ↓
Internal approval (optional)
    ↓
Send to client (email + portal)
    ↓
Client views online
    ↓
Client e-signs
    ↓
Staff counter-signs (if required)
    ↓
PDF generated, stored, emailed
    ↓
Auto-create project (if configured)
```

---

## 7. Non-Functional Requirements

### 7.1 Performance

- First contentful paint: < 1.5s
- Time to interactive: < 3s
- API response time: < 200ms (p95)
- WebSocket latency: < 100ms
- Lighthouse mobile score: > 90

### 7.2 Scalability

- Support 10,000+ concurrent users
- Handle 1,000+ tickets/day
- 100+ simultaneous chat sessions
- Horizontal scaling capability

### 7.3 Availability

- 99.9% uptime SLA
- Automated failover
- Zero-downtime deployments
- Disaster recovery plan

### 7.4 Security

- OWASP Top 10 compliance
- Data encryption (at rest + in transit)
- Row-level security for tenant isolation
- 2FA support
- API rate limiting
- Audit logging
- Regular security audits

### 7.5 Compliance

- GDPR-ready (data export, deletion)
- SOC 2 preparation (future)
- Accessibility (WCAG 2.1 AA target)

---

## 8. Success Metrics

### 8.1 Operational KPIs

| Metric | Target |
|--------|--------|
| Ticket first response time | < 4 hours |
| Ticket resolution time (by priority) | SLA defined |
| SLA compliance rate | > 95% |
| Live chat response time | < 30 seconds |
| Chat resolution rate | > 80% |
| Client satisfaction (CSAT) | > 4.5/5 |
| KB deflection rate | > 20% |

### 8.2 Business KPIs

| Metric | Target |
|--------|--------|
| Revenue processed | Track growth |
| Invoice collection rate (on-time) | > 90% |
| Service request conversion | > 60% |
| Contract signing time | < 48 hours |
| Partner retention rate | > 95% |
| Client churn rate | < 5% annually |

### 8.3 Engagement KPIs

| Metric | Tracking |
|--------|----------|
| DAU/MAU | Active users |
| Mobile vs. desktop | Usage split |
| KB article views | Trending content |
| Chat vs. ticket preference | Channel mix |
| Self-service resolution | KB effectiveness |

---

## 9. Phased Rollout

### Phase 1: MVP (12-16 weeks)

**Core Infrastructure:**
- [ ] Authentication (email/password, magic link)
- [ ] Multi-tenancy & tenant management
- [ ] Role system (Admin, Staff, Partner, Client)
- [ ] Mobile-first responsive UI
- [ ] Subdomain routing

**Tickets:**
- [ ] Ticket CRUD & workflows
- [ ] Queue position system
- [ ] Partner client ticket visibility
- [ ] Email notifications

**Invoicing:**
- [ ] Invoice creation (manual)
- [ ] Admin-configurable payment terms
- [ ] Stripe integration
- [ ] Basic tracking

**Communication:**
- [ ] Async messaging system
- [ ] Conversation threads
- [ ] Notifications

**Forms:**
- [ ] Form builder (admin/staff only)
- [ ] Core field types
- [ ] Form submissions

**Dashboards:**
- [ ] Admin dashboard
- [ ] Staff dashboard
- [ ] Partner dashboard
- [ ] Client dashboard

**Search & Notifications:**
- [ ] Global search (basic)
- [ ] Notification center
- [ ] User preferences

**Branding:**
- [ ] Basic branding (logo, colors)
- [ ] Subdomain per partner

---

### Phase 2: Enhanced Features (10-12 weeks)

**Knowledge Base:**
- [ ] Article management
- [ ] Categories & search
- [ ] Access levels
- [ ] Partner KB support

**Contracts:**
- [ ] Template system
- [ ] Document generation
- [ ] E-signature (built-in)
- [ ] PDF generation

**Live Chat:**
- [ ] Chat widget
- [ ] Agent interface
- [ ] Queue management
- [ ] Chat-to-ticket

**Service Requests:**
- [ ] Request system
- [ ] Dynamic forms
- [ ] Quote generation

**Advanced Features:**
- [ ] Custom domain support
- [ ] Advanced branding
- [ ] SLA tracking
- [ ] Partner volume tracking
- [ ] Email integration
- [ ] Custom fields
- [ ] Audit logging
- [ ] Task management
- [ ] Saved views & bulk actions

---

### Phase 3: Advanced (10-12 weeks)

**Time & Projects:**
- [ ] Time tracking (internal)
- [ ] Project management module
- [ ] Visual feedback system
- [ ] Milestone tracking

**Communication Enhanced:**
- [ ] Group conversations
- [ ] File sharing in chat
- [ ] Presence indicators
- [ ] PWA push notifications

**API & Integrations:**
- [ ] REST API (full)
- [ ] Webhooks
- [ ] DocuSign/HelloSign
- [ ] QuickBooks/Xero
- [ ] Slack notifications
- [ ] Calendar integrations

**Analytics:**
- [ ] Advanced reporting
- [ ] Custom report builder
- [ ] Partner performance reports

---

### Phase 4: Scale (Ongoing)

- [ ] AI-powered ticket triage
- [ ] Chatbot (first-line)
- [ ] Sentiment analysis
- [ ] Client health scoring
- [ ] Multi-language/localization
- [ ] Native mobile app
- [ ] Advanced automation rules
- [ ] Status page

---

## 10. Open Items & Risks

### 10.1 Open Questions

1. Preferred hosting provider (existing vs. new)?
2. Target concurrent live chat sessions?
3. Existing branding assets/design system?
4. E-signature legal requirements by region?
5. Multi-language support needed?
6. Maximum file upload size preference?
7. Specific compliance requirements?

### 10.2 Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep | Timeline delay | Strict phase boundaries, MVP focus |
| Multi-tenant complexity | Development time | Start with proven patterns |
| Real-time performance | User experience | Proper WebSocket architecture |
| Custom domain SSL | Operational overhead | Automate with Let's Encrypt/Caddy |
| Partner adoption | Business impact | Early partner feedback, beta program |

### 10.3 Dependencies

- AWS S3 account for file storage
- Stripe account for payments
- SendGrid/Postmark for email
- Cloudflare for DNS/CDN
- Domain for portal (portal.kre8ivtech.com)

---

*Product Requirements Document for Kre8ivTech Client Portal*  
*Version 2.0 — January 20, 2026*

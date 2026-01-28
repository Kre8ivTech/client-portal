# Kre8ivTech Client Portal

## Project Task List

**Last Updated:** January 20, 2026

---

## Status Legend

| Symbol | Meaning     |
| ------ | ----------- |
| ⬜     | Not started |
| 🔲     | In progress |
| ✅     | Completed   |
| ⏸️     | On hold     |
| ❌     | Cancelled   |

---

## Phase 0: Planning & Setup (Current)

### Documentation

- ✅ Initial requirements gathering
- ✅ User roles & permissions defined
- ✅ Core modules specified
- ✅ Technical stack decided (Next.js + Supabase + Tailwind)
- ✅ Database schema designed (Supabase Migrations)
- ✅ API specification drafted
- ✅ Consolidated PRD created
- ⬜ Wireframes / UI mockups
- ⬜ Final stakeholder sign-off

### Infrastructure Setup

- ✅ Created GitHub/GitLab repository
- ✅ Set up development environment (Next.js 14+)
- ✅ Set up Supabase database (Migrations)
- ⬜ Set up Supabase Storage
- ⬜ Set up SendGrid/Postmark account
- ⬜ Set up Stripe account (test mode)
- ⬜ Configure Cloudflare DNS
- ⬜ Set up CI/CD pipeline

### Design

- ⬜ Design system / component library selection
- ⬜ Color palette and typography
- ⬜ Mobile wireframes (priority screens)
- ⬜ Desktop wireframes
- ⬜ Interactive prototype (Figma)
- ⬜ Design review and approval

---

## Phase 1: MVP (12-16 weeks)

### Sprint 1-2: Foundation (Weeks 1-4)

#### Backend Core (Supabase)

- ✅ Supabase project initialization
- ✅ Database schema design (Migrations)
- ✅ Initial organizations/profiles tables
- ✅ Authentication triggers
- ✅ RLS Policies verification
- 🔲 Storage bucket configuration
- 🔲 Edge Functions for business logic (if needed)

#### Frontend Core (Next.js)

- ✅ Next.js project setup (App Router + TypeScript)
- ✅ Tailwind CSS configuration
- 🔲 Component library setup (Shadcn/ui)
- ✅ Router configuration (Next.js App Router)
- ✅ Supabase Client setup
- ✅ Auth middleware and basic layout
- ✅ Login/Landing UI Polish
- 🔲 Registration / invite flow
- ✅ Basic dashboard layout
- 🔲 Mobile navigation (Sidebar hidden on mobile)
- 🔲 Breadcrumb navigation
- 🔲 Dashboard View Skeletons

### Sprint 3-4: Tickets (Weeks 5-8)

#### Backend

- ✅ Ticket model and migrations
- ✅ Ticket CRUD endpoints
- ✅ Ticket comments endpoints
- ⬜ Ticket number generation (tenant-prefixed)
- ⬜ Queue position calculation
- ⬜ Auto-assignment logic
- ⬜ Status workflow validation
- ⬜ File attachment handling
- ⬜ Email notifications (ticket created, updated)

#### Frontend

- ✅ Ticket list view (mobile-first)
  - ⬜ Filter bar
  - ⬜ Sort options
  - ⬜ Infinite scroll
- ✅ Ticket detail view
  - ⬜ Status badge
  - ⬜ Queue position display
  - ✅ Comment thread
  - ⬜ Internal notes (staff)
- ✅ Create ticket form
  - ✅ Category selection
  - ✅ Priority selection
  - ⬜ File upload
  - ⬜ Rich text description
- ⬜ Ticket actions (close, assign, update)

### Sprint 5-6: Invoicing (Weeks 9-12)

#### Backend

- ⬜ Invoice model and migrations
- ⬜ Payment terms model
- ⬜ Invoice CRUD endpoints
- ⬜ Invoice number generation
- ⬜ PDF generation (WeasyPrint)
- ⬜ Stripe integration
  - ⬜ Payment intent creation
  - ⬜ Webhook handling
  - ⬜ Payment recording
- ⬜ Invoice status transitions
- ⬜ Email notifications (invoice sent, paid)
- ⬜ Payment terms admin endpoints

#### Frontend

- ⬜ Invoice list view
- ⬜ Invoice detail view
- ⬜ Invoice PDF preview
- ⬜ Create/edit invoice form
- ⬜ Line item management
- ⬜ Payment terms selector
- ⬜ Send invoice action
- ⬜ Payment page (client)
- ⬜ Payment confirmation
- ⬜ Admin: Payment terms settings

### Sprint 7-8: Dashboards & Messaging (Weeks 13-16)

#### Backend

- ⬜ Dashboard aggregation endpoints
- ⬜ Notification model
- ⬜ Notification preferences
- ⬜ Conversation model
- ⬜ Message model
- ⬜ WebSocket setup
- ⬜ Real-time message delivery
- ⬜ Push notification prep
- ⬜ Global search endpoint

#### Frontend

- ⬜ Admin dashboard
  - ⬜ Stats cards
  - ⬜ Activity feed
  - ⬜ Quick actions
- ⬜ Staff dashboard
- ⬜ Partner dashboard
- ⬜ Client dashboard
  - ⬜ Queue position widget
  - ⬜ Open tickets widget
  - ⬜ Pending invoices widget
- ⬜ Notification center
  - ⬜ Notification list
  - ⬜ Mark as read
  - ⬜ Preference settings
- ⬜ Messaging UI
  - ⬜ Conversation list
  - ⬜ Message thread
  - ⬜ Compose message
- ⬜ Global search bar (Cmd+K)

### MVP Polish & Launch Prep

- ⬜ Form builder (basic version)
- ⬜ Basic branding (logo, colors)
- ⬜ Subdomain routing
- ⬜ Error handling & logging
- ⬜ Loading states & skeletons
- ⬜ Empty states
- ⬜ Mobile testing
- ⬜ Performance optimization
- ⬜ Security audit
- ⬜ Beta testing with select partners
- ⬜ Bug fixes from beta
- ⬜ MVP launch 🚀

---

## Phase 2: Enhanced Features (10-12 weeks)

### Knowledge Base

- ⬜ Category model and CRUD
- ⬜ Article model and CRUD
- ⬜ Rich text editor integration
- ⬜ Full-text search
- ⬜ Access level filtering
- ⬜ Article versioning
- ⬜ View tracking
- ⬜ Helpful/not helpful voting
- ⬜ KB frontend (category list, article view)
- ⬜ KB search UI
- ⬜ KB admin (article management)

### Contracts & Proposals

- ⬜ Contract template model
- ⬜ Contract model
- ⬜ Variable substitution engine
- ⬜ PDF generation (proposals)
- ⬜ E-signature capture (built-in)
- ⬜ Signature audit trail
- ⬜ Contract workflow (send, view, sign)
- ⬜ Contract frontend (view, sign)
- ⬜ Template editor (admin)
- ⬜ Email notifications

### Live Chat

- ⬜ Chat session model
- ⬜ Chat message model
- ⬜ WebSocket chat handler
- ⬜ Agent availability tracking
- ⬜ Queue management
- ⬜ Chat widget (client)
- ⬜ Agent chat interface
- ⬜ Multi-chat handling
- ⬜ Chat-to-ticket conversion
- ⬜ Canned responses
- ⬜ Satisfaction survey

### Service Requests

- ⬜ Service request model
- ⬜ Dynamic form integration
- ⬜ Quote generation
- ⬜ Approval workflow
- ⬜ Service request frontend
- ⬜ Quote acceptance UI

### Advanced Features

- ⬜ Custom domain support
  - ⬜ DNS verification
  - ⬜ SSL provisioning
- ⬜ Advanced branding controls
- ⬜ SLA tracking
- ⬜ Partner work volume tracking
- ⬜ Email integration (inbound)
- ⬜ Custom fields system
- ⬜ Audit logging (30-day)
- ⬜ Task management (internal)
- ⬜ Saved views
- ⬜ Bulk actions

---

## Phase 3: Advanced (10-12 weeks)

### Time & Projects

- ⬜ Time entry model
- ⬜ Timer widget
- ⬜ Timesheet view
- ⬜ Project model
- ⬜ Milestone tracking
- ⬜ Visual feedback system

### API & Integrations

- ⬜ Full REST API documentation
- ⬜ Webhooks system
- ⬜ Webhook delivery & retries
- ⬜ API rate limiting (tiered)
- ⬜ DocuSign integration
- ⬜ QuickBooks integration
- ⬜ Slack notifications
- ⬜ Calendar sync

### Analytics

- ⬜ Custom report builder
- ⬜ Partner performance reports
- ⬜ Export functionality
- ⬜ Scheduled reports

### PWA & Mobile

- ⬜ Service worker
- ⬜ Offline support (critical pages)
- ⬜ Push notifications
- ⬜ Install prompt

---

## Phase 4: Future (Backlog)

### AI Features

- ⬜ Ticket auto-categorization
- ⬜ Priority suggestion
- ⬜ Response suggestions
- ⬜ Sentiment analysis
- ⬜ Chatbot (first-line)

### Advanced

- ⬜ Multi-language support
- ⬜ Native mobile app
- ⬜ Client health scoring
- ⬜ Status page (per tenant)
- ⬜ Advanced automation rules

---

## Backlog (Unprioritized)

- ⬜ Two-factor authentication (TOTP)
- ⬜ SMS notifications (Twilio)
- ⬜ SSO / SAML integration
- ⬜ Advanced permission editor
- ⬜ Recurring invoices
- ⬜ Payment plans
- ⬜ ACH payments
- ⬜ Multi-currency support
- ⬜ Approval workflows
- ⬜ Client onboarding automation
- ⬜ Referral tracking
- ⬜ Satisfaction surveys
- ⬜ NPS tracking
- ⬜ Data export (GDPR)
- ⬜ Account deletion (GDPR)
- ⬜ SOC 2 compliance prep

---

## Bugs / Issues

_No bugs logged yet_

---

## Technical Debt

_Track items to revisit_

| Item | Priority | Notes |
| ---- | -------- | ----- |
|      |          |       |

---

## Notes

### Decisions Log

| Date       | Decision                     | Rationale                             |
| ---------- | ---------------------------- | ------------------------------------- |
| 2026-01-20 | Next.js + Supabase stack     | Transition to v2 for speed and scale  |
| 2026-01-20 | Mobile-first design          | Primary user base expected on mobile  |
| 2026-01-20 | Partners cannot create forms | Simplify initial scope, admin control |
| 2026-01-20 | 30-day audit retention       | Balance compliance with storage costs |
| 2026-01-20 | 5GB default storage          | Reasonable for most clients           |

### Blockers

_None currently_

### Dependencies

| Dependency                     | Status | Owner |
| ------------------------------ | ------ | ----- |
| AWS S3 setup                   | ⬜     | TBD   |
| Stripe account                 | ⬜     | TBD   |
| Domain (portal.kre8ivtech.com) | ⬜     | TBD   |
| SendGrid account               | ⬜     | TBD   |

---

_Task list for KT-Portal Project_

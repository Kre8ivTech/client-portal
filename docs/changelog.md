# Kre8ivTech Client Portal
## Changelog

All notable changes to the project documentation and specifications will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2.0.0] - 2026-01-20

### Added
- **Consolidated PRD** — Merged all requirements into single comprehensive document
- **Technical Specification** — Full tech stack, database schema, API spec
- **Project Structure** — Organized docs folder with prd.md, tech.md, changelog.md, todo.md, scratchpad.md

### Documentation Structure
```
kt-portal/
├── docs/
│   ├── prd.md          # Product Requirements Document
│   ├── tech.md         # Technical Specifications
│   ├── changelog.md    # This file
│   ├── todo.md         # Task tracking
│   └── scratchpad.md   # Working notes
```

---

## [1.2.0] - 2026-01-20

### Added
- **Form Builder Module** — Full specification with 25+ field types
- **Conditional Logic** — Show/hide, skip, calculate based on answers
- **Notification Center** — Unified inbox with user preferences
- **Global Search** — Cmd+K universal search across all modules
- **Announcement System** — Broadcast to clients, partners, or everyone
- **Audit Logging** — 30-day retention, all sensitive actions tracked
- **Task Management** — Internal tasks separate from client tickets
- **Email Integration** — Email-to-ticket, reply via email
- **Custom Fields** — Extensibility per entity type
- **Saved Views & Bulk Actions** — Power user features
- **Client Onboarding Workflow** — Structured onboarding process
- **Time Tracking** — Internal only (staff/admin visibility)
- **SLA Management** — Formal definitions and tracking
- **Approval Workflows** — For invoices, contracts over threshold
- **Calendar/Scheduling** — Integration roadmap
- **File/Asset Management** — Central repository specification
- **Client Segmentation & Tags** — For targeting and reporting
- **Webhooks & API** — External integration specification

### Changed
- **Timeline Extended** — MVP now 12-16 weeks (was 10-14)
- **Phase 2** — Now 10-12 weeks with additional modules
- **Phase 3** — Now 10-12 weeks with API and integrations

### Decisions Made
- Form creation restricted to Admin/Staff only (partners cannot create)
- Email domains: use existing
- Time tracking: internal only
- Audit log retention: 30 days

---

## [1.1.0] - 2026-01-20

### Added
- **Knowledge Base / Wiki System** — Multi-tenant, access-controlled articles
- **Contract & Proposal Generation** — Template system with e-signature
- **Live Agent Chat** — Real-time support with queue management
- **Messaging System** — Async threaded conversations
- **Partner Work Volume Tracking** — Metrics without commission

### Changed
- **Ticket Queue Visibility** — Clients now see position in queue
- **Partner Ticket View** — Partners see all their clients' tickets
- **Payment Terms** — Fully admin-configurable
- **Design Approach** — Changed to mobile-first

### Decisions Made
- Partner portal access: free with relationship
- Partners see client tickets: yes
- Clients see queue position: yes
- Payment terms: admin-configurable
- Partner commission: none (track volume only)
- Knowledge base: yes, for all roles
- Contracts/proposals: required
- Design: mobile-first
- Live chat: required

---

## [1.0.0] - 2026-01-20

### Added
- **Initial Requirements Document** — First draft of portal requirements
- **User Roles** — Super Admin, Staff, Partner, Partner Staff, Client
- **Permission Matrix** — Role-based access control
- **Trouble Ticket System** — Core ticketing functionality
- **Service Request System** — Request types and workflow
- **Invoicing System** — Basic invoicing with Stripe
- **Project Feedback System** — Milestone reviews
- **White Label & Branding** — Partner customization
- **Dashboard Specifications** — Four dashboard types
- **Technical Architecture Options** — Three stack options evaluated
- **Database Schema** — High-level entity design
- **Integration Points** — Required and optional integrations
- **Security Requirements** — Auth, data protection, app security
- **MVP Scope** — Phase 1 features defined
- **Phased Rollout** — Three-phase approach

### Technical Decisions
- Recommended stack: FastAPI + PostgreSQL + React
- Rejected: WordPress Multisite (scalability concerns)
- Rejected: Hybrid approach (complexity)

---

## [Unreleased]

### Added
- **Invoice client picker** (2026-09-08) — Admin/new-invoice now lists every billable client in scope: super admins see all clients; account-manager staff and partner (parent-org) admins see their own organization plus child-org clients. Search is available when the list is long.
- **QuickBooks Online** (2026-09-08) — Admins can connect QuickBooks via OAuth, store tokens encrypted, sync customers, and push invoices (and payments) to QuickBooks. Optional auto-sync on invoice create.

### Fixed
- **Invoice detail for billed clients** (2026-09-08) — Viewers billed on an invoice (and others in that client org) can open `/dashboard/invoices/[id]` even when the invoice is stored on the issuer org. The page now shows billed-to.
- **Partner New Invoice** (2026-09-08) — `/dashboard/invoices` shows New Invoice for roles that can create invoices, including partner/parent-org admins.
- **QuickBooks navigation** (2026-09-08) — Settings → Integrations goes to org QuickBooks (`/dashboard/settings/integrations`). Super admins also get Admin → Integration Settings (QB app credentials) and Platform Integrations (Stripe/AI/S3).
- **Invoice detail links** (2026-09-08) — Admin invoice cards and Financials invoicing now link to `/dashboard/invoices/[id]`.
- **Child-org user visibility** (2026-09-08) — Partners and account managers can SELECT users/profiles in child organizations so invoicing is not limited to the admin's own org.
- **Admin Password Reset Delivery** (2026-08-24) — Routed client recovery emails through the client organization’s configured email provider, added a usable fallback message when no password-reset template exists, and stopped reporting success when delivery fails.
- **Client Deactivation** (2026-08-24) — Allowed super admins to deactivate clients when optional white-label custom-domain columns are unavailable in the deployed database schema.
- **Auth Settings Logging** (2026-02-10) — Improved error handling for missing authentication settings columns. Changed log level from WARN to INFO when columns don't exist in preview/staging environments. Migration `20260204140000_auth_sso_mfa_recaptcha.sql` adds required SSO, MFA, and reCAPTCHA columns and will be applied automatically on next production deployment.

### Planned
- Wireframes and UI mockups
- Database ERD diagram
- API endpoint implementation details
- Sprint planning breakdown
- Infrastructure setup guide
- Development environment setup
- CI/CD pipeline configuration

### Under Consideration
- Native mobile app (React Native)
- AI-powered ticket triage
- Multi-language support
- SOC 2 compliance
- Status page per tenant

---

## Version Numbering

- **Major (X.0.0)** — Significant restructure or milestone
- **Minor (0.X.0)** — New features or modules added
- **Patch (0.0.X)** — Bug fixes, clarifications, minor updates

---

## Contributors

- Kre8ivTech, LLC — Product ownership
- Claude (Anthropic) — Documentation and planning assistance

---

*Changelog for KT-Portal Project*

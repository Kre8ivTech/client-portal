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

### Updated
- Roadmap status section in docs/todo.md aligned to repository implementation

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

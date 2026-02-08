# Kre8ivTech.com — Site Brief for Claude Code

## Overview

Rebuild kre8ivtech.com as a modern Next.js site deployed on the Kre8ivTech platform (GCP Cloud Run). This is the first client site on the platform and serves as both the company marketing site and proof of concept.

This site lives in a **separate repo** from the dashboard: `Kre8ivTech/kre8ivtech-site`

---

## Design Direction

### Aesthetic
Modern, clean, developer-focused — inspired by:
- **Vercel** (vercel.com) — dark hero sections, clean typography, gradient accents
- **Supabase** (supabase.com) — dark backgrounds, neon accents, code-forward
- **Linear** (linear.app) — minimalist, fast feel, subtle animations

### Color Palette
| Role | Color | Usage |
|---|---|---|
| Primary Blue | `#4361ee` | CTAs, links, accents, gradients |
| Dark Blue | `#1a1a2e` | Headers, dark sections, footer |
| Navy | `#16213e` | Secondary dark backgrounds |
| Light Gray | `#f8f9fa` | Light section backgrounds |
| Medium Gray | `#6b7280` | Body text, secondary text |
| Dark Gray | `#1f2937` | Primary text on light backgrounds |
| White | `#ffffff` | Text on dark, card backgrounds |
| Accent Gradient | `#4361ee → #7c3aed` | Hero elements, feature highlights |

### Typography
- Headlines: Inter or Plus Jakarta Sans (bold, clean)
- Body: Inter (regular)
- Code/Tech: JetBrains Mono or Fira Code

### Key Design Elements
- Dark hero section with gradient accents
- Subtle grid/dot pattern backgrounds
- Glassmorphism cards where appropriate
- Smooth scroll animations (framer-motion)
- Code snippets / terminal UI elements to show technical credibility
- Responsive — mobile-first

---

## Logo
Logo is being redesigned separately. Use a **text logo placeholder** for now:
- "Kre8ivTech" in bold Inter/Plus Jakarta Sans
- Blue accent on "8" or as an underline/gradient
- Keep it simple so it's easy to swap later

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui (match dashboard setup) |
| Animations | framer-motion |
| CMS | Custom admin panel backed by Supabase |
| Payments | Stripe (subscriptions + one-time) |
| Hosting | GCP Cloud Run (Kre8ivTech platform) |
| Images | Next.js Image optimization |

---

## Pages

### Public Pages (Marketing)

#### Home (`/`)
- **Hero** — dark background, headline: "Cloud Hosting. Simplified." or similar, subtext about the platform, CTA to get started
- **Trusted By** — client logos or partner badges (M'Agency, Engage Hope, etc.)
- **Services Overview** — 3-4 feature cards (Cloud Hosting, Web Development, WordPress Care, Custom Apps)
- **How It Works** — 3-step visual (Design → Develop → Deploy)
- **Testimonials** — Kim Beechner (Embark Marketing), M'Agency quotes
- **Pricing Preview** — 3 tiers, link to full pricing page
- **CTA Section** — "Ready to launch?" with contact/signup button
- **Footer** — links, contact info, social media, veteran/minority-owned badge

#### Services (`/services`)
- Service cards with descriptions and pricing tiers:
  - Cloud Hosting (Kre8ivTech platform)
  - Managed WordPress Hosting (Kre8ivHosting)
  - Website Care & Maintenance
  - Custom Web Development
  - Custom Application Development
  - Mobile App Development
  - Security & Optimization
  - Plugin & Theme Development
  - Branding & Design

#### Pricing (`/pricing`)
- Pricing table with toggle (monthly/annual)
- Tiers pulled from CMS/Stripe products
- Feature comparison matrix
- FAQ section
- CTA to sign up or contact

#### Company (`/company`)
- About section — story of Kre8ivTech (founded by Jeremiah Castillo and Rick Murdock)
- Mission & Vision
- Team section with photos/bios
- Veteran, Christian, minority-owned badges
- San Antonio, TX location

#### Projects (`/projects`)
- Portfolio grid showing past work
- Filter by type (web, mobile, WordPress)
- Project detail pages with screenshots and description
- Content managed via CMS

#### Blog (`/blog`)
- Blog listing with featured post
- Blog post detail pages
- Categories/tags
- Content managed via CMS

#### Contact (`/contact`)
- Contact form (sends to info@kre8ivtech.com)
- Phone: (210) 570-9382
- Email: info@kre8ivtech.com
- Location: San Antonio, TX
- Optional: Calendly embed for booking calls

#### Partnerships (`/partnerships`)
- Partner information and benefits
- Partner application form

---

### Admin Panel (`/admin`) — CMS + Stripe Management

Protected by Supabase Auth. Only team members with `owner` or `admin` role can access.

#### Content Management
- `/admin` — Dashboard overview (recent posts, orders, site stats)
- `/admin/pages` — Edit page content (hero text, testimonials, team bios)
- `/admin/blog` — Create/edit/delete blog posts (rich text editor)
- `/admin/projects` — Manage portfolio items
- `/admin/media` — Image/file upload manager (Supabase Storage)

#### Package & Pricing Management
- `/admin/packages` — Create/edit service packages
- `/admin/packages/new` — Package builder (name, description, features, price, billing interval)
- `/admin/packages/[id]` — Edit package, sync with Stripe Product/Price

#### Order & Subscription Management
- `/admin/orders` — View all orders and subscriptions
- `/admin/orders/[id]` — Order detail, invoice, status
- `/admin/customers` — Customer list from Stripe

#### Settings
- `/admin/settings` — Site metadata, SEO defaults, contact info
- `/admin/settings/stripe` — Stripe connection status, webhook URL

---

## CMS Database Schema (Additional Supabase Tables)

```sql
-- Page content blocks (editable sections)
CREATE TABLE page_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_slug TEXT NOT NULL,
  section_key TEXT NOT NULL,
  content JSONB NOT NULL, -- flexible content structure
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(page_slug, section_key)
);

-- Blog posts
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL, -- markdown or HTML
  cover_image TEXT,
  author_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Portfolio projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  content TEXT, -- detailed writeup
  cover_image TEXT,
  images TEXT[] DEFAULT '{}',
  project_type TEXT CHECK (project_type IN ('web', 'mobile', 'wordpress', 'custom')),
  client_name TEXT,
  project_url TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Service packages (synced with Stripe)
CREATE TABLE packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  features JSONB DEFAULT '[]', -- array of feature strings
  price_monthly INTEGER, -- cents
  price_annual INTEGER, -- cents
  stripe_product_id TEXT,
  stripe_price_monthly_id TEXT,
  stripe_price_annual_id TEXT,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Customer orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  package_id UUID REFERENCES packages(id),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_payment_intent_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'cancelled', 'past_due', 'failed')),
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'annual', 'one_time')),
  amount INTEGER, -- cents
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Testimonials
CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name TEXT NOT NULL,
  author_title TEXT,
  author_company TEXT,
  author_image TEXT,
  quote TEXT NOT NULL,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Team members
CREATE TABLE team_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  title TEXT,
  bio TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contact form submissions
CREATE TABLE contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE page_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;

-- Public read access for published content
CREATE POLICY "Public can read published blog posts" ON blog_posts FOR SELECT
  USING (status = 'published');

CREATE POLICY "Public can read published projects" ON projects FOR SELECT
  USING (status = 'published');

CREATE POLICY "Public can read active packages" ON packages FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public can read testimonials" ON testimonials FOR SELECT
  USING (true);

CREATE POLICY "Public can read team profiles" ON team_profiles FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public can read page content" ON page_content FOR SELECT
  USING (true);

-- Public can submit contact forms
CREATE POLICY "Public can submit contact forms" ON contact_submissions FOR INSERT
  WITH CHECK (true);

-- Admin full access (via service role key in API routes)
-- Orders read by authenticated admins only
CREATE POLICY "Admins can view orders" ON orders FOR SELECT
  USING (auth.uid() IN (
    SELECT user_id FROM team_members WHERE role IN ('owner', 'admin')
  ));

-- Indexes
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_packages_slug ON packages(slug);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_contact_submissions_status ON contact_submissions(status);
```

---

## Stripe Integration

### Setup
- Create Stripe account (or use existing)
- Store keys in GCP Secret Manager: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Install: `npm install stripe @stripe/stripe-js`

### How It Works
1. Admin creates a package in `/admin/packages` → syncs to Stripe as Product + Price
2. Customer visits `/pricing` → selects package → Stripe Checkout session
3. Stripe webhook (`/api/webhooks/stripe`) updates order status in Supabase
4. Admin views orders/subscriptions in `/admin/orders`

### API Routes
- `POST /api/checkout` — create Stripe Checkout session
- `POST /api/webhooks/stripe` — handle Stripe webhooks (subscription created, payment succeeded, etc.)
- `GET /api/packages` — list active packages
- `POST /api/admin/packages` — create package + sync to Stripe
- `PATCH /api/admin/packages/[id]` — update package + sync to Stripe

---

## Deployment

### Repo Setup
```bash
# New repo for the marketing site
gh repo create Kre8ivTech/kre8ivtech-site --private
```

### Same Dockerfile pattern as dashboard
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

### Cloud Build trigger
- Trigger name: `deploy-kre8ivtech-site`
- Repo: `Kre8ivTech/kre8ivtech-site`
- Branch: `^main$`
- Cloud Run service: `kre8ivtech-site`

### DNS (Cloudflare)
- `CNAME` → `www.kre8ivtech.com` → `kre8ivtech-site-xxxxx-uc.a.run.app`
- `CNAME` → `kre8ivtech.com` → `kre8ivtech-site-xxxxx-uc.a.run.app`

---

## npm Dependencies

```bash
npm install stripe @stripe/stripe-js framer-motion @supabase/supabase-js @supabase/ssr
npm install -D @tailwindcss/typography
```

---

## Priority Order

### Phase 1: Marketing Site
1. Project scaffold (Next.js 16, same config as dashboard)
2. Layout — header, footer, dark/light sections
3. Home page — hero, services, testimonials, pricing preview, CTA
4. Services page
5. Company page
6. Contact page with form
7. Projects page (static initially)
8. Blog listing + detail pages

### Phase 2: CMS Admin
9. Admin layout with sidebar
10. Blog post editor (rich text / markdown)
11. Projects manager
12. Testimonials manager
13. Page content editor
14. Team profiles manager
15. Media manager (Supabase Storage)

### Phase 3: Stripe + Packages
16. Package builder in admin
17. Stripe product/price sync
18. Public pricing page with Stripe Checkout
19. Webhook handler
20. Order management in admin
21. Customer portal link

---

## What to Tell Claude Code

```
Also build kre8ivtech.com as a separate repo (kre8ivtech-site) alongside the dashboard.
Read SITE-BRIEF.md for full specs.

This is the first client site on the Kre8ivTech platform.
Same Next.js 16 + shadcn/ui + Supabase + Tailwind setup as the dashboard.
Add framer-motion for animations and stripe for payments.

Design: modern dark theme like Vercel/Supabase sites. Blue (#4361ee) and gray palette.
Use a text placeholder for the logo.

Start with the public marketing pages (home, services, company, contact).
Then build the CMS admin panel.
Then add Stripe integration.

The CMS schema goes in the same Supabase project as the dashboard.
Separate Cloud Run service, separate repo, separate Cloud Build trigger.
```

-- Capability agents, skills, and tasks for each portal feature.
-- Seeded from src/lib/ai/capability-catalog.ts. Re-apply updates matching slugs.

CREATE TABLE IF NOT EXISTS public.ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capability_slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  instruction TEXT NOT NULL,
  href TEXT NOT NULL,
  roles TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, slug)
);

CREATE TABLE IF NOT EXISTS public.ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  starter_prompt TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_active ON public.ai_agents(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_skills_agent ON public.ai_skills(agent_id);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_agent ON public.ai_tasks(agent_id);

ALTER TABLE public.ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read capability agents" ON public.ai_agents;
CREATE POLICY "Users can read capability agents"
  ON public.ai_agents FOR SELECT
  USING (
    is_active = true
    AND (
      public.is_admin_or_staff()
      OR (SELECT role FROM public.users WHERE id = auth.uid()) = ANY (roles)
    )
  );

DROP POLICY IF EXISTS "Staff can manage capability agents" ON public.ai_agents;
CREATE POLICY "Staff can manage capability agents"
  ON public.ai_agents FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Users can read capability skills" ON public.ai_skills;
CREATE POLICY "Users can read capability skills"
  ON public.ai_skills FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.ai_agents a
      WHERE a.id = agent_id
        AND a.is_active = true
        AND (
          public.is_admin_or_staff()
          OR (SELECT role FROM public.users WHERE id = auth.uid()) = ANY (a.roles)
        )
    )
  );

DROP POLICY IF EXISTS "Staff can manage capability skills" ON public.ai_skills;
CREATE POLICY "Staff can manage capability skills"
  ON public.ai_skills FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Users can read capability tasks" ON public.ai_tasks;
CREATE POLICY "Users can read capability tasks"
  ON public.ai_tasks FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.ai_agents a
      WHERE a.id = agent_id
        AND a.is_active = true
        AND (
          public.is_admin_or_staff()
          OR (SELECT role FROM public.users WHERE id = auth.uid()) = ANY (a.roles)
        )
    )
  );

DROP POLICY IF EXISTS "Staff can manage capability tasks" ON public.ai_tasks;
CREATE POLICY "Staff can manage capability tasks"
  ON public.ai_tasks FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

INSERT INTO public.ai_agents (capability_slug, name, description, instruction, href, roles, display_order)
VALUES
  ('tickets', 'Tickets', 'Open, track, and reply to support tickets.', 'Help the user open a ticket, choose a priority, follow status, and reply in the thread. Do not invent ticket numbers or statuses.', '/dashboard/tickets', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 1),
  ('messages', 'Messages', 'Portal messages and live chat.', 'Help the user find conversations and start a message. Live chat is the separate button at the bottom of the screen. Do not invent message contents.', '/dashboard/messages', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 2),
  ('projects', 'Projects', 'Project dashboard, tasks, timeline, and forum.', 'Help the user open projects, project tasks, the timeline, and the project forum. Do not invent task owners or dates.', '/dashboard/projects', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 3),
  ('contracts', 'Contracts', 'Review and sign contracts.', 'Help the user find contracts and understand the signing flow. Do not draft legal terms or claim a contract is signed.', '/dashboard/contracts', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 4),
  ('files', 'Files', 'Shared organization file storage.', 'Help the user open file storage and upload or download files that belong to their organization.', '/dashboard/files', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 5),
  ('knowledge-base', 'Knowledge base', 'Published help articles and the staff user guide.', 'Point the user to published knowledge base articles. Staff and super admins can also use the user guide at /dashboard/user-guide.', '/dashboard/kb', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 6),
  ('invoices', 'Invoices', 'Invoices and payment status.', 'Help the user find invoices and payment status. Do not invent amounts, due dates, or payment results.', '/dashboard/invoices', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 7),
  ('billing', 'Billing', 'Billing and service plans for the account.', 'Help the user open billing and plans. Do not change a subscription or quote a price that is not on the page.', '/dashboard/billing', ARRAY['client', 'partner', 'staff', 'super_admin']::text[], 8),
  ('services', 'Services', 'Current services, requests, and the service catalog.', 'Everyone can review current services and submit a service request. Partners and staff can also browse the service catalog and plans. Do not invent pricing.', '/dashboard/services/current', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 9),
  ('vault', 'Password vault', 'Store shared logins for the organization.', 'Help the user open the password vault. Never ask them to paste a password into chat and never repeat a secret.', '/dashboard/vault', ARRAY['client', 'partner', 'staff', 'super_admin']::text[], 10),
  ('profile', 'Profile', 'Profile details and account security.', 'Help the user update their profile. Password and session security live at /dashboard/settings/security.', '/dashboard/profile', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 11),
  ('notifications', 'Notifications', 'Notification preferences.', 'Help the user change notification preferences. Do not claim a notification was sent.', '/dashboard/settings/notifications', ARRAY['client', 'partner', 'partner_staff', 'staff', 'super_admin']::text[], 12),
  ('white-label', 'White label', 'Partner brand for the partner team and their clients.', 'Help a partner set the portal name, tagline, and colors that their team and child clients see after sign-in. A verified custom domain shows that brand on the agency hostname, including sign-in. Partner staff cannot edit the brand.', '/dashboard/settings/white-label', ARRAY['partner', 'super_admin']::text[], 13),
  ('google-ads', 'Google Ads', 'Google Ads reporting for partner organizations.', 'Help the user open Google Ads reporting. Do not invent spend, clicks, or campaign results.', '/dashboard/google-ads', ARRAY['partner', 'partner_staff']::text[], 14),
  ('partner-overview', 'Partner overview', 'Portfolio of child clients, sites, ads, financials, and projects.', 'Help the partner use the portfolio: clients, ads, site monitoring, client financials, and the project board. Do not invent client metrics.', '/dashboard/partner-overview', ARRAY['partner', 'partner_staff']::text[], 15),
  ('financials', 'Financials', 'Invoicing, receivables, time, subscriptions, cash, budgets, and reports.', 'Help staff open invoicing, receivables, time and utilization, subscriptions, cash, budgets, and financial reports. Do not invent revenue figures.', '/dashboard/financials', ARRAY['staff', 'super_admin']::text[], 16),
  ('platform-integrations', 'Platform integrations', 'Stripe, AI providers, email, calendars, storage, and Zapier.', 'Help a super admin connect Stripe, AI providers, email, calendars, storage, and Zapier. Never ask them to paste a live secret into chat. Tell them to enter keys on the integrations page.', '/dashboard/integrations', ARRAY['super_admin']::text[], 17),
  ('organization-integrations', 'Organization integrations', 'Organization connections such as QuickBooks.', 'Help connect organization integrations such as QuickBooks. Account-manager staff, partners, and super admins use this page. Platform-wide keys stay on the platform integrations page.', '/dashboard/settings/integrations', ARRAY['partner', 'staff', 'super_admin']::text[], 18),
  ('clients', 'Clients', 'Client organizations in the user''s scope.', 'Help the user open the client list in their scope. Partners see their child clients. Do not invent client records.', '/dashboard/clients', ARRAY['partner', 'staff', 'super_admin']::text[], 19),
  ('email-templates', 'Email templates', 'Notification and invoice email templates.', 'Help staff find and edit email templates. Do not send email from chat.', '/dashboard/settings/email-templates', ARRAY['staff', 'super_admin']::text[], 20)
ON CONFLICT (capability_slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  instruction = EXCLUDED.instruction,
  href = EXCLUDED.href,
  roles = EXCLUDED.roles,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.ai_skills (agent_id, slug, name, description, display_order)
SELECT a.id, v.slug, v.name, v.description, v.display_order
FROM (VALUES
  ('tickets', 'open-ticket', 'Open a ticket', 'Explain the fields needed to submit a support ticket.', 1),
  ('tickets', 'track-status', 'Track status', 'Point the user to the ticket list and status filters.', 2),
  ('tickets', 'reply', 'Reply on a ticket', 'Explain how to add a comment on an existing ticket.', 3),
  ('messages', 'find-messages', 'Find messages', 'Direct the user to the messages inbox.', 1),
  ('messages', 'start-conversation', 'Start a conversation', 'Explain how to begin a new portal conversation.', 2),
  ('projects', 'project-dashboard', 'Project dashboard', 'Open the project list and a project overview.', 1),
  ('projects', 'project-tasks', 'Project tasks', 'Explain the project tasks page.', 2),
  ('projects', 'timeline', 'Timeline', 'Point the user to the project timeline.', 3),
  ('projects', 'forum', 'Project forum', 'Explain the project communication forum.', 4),
  ('contracts', 'find-contract', 'Find a contract', 'Open the contracts list.', 1),
  ('contracts', 'signing', 'Signing status', 'Explain where a user reviews and signs a contract.', 2),
  ('files', 'browse-files', 'Browse files', 'Open the storage page.', 1),
  ('files', 'upload-file', 'Upload a file', 'Explain how to add a file to storage.', 2),
  ('knowledge-base', 'search-articles', 'Search articles', 'Help the user look through the knowledge base.', 1),
  ('knowledge-base', 'user-guide', 'User guide', 'Staff can open the in-app user guide for portal workflows.', 2),
  ('invoices', 'find-invoice', 'Find an invoice', 'Open the invoice list.', 1),
  ('invoices', 'payment-status', 'Payment status', 'Explain where payment status is shown.', 2),
  ('billing', 'view-plan', 'View plan', 'Explain where the current plan is shown.', 1),
  ('billing', 'billing-page', 'Billing page', 'Open billing and plan details.', 2),
  ('services', 'current-services', 'Current services', 'Open the services already assigned to the account.', 1),
  ('services', 'request-service', 'Request a service', 'Explain how to submit a service request.', 2),
  ('services', 'catalog', 'Service catalog', 'Partners and staff can browse the catalog of offered services.', 3),
  ('vault', 'open-vault', 'Open the vault', 'Direct the user to the vault page.', 1),
  ('vault', 'store-login', 'Store a login', 'Explain that logins are saved in the vault, not in chat.', 2),
  ('profile', 'edit-profile', 'Edit profile', 'Explain how to update name and profile details.', 1),
  ('profile', 'security', 'Security settings', 'Point the user to password and security settings.', 2),
  ('notifications', 'preferences', 'Notification settings', 'Open notification preferences.', 1),
  ('notifications', 'email-alerts', 'Email alerts', 'Explain that email alerts follow the preferences on that page.', 2),
  ('white-label', 'brand-identity', 'Brand identity', 'Explain name, tagline, logo, and primary color.', 1),
  ('white-label', 'custom-domain', 'Custom domain', 'Explain that a verified domain brands the sign-in host.', 2),
  ('google-ads', 'ads-overview', 'Ads overview', 'Open the partner ads overview and Google Ads page.', 1),
  ('google-ads', 'campaign-questions', 'Campaign questions', 'Explain which screens show campaign reporting.', 2),
  ('partner-overview', 'client-portfolio', 'Client portfolio', 'Open the list of child clients.', 1),
  ('partner-overview', 'site-monitoring', 'Site monitoring', 'Open monitored sites.', 2),
  ('partner-overview', 'client-financials', 'Client financials', 'Open financials for child clients.', 3),
  ('financials', 'invoicing', 'Invoicing', 'Open invoicing and revenue.', 1),
  ('financials', 'receivables', 'Receivables', 'Open accounts receivable.', 2),
  ('financials', 'time', 'Time and utilization', 'Open time tracking and utilization.', 3),
  ('financials', 'reports', 'Reports', 'Open financial reports.', 4),
  ('platform-integrations', 'ai-providers', 'AI providers', 'Configure OpenRouter, Anthropic, OpenAI, or Gemini.', 1),
  ('platform-integrations', 'payments', 'Payments', 'Connect Stripe for invoices.', 2),
  ('platform-integrations', 'email', 'Email', 'Configure SMTP or Resend for notifications.', 3),
  ('platform-integrations', 'storage', 'Storage', 'Configure S3 for files and contracts.', 4),
  ('organization-integrations', 'quickbooks', 'QuickBooks', 'Open the organization integration settings for accounting.', 1),
  ('clients', 'client-list', 'Client list', 'Open the clients the user is allowed to see.', 1),
  ('clients', 'client-access', 'Client access', 'Explain that visibility follows the user''s organization and role.', 2),
  ('email-templates', 'find-template', 'Find a template', 'Open the email template list.', 1),
  ('email-templates', 'edit-copy', 'Edit template copy', 'Explain that template content is edited on that page.', 2)
) AS v(capability_slug, slug, name, description, display_order)
JOIN public.ai_agents a ON a.capability_slug = v.capability_slug
ON CONFLICT (agent_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.ai_tasks (agent_id, slug, name, description, starter_prompt, display_order)
SELECT a.id, v.slug, v.name, v.description, v.starter_prompt, v.display_order
FROM (VALUES
  ('tickets', 'submit-ticket', 'Submit a ticket', 'How do I submit a support ticket?', 'How do I submit a support ticket?', 1),
  ('tickets', 'ticket-status', 'Check ticket status', 'Where do I see the status of my tickets?', 'Where do I see the status of my tickets?', 2),
  ('messages', 'open-inbox', 'Open messages', 'Where are my messages?', 'Where are my messages?', 1),
  ('messages', 'message-team', 'Message the team', 'How do I message my team?', 'How do I message my team?', 2),
  ('projects', 'see-projects', 'See projects', 'How do I see my projects?', 'How do I see my projects?', 1),
  ('projects', 'project-tasks', 'Project tasks and timeline', 'Where are project tasks and the timeline?', 'Where are project tasks and the timeline?', 2),
  ('contracts', 'review-contracts', 'Review contracts', 'Where do I review my contracts?', 'Where do I review my contracts?', 1),
  ('contracts', 'sign-contract', 'Sign a contract', 'How do I sign a contract?', 'How do I sign a contract?', 2),
  ('files', 'shared-files', 'Find shared files', 'Where are shared files?', 'Where are shared files?', 1),
  ('files', 'upload', 'Upload a file', 'How do I upload a file?', 'How do I upload a file?', 2),
  ('knowledge-base', 'open-kb', 'Open the knowledge base', 'Where is the knowledge base?', 'Where is the knowledge base?', 1),
  ('knowledge-base', 'find-article', 'Find a help article', 'How do I find a help article?', 'How do I find a help article?', 2),
  ('invoices', 'see-invoices', 'See invoices', 'Where are my invoices?', 'Where are my invoices?', 1),
  ('invoices', 'pay-invoice', 'Pay an invoice', 'How do I pay an invoice?', 'How do I pay an invoice?', 2),
  ('billing', 'see-plan', 'See the plan', 'Where do I see my plan?', 'Where do I see my plan?', 1),
  ('billing', 'open-billing', 'Open billing', 'How do I open billing?', 'How do I open billing?', 2),
  ('services', 'my-services', 'My services', 'What services do I have?', 'What services do I have?', 1),
  ('services', 'request', 'Request a service', 'How do I request a service?', 'How do I request a service?', 2),
  ('vault', 'find-vault', 'Find the vault', 'Where is the password vault?', 'Where is the password vault?', 1),
  ('vault', 'store-login', 'Store a login', 'How should I store a login?', 'How should I store a login?', 2),
  ('profile', 'update-profile', 'Update profile', 'How do I update my profile?', 'How do I update my profile?', 1),
  ('profile', 'change-password', 'Change password', 'Where do I change my password?', 'Where do I change my password?', 2),
  ('notifications', 'change-notifications', 'Change notifications', 'How do I change notification settings?', 'How do I change notification settings?', 1),
  ('white-label', 'how-branding-works', 'How branding works', 'How does white label branding work?', 'How does white label branding work?', 1),
  ('white-label', 'set-brand', 'Set portal brand', 'Where do I set my portal name and colors?', 'Where do I set my portal name and colors?', 2),
  ('google-ads', 'open-ads', 'Open Google Ads', 'Where do I see Google Ads?', 'Where do I see Google Ads?', 1),
  ('google-ads', 'ads-overview', 'Ads overview', 'What does the ads overview include?', 'What does the ads overview include?', 2),
  ('partner-overview', 'portfolio', 'Client portfolio', 'Where is my client portfolio?', 'Where is my client portfolio?', 1),
  ('partner-overview', 'sites', 'Site monitoring', 'How do I open site monitoring?', 'How do I open site monitoring?', 2),
  ('financials', 'reports', 'Financial reports', 'Where are financial reports?', 'Where are financial reports?', 1),
  ('financials', 'receivables', 'Accounts receivable', 'How do I open accounts receivable?', 'How do I open accounts receivable?', 2),
  ('platform-integrations', 'configure-ai', 'Configure AI providers', 'Where do I configure AI providers?', 'Where do I configure AI providers?', 1),
  ('platform-integrations', 'connect-stripe', 'Connect Stripe', 'How do I connect Stripe?', 'How do I connect Stripe?', 2),
  ('organization-integrations', 'org-integrations', 'Organization integrations', 'Where do I connect QuickBooks?', 'Where do I connect QuickBooks?', 1),
  ('clients', 'manage-clients', 'Manage clients', 'Where do I manage clients?', 'Where do I manage clients?', 1),
  ('email-templates', 'open-templates', 'Open email templates', 'Where are email templates?', 'Where are email templates?', 1)
) AS v(capability_slug, slug, name, description, starter_prompt, display_order)
JOIN public.ai_agents a ON a.capability_slug = v.capability_slug
ON CONFLICT (agent_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  starter_prompt = EXCLUDED.starter_prompt,
  display_order = EXCLUDED.display_order,
  is_active = true,
  updated_at = NOW();

-- Global knowledge the assistant can quote for each capability.
INSERT INTO public.ai_documents (organization_id, title, content, document_type)
SELECT NULL, v.title, v.content, v.document_type
FROM (VALUES
  ('Tickets', 'Open, track, and reply to support tickets.

Open /dashboard/tickets. Help the user open a ticket, choose a priority, follow status, and reply in the thread. Do not invent ticket numbers or statuses.', 'capability'),
  ('Messages', 'Portal messages and live chat.

Open /dashboard/messages. Help the user find conversations and start a message. Live chat is the separate button at the bottom of the screen. Do not invent message contents.', 'capability'),
  ('Projects', 'Project dashboard, tasks, timeline, and forum.

Open /dashboard/projects. Help the user open projects, project tasks, the timeline, and the project forum. Do not invent task owners or dates.', 'capability'),
  ('Contracts', 'Review and sign contracts.

Open /dashboard/contracts. Help the user find contracts and understand the signing flow. Do not draft legal terms or claim a contract is signed.', 'capability'),
  ('Files', 'Shared organization file storage.

Open /dashboard/files. Help the user open file storage and upload or download files that belong to their organization.', 'capability'),
  ('Knowledge base', 'Published help articles and the staff user guide.

Open /dashboard/kb. Point the user to published knowledge base articles. Staff and super admins can also use the user guide at /dashboard/user-guide.', 'capability'),
  ('Invoices', 'Invoices and payment status.

Open /dashboard/invoices. Help the user find invoices and payment status. Do not invent amounts, due dates, or payment results.', 'capability'),
  ('Billing', 'Billing and service plans for the account.

Open /dashboard/billing. Help the user open billing and plans. Do not change a subscription or quote a price that is not on the page.', 'capability'),
  ('Services', 'Current services, requests, and the service catalog.

Open /dashboard/services/current. Everyone can review current services and submit a service request. Partners and staff can also browse the service catalog and plans. Do not invent pricing.', 'capability'),
  ('Password vault', 'Store shared logins for the organization.

Open /dashboard/vault. Help the user open the password vault. Never ask them to paste a password into chat and never repeat a secret.', 'capability'),
  ('Profile', 'Profile details and account security.

Open /dashboard/profile. Help the user update their profile. Password and session security live at /dashboard/settings/security.', 'capability'),
  ('Notifications', 'Notification preferences.

Open /dashboard/settings/notifications. Help the user change notification preferences. Do not claim a notification was sent.', 'capability'),
  ('White label', 'Partner brand for the partner team and their clients.

Open /dashboard/settings/white-label. Help a partner set the portal name, tagline, and colors that their team and child clients see after sign-in. A verified custom domain shows that brand on the agency hostname, including sign-in. Partner staff cannot edit the brand.', 'capability'),
  ('Google Ads', 'Google Ads reporting for partner organizations.

Open /dashboard/google-ads. Help the user open Google Ads reporting. Do not invent spend, clicks, or campaign results.', 'capability'),
  ('Partner overview', 'Portfolio of child clients, sites, ads, financials, and projects.

Open /dashboard/partner-overview. Help the partner use the portfolio: clients, ads, site monitoring, client financials, and the project board. Do not invent client metrics.', 'capability'),
  ('Financials', 'Invoicing, receivables, time, subscriptions, cash, budgets, and reports.

Open /dashboard/financials. Help staff open invoicing, receivables, time and utilization, subscriptions, cash, budgets, and financial reports. Do not invent revenue figures.', 'capability'),
  ('Platform integrations', 'Stripe, AI providers, email, calendars, storage, and Zapier.

Open /dashboard/integrations. Help a super admin connect Stripe, AI providers, email, calendars, storage, and Zapier. Never ask them to paste a live secret into chat. Tell them to enter keys on the integrations page.', 'capability'),
  ('Organization integrations', 'Organization connections such as QuickBooks.

Open /dashboard/settings/integrations. Help connect organization integrations such as QuickBooks. Account-manager staff, partners, and super admins use this page. Platform-wide keys stay on the platform integrations page.', 'capability'),
  ('Clients', 'Client organizations in the user''s scope.

Open /dashboard/clients. Help the user open the client list in their scope. Partners see their child clients. Do not invent client records.', 'capability'),
  ('Email templates', 'Notification and invoice email templates.

Open /dashboard/settings/email-templates. Help staff find and edit email templates. Do not send email from chat.', 'capability')
) AS v(title, content, document_type)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_documents d
  WHERE d.organization_id IS NULL
    AND d.document_type = 'capability'
    AND d.title = v.title
);

-- Global rules are readable by every signed-in user.
DROP POLICY IF EXISTS "Users can view org rules" ON public.ai_rules;
CREATE POLICY "Users can view org rules"
  ON public.ai_rules FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id IN (
      SELECT organization_id FROM public.users WHERE id = auth.uid()
    )
  );

INSERT INTO public.ai_rules (organization_id, rule_name, rule_content, priority, is_active)
SELECT NULL, v.rule_name, v.rule_content, v.priority, true
FROM (VALUES
  ('Stay inside the portal', 'Answer only about this client portal. Refuse general coding, homework, and unrelated creative work.', 100),
  ('Do not invent account data', 'Do not invent ticket numbers, invoice amounts, payment results, campaign metrics, or client records.', 90),
  ('Respect role access', 'Describe only the capability agents available to the signed-in role. Do not explain admin or partner tools to a client.', 80),
  ('Never collect secrets', 'Do not ask the user to paste passwords, API keys, or vault secrets into chat.', 70)
) AS v(rule_name, rule_content, priority)
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_rules r
  WHERE r.organization_id IS NULL
    AND r.rule_name = v.rule_name
);

INSERT INTO public.ai_configs (organization_id, role, system_prompt, is_active)
SELECT NULL, 'client', 'You help a client use this portal. Guide them through tickets, messages, projects, contracts, files, the knowledge base, invoices, billing, services, the password vault, profile, and notifications. Use plain language. Do not describe staff, partner, or admin tools.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_configs WHERE organization_id IS NULL AND role = 'client'
);

INSERT INTO public.ai_configs (organization_id, role, system_prompt, is_active)
SELECT NULL, 'partner', 'You help a white-label partner run their agency portal. They can brand the portal for their team and child clients, review their client portfolio, Google Ads, sites, and client financials, and use the same client tools their customers use. Do not describe platform-wide provider keys.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_configs WHERE organization_id IS NULL AND role = 'partner'
);

INSERT INTO public.ai_configs (organization_id, role, system_prompt, is_active)
SELECT NULL, 'partner_staff', 'You help a partner staff member work in a white-label portal. They can use the client portfolio, Google Ads, sites, messages, tickets, projects, and invoices. They cannot edit the partner brand or platform integrations.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_configs WHERE organization_id IS NULL AND role = 'partner_staff'
);

INSERT INTO public.ai_configs (organization_id, role, system_prompt, is_active)
SELECT NULL, 'staff', 'You help a staff member support clients. Cover tickets, projects, contracts, services, invoices, financials, clients, email templates, and organization integrations. Do not invent account data.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_configs WHERE organization_id IS NULL AND role = 'staff'
);

INSERT INTO public.ai_configs (organization_id, role, system_prompt, is_active)
SELECT NULL, 'super_admin', 'You help a super admin operate the portal. Cover every client and staff capability plus platform integrations, tenants, white label, and AI provider setup. Never ask for a secret in chat.', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_configs WHERE organization_id IS NULL AND role = 'super_admin'
);

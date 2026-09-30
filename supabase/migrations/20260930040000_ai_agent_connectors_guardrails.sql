-- Connectors and guardrails that can be added to a capability agent.

CREATE TABLE IF NOT EXISTS public.ai_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_agent_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  connector_id UUID NOT NULL REFERENCES public.ai_connectors(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, connector_id)
);

CREATE TABLE IF NOT EXISTS public.ai_guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  instruction TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'block' CHECK (severity IN ('block', 'warn')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_agent_guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  guardrail_id UUID NOT NULL REFERENCES public.ai_guardrails(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, guardrail_id)
);

ALTER TABLE public.ai_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_guardrails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_guardrails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage connectors" ON public.ai_connectors;
CREATE POLICY "Staff manage connectors"
  ON public.ai_connectors FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Staff manage agent connectors" ON public.ai_agent_connectors;
CREATE POLICY "Staff manage agent connectors"
  ON public.ai_agent_connectors FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Staff manage guardrails" ON public.ai_guardrails;
CREATE POLICY "Staff manage guardrails"
  ON public.ai_guardrails FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

DROP POLICY IF EXISTS "Staff manage agent guardrails" ON public.ai_agent_guardrails;
CREATE POLICY "Staff manage agent guardrails"
  ON public.ai_agent_guardrails FOR ALL
  USING (public.is_admin_or_staff())
  WITH CHECK (public.is_admin_or_staff());

INSERT INTO public.ai_connectors (slug, name, description, category)
VALUES
  ('tickets', 'Tickets', 'Read and guide work on support tickets.', 'portal'),
  ('messages', 'Messages', 'Guide portal conversations and live chat.', 'portal'),
  ('projects', 'Projects', 'Open projects, tasks, timelines, and the forum.', 'portal'),
  ('contracts', 'Contracts', 'Find contracts and explain signing status.', 'portal'),
  ('file-storage', 'File storage', 'Open organization files and storage settings.', 'storage'),
  ('knowledge-base', 'Knowledge base', 'Use published help articles.', 'portal'),
  ('invoices', 'Invoices', 'Find invoices and payment status.', 'portal'),
  ('stripe', 'Stripe', 'Payment collection for invoices. Do not handle card numbers in chat.', 'payments'),
  ('email', 'Email', 'Notification and template email. Do not send mail from chat.', 'email'),
  ('calendar', 'Calendar', 'Google and Microsoft calendar connections.', 'calendar'),
  ('quickbooks', 'QuickBooks', 'Organization accounting connection.', 'accounting'),
  ('google-ads', 'Google Ads', 'Partner ads reporting. Do not invent metrics.', 'ads')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.ai_guardrails (slug, name, instruction, severity)
VALUES
  ('no-invented-data', 'Do not invent account data', 'Never invent ticket numbers, invoice amounts, dates, client records, or campaign metrics.', 'block'),
  ('no-secrets', 'Do not collect secrets', 'Never ask for passwords, API keys, or vault contents, and never repeat a secret.', 'block'),
  ('stay-in-role', 'Stay inside the user role', 'Only describe pages and actions the signed-in role can open.', 'block'),
  ('capability-scope', 'Stay on this capability', 'Answer within this agent''s capability and point other requests to the matching page.', 'block'),
  ('confirm-changes', 'Confirm before changes', 'Do not say a record, payment, brand, or contract was changed unless the user did it on the page.', 'warn')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  instruction = EXCLUDED.instruction,
  severity = EXCLUDED.severity,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.ai_agent_guardrails (agent_id, guardrail_id)
SELECT a.id, g.id
FROM public.ai_agents a
JOIN public.ai_guardrails g ON g.slug IN ('no-invented-data', 'no-secrets', 'stay-in-role', 'capability-scope')
ON CONFLICT (agent_id, guardrail_id) DO NOTHING;

INSERT INTO public.ai_agent_guardrails (agent_id, guardrail_id)
SELECT a.id, g.id
FROM public.ai_agents a
JOIN public.ai_guardrails g ON g.slug = 'confirm-changes'
WHERE a.capability_slug IN ('invoices', 'billing', 'contracts', 'financials', 'white-label', 'platform-integrations')
ON CONFLICT (agent_id, guardrail_id) DO NOTHING;

INSERT INTO public.ai_agent_connectors (agent_id, connector_id)
SELECT a.id, c.id
FROM (VALUES
  ('tickets', 'tickets'),
  ('messages', 'messages'),
  ('messages', 'email'),
  ('projects', 'projects'),
  ('contracts', 'contracts'),
  ('files', 'file-storage'),
  ('knowledge-base', 'knowledge-base'),
  ('invoices', 'invoices'),
  ('invoices', 'stripe'),
  ('billing', 'stripe'),
  ('notifications', 'email'),
  ('google-ads', 'google-ads'),
  ('partner-overview', 'google-ads'),
  ('financials', 'invoices'),
  ('financials', 'quickbooks'),
  ('organization-integrations', 'quickbooks'),
  ('platform-integrations', 'stripe'),
  ('platform-integrations', 'email'),
  ('platform-integrations', 'calendar'),
  ('platform-integrations', 'file-storage'),
  ('email-templates', 'email'),
  ('services', 'projects')
) AS map(capability_slug, connector_slug)
JOIN public.ai_agents a ON a.capability_slug = map.capability_slug
JOIN public.ai_connectors c ON c.slug = map.connector_slug
ON CONFLICT (agent_id, connector_id) DO NOTHING;

-- Migration: Forms and form submissions (admin/staff create; all submit)
-- Description: Form builder and submissions; uses profiles not users
-- Date: 2026-01-31

CREATE TABLE IF NOT EXISTS public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,

  fields JSONB NOT NULL DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  version INTEGER DEFAULT 1,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX idx_forms_slug_org ON public.forms(organization_id, slug) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_forms_org ON public.forms(organization_id);
CREATE INDEX idx_forms_status ON public.forms(status);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  responses JSONB NOT NULL DEFAULT '{}',
  attachments JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'processing', 'completed', 'spam')),
  submitted_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_form_submissions_form ON public.form_submissions(form_id);
CREATE INDEX idx_form_submissions_org ON public.form_submissions(organization_id);
CREATE INDEX idx_form_submissions_submitted ON public.form_submissions(submitted_at);

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- Forms: admin/staff create and manage; all can view active forms for their org
CREATE POLICY "Users can view active forms for their org or system"
  ON public.forms FOR SELECT
  USING (
    (status = 'active' AND (organization_id IS NULL OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'staff'))
  );

CREATE POLICY "Staff can manage forms"
  ON public.forms FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'staff'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'staff'))
  );

-- Submissions: staff see all for their org; submitters see own
CREATE POLICY "Staff can view form submissions"
  ON public.form_submissions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'staff'))
    OR profile_id = auth.uid()
  );

CREATE POLICY "Users can submit to active forms"
  ON public.form_submissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forms f
      WHERE f.id = form_id AND f.status = 'active'
      AND (f.organization_id IS NULL OR f.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
    )
  );

CREATE POLICY "Staff can update submission status"
  ON public.form_submissions FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'staff'))
  );

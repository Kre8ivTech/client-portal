-- Migration: Time entries for staff time tracking
-- Description: Log time against tickets or general work (staff/admin only)
-- Date: 2026-01-31

CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,

  description TEXT NOT NULL,
  hours NUMERIC(10, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  entry_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  billable BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_time_entries_org ON public.time_entries(organization_id);
CREATE INDEX idx_time_entries_profile ON public.time_entries(profile_id);
CREATE INDEX idx_time_entries_ticket ON public.time_entries(ticket_id);
CREATE INDEX idx_time_entries_date ON public.time_entries(entry_date);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Staff and super_admin can manage time entries in their org; super_admin can see all
CREATE POLICY "Staff can view time entries in their org"
  ON public.time_entries FOR SELECT
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Staff can insert own time entries"
  ON public.time_entries FOR INSERT
  WITH CHECK (
    profile_id = auth.uid()
    AND (
      organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    )
  );

CREATE POLICY "Staff can update time entries in their org"
  ON public.time_entries FOR UPDATE
  USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "Staff can delete own time entries"
  ON public.time_entries FOR DELETE
  USING (
    profile_id = auth.uid()
    AND (
      organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
    )
  );

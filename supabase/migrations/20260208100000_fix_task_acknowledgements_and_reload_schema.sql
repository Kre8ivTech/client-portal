-- Migration: Fix task_acknowledgements FK references and reload PostgREST schema
-- Description: task_acknowledgements incorrectly references profiles(id) which doesn't exist
--              (profiles PK is user_id, not id). Also reloads PostgREST schema cache so it
--              picks up project_requests and other recent table/FK changes (fixes PGRST205).
-- Date: 2026-02-08

-- ============================================================================
-- 1. FIX task_acknowledgements TABLE
--    The original migration referenced profiles(id), but profiles has user_id
--    as PK. The FK should reference users(id). The RLS policies also incorrectly
--    reference profiles.organization_id and profiles.role (which don't exist).
-- ============================================================================

DROP TABLE IF EXISTS task_acknowledgements CASCADE;

CREATE TABLE task_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Polymorphic reference to the task (service_request or project_request)
  task_type TEXT NOT NULL CHECK (task_type IN ('service_request', 'project_request')),
  task_id UUID NOT NULL,

  -- Who should acknowledge (recipient of notification)
  acknowledged_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- When acknowledged (NULL until acknowledged)
  acknowledged_at TIMESTAMPTZ,

  -- Secure token for acknowledgement links (prevent unauthorized acknowledgements)
  acknowledgement_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

  -- Token expiry (24 hours from creation)
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Additional metadata
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one acknowledgement per person per task
  UNIQUE (task_type, task_id, acknowledged_by)
);

-- Indexes
CREATE INDEX idx_task_acks_org_id ON task_acknowledgements(organization_id);
CREATE INDEX idx_task_acks_task ON task_acknowledgements(task_type, task_id);
CREATE INDEX idx_task_acks_acknowledged_by ON task_acknowledgements(acknowledged_by);
CREATE INDEX idx_task_acks_token ON task_acknowledgements(acknowledgement_token);
CREATE INDEX idx_task_acks_created_at ON task_acknowledgements(created_at);

-- Trigger for updated_at
CREATE TRIGGER update_task_acknowledgements_updated_at
  BEFORE UPDATE ON task_acknowledgements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. RLS POLICIES (using users table, not profiles)
-- ============================================================================

ALTER TABLE task_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Users can view acknowledgements in their organization
CREATE POLICY "Users can view org acknowledgements"
  ON task_acknowledgements FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users
      WHERE id = auth.uid()
    )
  );

-- Staff can create acknowledgements in their organization
CREATE POLICY "Staff can create acknowledgements"
  ON task_acknowledgements FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'staff', 'partner', 'partner_staff')
    )
    AND acknowledged_by = auth.uid()
  );

-- Staff can update their own acknowledgements (to add notes)
CREATE POLICY "Staff can update own acknowledgements"
  ON task_acknowledgements FOR UPDATE
  USING (
    acknowledged_by = auth.uid()
    AND organization_id IN (
      SELECT organization_id FROM public.users
      WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    acknowledged_by = auth.uid()
  );

-- Partners can view client acknowledgements
CREATE POLICY "Partners can view client acknowledgements"
  ON task_acknowledgements FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations
      WHERE parent_org_id IN (
        SELECT organization_id FROM public.users
        WHERE id = auth.uid()
      )
    )
  );

-- Grants
GRANT SELECT, INSERT, UPDATE ON task_acknowledgements TO authenticated;

-- Comments
COMMENT ON TABLE task_acknowledgements IS 'Tracks staff acknowledgements for service requests and project requests. Used for notification tracking and ensuring tasks are reviewed within 24 hours.';
COMMENT ON COLUMN task_acknowledgements.task_type IS 'Type of task being acknowledged: service_request or project_request';
COMMENT ON COLUMN task_acknowledgements.acknowledgement_token IS 'Secure token used in email acknowledgement links to prevent unauthorized acknowledgements';
COMMENT ON COLUMN task_acknowledgements.token_expires_at IS 'Token expiration timestamp (24 hours from creation). Expired tokens cannot be used.';

-- ============================================================================
-- 3. RELOAD POSTGREST SCHEMA CACHE
--    Required so PostgREST discovers project_requests, task_acknowledgements,
--    and all FK relationships added in recent migrations.
-- ============================================================================

NOTIFY pgrst, 'reload schema';

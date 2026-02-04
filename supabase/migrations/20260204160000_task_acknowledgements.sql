-- Task Acknowledgements Table
-- Tracks acknowledgements for service requests and project requests

CREATE TABLE IF NOT EXISTS task_acknowledgements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Polymorphic reference to the task (service_request or project_request)
  task_type TEXT NOT NULL CHECK (task_type IN ('service_request', 'project_request')),
  task_id UUID NOT NULL,

  -- Who should acknowledge (recipient of notification)
  acknowledged_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- When acknowledged (NULL until acknowledged)
  acknowledged_at TIMESTAMPTZ,

  -- Secure token for acknowledgement links (prevent unauthorized acknowledgements)
  acknowledgement_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,

  -- Token expiry (24 hours from creation)
  token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),

  -- Additional metadata
  notes TEXT, -- Optional notes from the person acknowledging

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one acknowledgement per person per task
  UNIQUE (task_type, task_id, acknowledged_by)
);

-- Create indexes for performance
CREATE INDEX idx_task_acks_org_id ON task_acknowledgements(organization_id);
CREATE INDEX idx_task_acks_task ON task_acknowledgements(task_type, task_id);
CREATE INDEX idx_task_acks_acknowledged_by ON task_acknowledgements(acknowledged_by);
CREATE INDEX idx_task_acks_token ON task_acknowledgements(acknowledgement_token);
CREATE INDEX idx_task_acks_created_at ON task_acknowledgements(created_at);

-- Create trigger for updated_at
CREATE TRIGGER update_task_acknowledgements_updated_at
  BEFORE UPDATE ON task_acknowledgements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE task_acknowledgements ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view acknowledgements in their organization
CREATE POLICY "Users can view org acknowledgements"
  ON task_acknowledgements FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Staff can create acknowledgements in their organization
CREATE POLICY "Staff can create acknowledgements"
  ON task_acknowledgements FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
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
      SELECT organization_id FROM profiles
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
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Add comment for documentation
COMMENT ON TABLE task_acknowledgements IS 'Tracks staff acknowledgements for service requests and project requests. Used for notification tracking and ensuring tasks are reviewed within 24 hours.';
COMMENT ON COLUMN task_acknowledgements.task_type IS 'Type of task being acknowledged: service_request or project_request';
COMMENT ON COLUMN task_acknowledgements.acknowledgement_token IS 'Secure token used in email acknowledgement links to prevent unauthorized acknowledgements';
COMMENT ON COLUMN task_acknowledgements.token_expires_at IS 'Token expiration timestamp (24 hours from creation). Expired tokens cannot be used.';

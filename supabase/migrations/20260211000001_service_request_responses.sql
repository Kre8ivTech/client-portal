-- Migration: Service Request Response Workflow
-- Adds response/approval workflow for service requests
-- Allows admins to respond with details and clients to approve/provide feedback

-- ============================================================================
-- 1. Create service_request_responses table
-- ============================================================================

CREATE TABLE service_request_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign Keys
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES profiles(id),

  -- Response Details
  response_type TEXT NOT NULL CHECK (response_type IN ('admin_response', 'client_feedback')),
  response_text TEXT NOT NULL,
  response_metadata JSONB DEFAULT '{}'::jsonb,

  -- Client Approval (only applicable for client_feedback type)
  is_approval BOOLEAN DEFAULT false,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX idx_service_request_responses_request
  ON service_request_responses(service_request_id);

CREATE INDEX idx_service_request_responses_responder
  ON service_request_responses(responder_id);

CREATE INDEX idx_service_request_responses_type
  ON service_request_responses(response_type);

CREATE INDEX idx_service_request_responses_created
  ON service_request_responses(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER set_service_request_responses_updated_at
  BEFORE UPDATE ON service_request_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE service_request_responses IS 'Tracks conversation between admins and clients for service requests';

-- ============================================================================
-- 2. Update service_requests status enum to include 'responded'
-- ============================================================================

-- Add 'responded' status to the existing check constraint
ALTER TABLE service_requests
  DROP CONSTRAINT IF EXISTS service_requests_status_check;

ALTER TABLE service_requests
  ADD CONSTRAINT service_requests_status_check
  CHECK (status IN ('pending', 'responded', 'approved', 'rejected', 'converted', 'cancelled'));

-- Add comment for new status
COMMENT ON COLUMN service_requests.status IS 'Request status: pending (new), responded (admin provided response), approved (client approved), rejected (admin rejected), converted (to ticket/invoice), cancelled (by client)';

-- ============================================================================
-- 3. Add response tracking fields to service_requests
-- ============================================================================

ALTER TABLE service_requests
  ADD COLUMN latest_response_at TIMESTAMPTZ,
  ADD COLUMN latest_response_by UUID REFERENCES profiles(id),
  ADD COLUMN response_count INTEGER DEFAULT 0;

COMMENT ON COLUMN service_requests.latest_response_at IS 'Timestamp of most recent response (admin or client)';
COMMENT ON COLUMN service_requests.latest_response_by IS 'User who provided the most recent response';
COMMENT ON COLUMN service_requests.response_count IS 'Total number of responses in the conversation';

-- ============================================================================
-- 4. RLS Policies for service_request_responses
-- ============================================================================

ALTER TABLE service_request_responses ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view responses for their service requests
CREATE POLICY "Users can view responses for their requests"
  ON service_request_responses FOR SELECT
  USING (
    service_request_id IN (
      SELECT id FROM service_requests
      WHERE requested_by = auth.uid()
        OR organization_id IN (
          SELECT organization_id FROM profiles
          WHERE id = auth.uid()
        )
    )
  );

-- Policy: Staff can view all responses in their organization
CREATE POLICY "Staff can view org responses"
  ON service_request_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'staff', 'partner')
        AND profiles.organization_id IN (
          SELECT sr.organization_id FROM service_requests sr
          WHERE sr.id = service_request_responses.service_request_id
        )
    )
  );

-- Policy: Staff can create admin responses
CREATE POLICY "Staff can create admin responses"
  ON service_request_responses FOR INSERT
  WITH CHECK (
    response_type = 'admin_response'
    AND responder_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'staff', 'partner')
        AND profiles.organization_id IN (
          SELECT sr.organization_id FROM service_requests sr
          WHERE sr.id = service_request_responses.service_request_id
        )
    )
  );

-- Policy: Clients can create feedback responses for their own requests
CREATE POLICY "Clients can create feedback for own requests"
  ON service_request_responses FOR INSERT
  WITH CHECK (
    response_type = 'client_feedback'
    AND responder_id = auth.uid()
    AND service_request_id IN (
      SELECT id FROM service_requests
      WHERE requested_by = auth.uid()
    )
  );

-- Policy: Responses are immutable (no updates or deletes)
-- This preserves audit trail - only soft deletes via service request cascade

-- ============================================================================
-- 5. Function to update service_requests metadata on new response
-- ============================================================================

CREATE OR REPLACE FUNCTION update_service_request_on_response()
RETURNS TRIGGER AS $$
BEGIN
  -- Update parent service_request with latest response info
  UPDATE service_requests
  SET
    latest_response_at = NEW.created_at,
    latest_response_by = NEW.responder_id,
    response_count = response_count + 1,
    status = CASE
      -- If admin responds, set to 'responded'
      WHEN NEW.response_type = 'admin_response' THEN 'responded'
      -- If client approves, set to 'approved'
      WHEN NEW.response_type = 'client_feedback' AND NEW.is_approval = true THEN 'approved'
      -- If client provides feedback (not approval), keep as 'responded'
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.service_request_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER trigger_update_service_request_on_response
  AFTER INSERT ON service_request_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_service_request_on_response();

-- ============================================================================
-- 6. Add indexes for new service_requests columns
-- ============================================================================

CREATE INDEX idx_service_requests_latest_response
  ON service_requests(latest_response_at DESC);

CREATE INDEX idx_service_requests_response_count
  ON service_requests(response_count);

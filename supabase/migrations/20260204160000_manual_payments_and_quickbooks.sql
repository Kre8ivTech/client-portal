-- Migration: Manual Payments and QuickBooks Integration
-- Created: 2026-02-04
-- Description: Add support for manual payment logging and QuickBooks integration

-- ============================================================================
-- 1. Extend invoice_payments table for manual payments
-- ============================================================================

-- Add payment_source to distinguish between Stripe and manual payments
ALTER TABLE invoice_payments
ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'stripe'
  CHECK (payment_source IN ('stripe', 'manual', 'quickbooks')),
ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index for querying by payment source
CREATE INDEX IF NOT EXISTS idx_invoice_payments_source
  ON invoice_payments(payment_source);

-- Add comment for documentation
COMMENT ON COLUMN invoice_payments.payment_source IS
  'Source of payment: stripe (via Stripe), manual (recorded manually), quickbooks (synced from QuickBooks)';
COMMENT ON COLUMN invoice_payments.recorded_by IS
  'User who recorded the manual payment (NULL for automated payments)';
COMMENT ON COLUMN invoice_payments.notes IS
  'Additional notes for manual payments (check number, wire reference, etc.)';

-- ============================================================================
-- 2. Create quickbooks_integrations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS quickbooks_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- QuickBooks OAuth tokens
  realm_id TEXT NOT NULL, -- QuickBooks company ID
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  -- QuickBooks API configuration
  is_sandbox BOOLEAN NOT NULL DEFAULT false,

  -- Sync settings
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT CHECK (sync_status IN ('idle', 'syncing', 'error')),
  sync_error TEXT,

  -- Metadata
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  connected_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one integration per organization
  UNIQUE(organization_id)
);

-- Add RLS policies
ALTER TABLE quickbooks_integrations ENABLE ROW LEVEL SECURITY;

-- Account managers can view/manage QuickBooks integrations for their org
CREATE POLICY "Account managers can view QB integrations"
  ON quickbooks_integrations FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND (
        role = 'super_admin'
        OR (role = 'staff' AND is_account_manager = true)
      )
    )
  );

CREATE POLICY "Account managers can manage QB integrations"
  ON quickbooks_integrations FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND (
        role = 'super_admin'
        OR (role = 'staff' AND is_account_manager = true)
      )
    )
  );

-- Add indexes
CREATE INDEX idx_qb_integrations_org ON quickbooks_integrations(organization_id);
CREATE INDEX idx_qb_integrations_sync ON quickbooks_integrations(sync_status, last_sync_at);

-- Add trigger for updated_at
CREATE TRIGGER update_quickbooks_integrations_updated_at
  BEFORE UPDATE ON quickbooks_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. Add QuickBooks reference fields to invoices
-- ============================================================================

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS quickbooks_invoice_id TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_customer_id TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quickbooks_sync_status TEXT
  CHECK (quickbooks_sync_status IN ('pending', 'synced', 'error', NULL));

-- Add indexes for QuickBooks lookups
CREATE INDEX IF NOT EXISTS idx_invoices_qb_invoice_id
  ON invoices(quickbooks_invoice_id) WHERE quickbooks_invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_qb_sync_status
  ON invoices(quickbooks_sync_status) WHERE quickbooks_sync_status IS NOT NULL;

-- Add comments
COMMENT ON COLUMN invoices.quickbooks_invoice_id IS
  'QuickBooks Invoice ID from API';
COMMENT ON COLUMN invoices.quickbooks_customer_id IS
  'QuickBooks Customer ID associated with this invoice';
COMMENT ON COLUMN invoices.quickbooks_synced_at IS
  'Timestamp of last successful sync to QuickBooks';
COMMENT ON COLUMN invoices.quickbooks_sync_status IS
  'Current sync status with QuickBooks';

-- ============================================================================
-- 4. Add QuickBooks reference to invoice_payments
-- ============================================================================

ALTER TABLE invoice_payments
ADD COLUMN IF NOT EXISTS quickbooks_payment_id TEXT,
ADD COLUMN IF NOT EXISTS quickbooks_synced_at TIMESTAMPTZ;

-- Add index
CREATE INDEX IF NOT EXISTS idx_invoice_payments_qb_payment_id
  ON invoice_payments(quickbooks_payment_id) WHERE quickbooks_payment_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN invoice_payments.quickbooks_payment_id IS
  'QuickBooks Payment ID from API';

-- ============================================================================
-- 5. Create function to validate manual payment recording
-- ============================================================================

CREATE OR REPLACE FUNCTION can_record_manual_payment(invoice_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_is_manager BOOLEAN;
  invoice_org_id UUID;
  user_org_id UUID;
BEGIN
  -- Get user profile
  SELECT role, is_account_manager, organization_id
  INTO user_role, user_is_manager, user_org_id
  FROM profiles
  WHERE id = auth.uid();

  -- Get invoice organization
  SELECT organization_id
  INTO invoice_org_id
  FROM invoices
  WHERE id = invoice_uuid;

  -- Check authorization
  IF user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  IF user_role = 'staff' AND user_is_manager = true AND user_org_id = invoice_org_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Update RLS policies for invoice_payments to allow manual recording
-- ============================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Account managers can create payments" ON invoice_payments;

-- Allow account managers to create manual payments
CREATE POLICY "Account managers can create payments"
  ON invoice_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND (
        role = 'super_admin'
        OR (role = 'staff' AND is_account_manager = true)
      )
    )
  );

-- ============================================================================
-- 7. Create audit log for manual payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS manual_payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_payment_id UUID NOT NULL REFERENCES invoice_payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,

  -- Audit fields
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Payment details snapshot
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_date DATE NOT NULL,
  payment_reference TEXT,
  notes TEXT,

  -- IP and metadata
  ip_address INET,
  user_agent TEXT
);

-- Add RLS
ALTER TABLE manual_payment_audit_log ENABLE ROW LEVEL SECURITY;

-- Account managers can view audit logs
CREATE POLICY "Account managers can view payment audit log"
  ON manual_payment_audit_log FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
        AND (
          role = 'super_admin'
          OR (role = 'staff' AND is_account_manager = true)
        )
      )
    )
  );

-- Add indexes
CREATE INDEX idx_manual_payment_audit_invoice ON manual_payment_audit_log(invoice_id);
CREATE INDEX idx_manual_payment_audit_recorded_by ON manual_payment_audit_log(recorded_by);
CREATE INDEX idx_manual_payment_audit_date ON manual_payment_audit_log(recorded_at);

-- ============================================================================
-- 8. Create function to record manual payment with audit trail
-- ============================================================================

CREATE OR REPLACE FUNCTION record_manual_payment(
  p_invoice_id UUID,
  p_amount INTEGER,
  p_payment_method TEXT,
  p_payment_date DATE,
  p_payment_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_invoice_record RECORD;
  v_new_amount_paid INTEGER;
  v_new_balance_due INTEGER;
  v_new_status TEXT;
BEGIN
  -- Check authorization
  IF NOT can_record_manual_payment(p_invoice_id) THEN
    RAISE EXCEPTION 'Unauthorized to record manual payment';
  END IF;

  -- Get current invoice state
  SELECT * INTO v_invoice_record
  FROM invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- Validate payment amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  IF p_amount > v_invoice_record.balance_due THEN
    RAISE EXCEPTION 'Payment amount exceeds balance due';
  END IF;

  -- Insert payment record
  INSERT INTO invoice_payments (
    invoice_id,
    amount,
    payment_method,
    payment_date,
    payment_reference,
    payment_source,
    recorded_by,
    notes
  ) VALUES (
    p_invoice_id,
    p_amount,
    p_payment_method,
    p_payment_date,
    p_payment_reference,
    'manual',
    auth.uid(),
    p_notes
  )
  RETURNING id INTO v_payment_id;

  -- Calculate new amounts
  v_new_amount_paid := v_invoice_record.amount_paid + p_amount;
  v_new_balance_due := v_invoice_record.total - v_new_amount_paid;

  -- Determine new status
  IF v_new_balance_due = 0 THEN
    v_new_status := 'paid';
  ELSIF v_new_amount_paid > 0 AND v_new_balance_due > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := v_invoice_record.status;
  END IF;

  -- Update invoice
  UPDATE invoices
  SET
    amount_paid = v_new_amount_paid,
    balance_due = v_new_balance_due,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE id = p_invoice_id;

  -- Create audit log entry
  INSERT INTO manual_payment_audit_log (
    invoice_payment_id,
    invoice_id,
    recorded_by,
    amount,
    payment_method,
    payment_date,
    payment_reference,
    notes,
    ip_address,
    user_agent
  ) VALUES (
    v_payment_id,
    p_invoice_id,
    auth.uid(),
    p_amount,
    p_payment_method,
    p_payment_date,
    p_payment_reference,
    p_notes,
    p_ip_address,
    p_user_agent
  );

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON FUNCTION record_manual_payment IS
  'Records a manual payment for an invoice with full audit trail. Only account managers can use this function.';

-- ============================================================================
-- 9. Create OAuth state tracking table
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL, -- 'quickbooks', 'stripe', etc.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add index for state lookup
CREATE INDEX idx_oauth_states_state ON oauth_states(state);
CREATE INDEX idx_oauth_states_expires ON oauth_states(expires_at);

-- Clean up expired states automatically (run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. Grant necessary permissions
-- ============================================================================

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION can_record_manual_payment TO authenticated;
GRANT EXECUTE ON FUNCTION record_manual_payment TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_oauth_states TO authenticated;

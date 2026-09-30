-- Objects from earlier migrations that were recorded as present after an
-- "already exists" error rolled the rest of the file back.

ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS payment_source TEXT NOT NULL DEFAULT 'stripe';

ALTER TABLE invoice_payments
  DROP CONSTRAINT IF EXISTS invoice_payments_payment_source_check;

ALTER TABLE invoice_payments
  ADD CONSTRAINT invoice_payments_payment_source_check
  CHECK (payment_source IN ('stripe', 'manual', 'quickbooks'));

ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS quickbooks_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS quickbooks_synced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_invoice_payments_source
  ON invoice_payments(payment_source);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_qb_payment_id
  ON invoice_payments(quickbooks_payment_id) WHERE quickbooks_payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION can_record_manual_payment(invoice_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_is_manager BOOLEAN;
  invoice_org_id UUID;
  user_org_id UUID;
BEGIN
  SELECT role, is_account_manager, organization_id
  INTO user_role, user_is_manager, user_org_id
  FROM users
  WHERE id = auth.uid();

  SELECT organization_id
  INTO invoice_org_id
  FROM invoices
  WHERE id = invoice_uuid;

  IF user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  IF user_role = 'staff' AND user_is_manager = true AND user_org_id = invoice_org_id THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Account managers can create payments" ON invoice_payments;
CREATE POLICY "Account managers can create payments"
  ON invoice_payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND (
        role = 'super_admin'
        OR (role = 'staff' AND is_account_manager = true)
      )
    )
  );

CREATE TABLE IF NOT EXISTS manual_payment_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_payment_id UUID NOT NULL REFERENCES invoice_payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_date DATE NOT NULL,
  payment_reference TEXT,
  notes TEXT,
  ip_address INET,
  user_agent TEXT
);

ALTER TABLE manual_payment_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Account managers can view payment audit log" ON manual_payment_audit_log;
CREATE POLICY "Account managers can view payment audit log"
  ON manual_payment_audit_log FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id IN (
        SELECT organization_id FROM users
        WHERE id = auth.uid()
        AND (
          role = 'super_admin'
          OR (role = 'staff' AND is_account_manager = true)
        )
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_manual_payment_audit_invoice ON manual_payment_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_manual_payment_audit_recorded_by ON manual_payment_audit_log(recorded_by);
CREATE INDEX IF NOT EXISTS idx_manual_payment_audit_date ON manual_payment_audit_log(recorded_at);

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
  IF NOT can_record_manual_payment(p_invoice_id) THEN
    RAISE EXCEPTION 'Unauthorized to record manual payment';
  END IF;

  SELECT * INTO v_invoice_record
  FROM invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  IF p_amount > v_invoice_record.balance_due THEN
    RAISE EXCEPTION 'Payment amount exceeds balance due';
  END IF;

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

  v_new_amount_paid := v_invoice_record.amount_paid + p_amount;
  v_new_balance_due := v_invoice_record.total - v_new_amount_paid;

  IF v_new_balance_due = 0 THEN
    v_new_status := 'paid';
  ELSIF v_new_amount_paid > 0 AND v_new_balance_due > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := v_invoice_record.status;
  END IF;

  UPDATE invoices
  SET
    amount_paid = v_new_amount_paid,
    balance_due = v_new_balance_due,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN NOW() ELSE paid_at END,
    updated_at = NOW()
  WHERE id = p_invoice_id;

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

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);

CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS void AS $$
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION can_record_manual_payment TO authenticated;
GRANT EXECUTE ON FUNCTION record_manual_payment TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_oauth_states TO authenticated;

CREATE TABLE IF NOT EXISTS public.project_communication_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    email_on_comment BOOLEAN DEFAULT TRUE,
    email_on_task_assigned BOOLEAN DEFAULT TRUE,
    email_on_task_completed BOOLEAN DEFAULT TRUE,
    email_on_file_uploaded BOOLEAN DEFAULT TRUE,
    email_on_status_change BOOLEAN DEFAULT TRUE,
    digest_frequency VARCHAR(20) DEFAULT 'instant'
        CHECK (digest_frequency IN ('instant', 'daily', 'weekly', 'none')),
    allow_client_comments BOOLEAN DEFAULT TRUE,
    allow_client_file_upload BOOLEAN DEFAULT TRUE,
    notify_on_overdue_tasks BOOLEAN DEFAULT TRUE,
    overdue_reminder_days INTEGER DEFAULT 1,
    updated_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_comm_settings_project
  ON public.project_communication_settings(project_id);

DROP TRIGGER IF EXISTS update_project_comm_settings_updated_at ON public.project_communication_settings;
CREATE TRIGGER update_project_comm_settings_updated_at
    BEFORE UPDATE ON public.project_communication_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.project_communication_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can manage all communication settings" ON public.project_communication_settings;
CREATE POLICY "Staff can manage all communication settings"
ON public.project_communication_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
);

DROP POLICY IF EXISTS "Partners can manage communication settings for their projects" ON public.project_communication_settings;
CREATE POLICY "Partners can manage communication settings for their projects"
ON public.project_communication_settings FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_communication_settings.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.users u ON u.id = auth.uid()
        WHERE p.id = project_communication_settings.project_id
        AND u.role IN ('partner', 'partner_staff')
        AND p.organization_id = u.organization_id
    )
);

DROP POLICY IF EXISTS "Users can view communication settings for accessible projects" ON public.project_communication_settings;
CREATE POLICY "Users can view communication settings for accessible projects"
ON public.project_communication_settings FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_communication_settings.project_id
    )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_communication_settings TO authenticated;

CREATE INDEX IF NOT EXISTS idx_project_activity_created_at ON project_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_activity_user_id ON project_activity(user_id);

DROP POLICY IF EXISTS "Users can view project activity for accessible projects" ON project_activity;
CREATE POLICY "Users can view project activity for accessible projects"
  ON project_activity FOR SELECT
  USING (
    project_id IN (
      SELECT pm.project_id FROM project_members pm
      JOIN users u ON u.id = auth.uid()
      WHERE pm.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('super_admin', 'staff')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert project activity" ON project_activity;
CREATE POLICY "Authenticated users can insert project activity"
  ON project_activity FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Super admins can delete project activity" ON project_activity;
CREATE POLICY "Super admins can delete project activity"
  ON project_activity FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'super_admin'
    )
  );

CREATE OR REPLACE FUNCTION get_project_owner_org_id(p_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id FROM projects WHERE id = p_id;
$$;

DROP POLICY IF EXISTS "Partners can manage assignments for their projects" ON public.project_organizations;
CREATE POLICY "Partners can manage assignments for their projects"
ON public.project_organizations FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('partner', 'partner_staff')
        AND organization_id = get_project_owner_org_id(project_organizations.project_id)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('partner', 'partner_staff')
        AND organization_id = get_project_owner_org_id(project_organizations.project_id)
    )
);

DROP POLICY IF EXISTS "Staff can manage all services" ON services;
CREATE POLICY "Staff can manage all services" ON services
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('super_admin', 'staff')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('super_admin', 'staff')
  )
);

DROP POLICY IF EXISTS "Staff can view all service requests" ON service_requests;
CREATE POLICY "Staff can view all service requests" ON service_requests
FOR SELECT
USING (
  (requested_by = auth.uid()) OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('super_admin', 'staff')
  )
);

DROP POLICY IF EXISTS "Staff can update all service requests" ON service_requests;
CREATE POLICY "Staff can update all service requests" ON service_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('super_admin', 'staff')
  )
);

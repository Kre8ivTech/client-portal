-- Permissions System Migration
-- Allows admins to define and assign granular permissions to roles and users
-- Date: 2026-02-02

-- =============================================================================
-- 1. PERMISSIONS TABLE - Define available permissions
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Permission identifier (e.g., 'tickets.create', 'invoices.delete')
  name VARCHAR(100) UNIQUE NOT NULL,
  
  -- Human-readable label
  label VARCHAR(255) NOT NULL,
  
  -- Description of what this permission allows
  description TEXT,
  
  -- Category for grouping (e.g., 'tickets', 'invoices', 'users', 'settings')
  category VARCHAR(50) NOT NULL,
  
  -- Is this a system permission that cannot be deleted?
  is_system BOOLEAN DEFAULT FALSE,
  
  -- Is this permission active?
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_permissions_name ON public.permissions(name);
CREATE INDEX idx_permissions_category ON public.permissions(category);
CREATE INDEX idx_permissions_active ON public.permissions(is_active) WHERE is_active = TRUE;

COMMENT ON TABLE public.permissions IS 'Defines all available permissions in the system';
COMMENT ON COLUMN public.permissions.name IS 'Unique identifier like tickets.create or invoices.view';
COMMENT ON COLUMN public.permissions.category IS 'Groups permissions by module/feature';

-- Trigger for updated_at
CREATE TRIGGER update_permissions_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 2. ROLE PERMISSIONS TABLE - Assign permissions to roles
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Role name (super_admin, staff, partner, partner_staff, client)
  role VARCHAR(50) NOT NULL CHECK (
    role IN ('super_admin', 'staff', 'partner', 'partner_staff', 'client')
  ),
  
  -- Permission being granted
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  
  -- Who granted this permission
  granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate role-permission assignments
  UNIQUE(role, permission_id)
);

CREATE INDEX idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX idx_role_permissions_permission ON public.role_permissions(permission_id);

COMMENT ON TABLE public.role_permissions IS 'Maps permissions to user roles';

-- =============================================================================
-- 3. USER PERMISSIONS TABLE - Override permissions for specific users
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User receiving the permission
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Permission being granted or revoked
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  
  -- Grant (true) or explicitly deny (false)
  granted BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Who made this change
  modified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate user-permission assignments
  UNIQUE(user_id, permission_id)
);

CREATE INDEX idx_user_permissions_user ON public.user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission ON public.user_permissions(permission_id);
CREATE INDEX idx_user_permissions_granted ON public.user_permissions(user_id, granted) WHERE granted = TRUE;

COMMENT ON TABLE public.user_permissions IS 'User-specific permission overrides (grant or deny)';
COMMENT ON COLUMN public.user_permissions.granted IS 'TRUE = grant permission, FALSE = explicitly deny';

-- Trigger for updated_at
CREATE TRIGGER update_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 4. RLS POLICIES FOR PERMISSIONS TABLES
-- =============================================================================

-- Permissions table
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view permissions"
  ON public.permissions FOR SELECT
  USING (TRUE);

CREATE POLICY "Super admins can manage permissions"
  ON public.permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Role permissions table
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view role permissions"
  ON public.role_permissions FOR SELECT
  USING (TRUE);

CREATE POLICY "Super admins can manage role permissions"
  ON public.role_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- User permissions table
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own permissions"
  ON public.user_permissions FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('super_admin', 'staff')
    )
  );

CREATE POLICY "Super admins can manage user permissions"
  ON public.user_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- =============================================================================
-- 5. HELPER FUNCTIONS
-- =============================================================================

-- Check if user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id UUID,
  p_permission_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  v_permission_id UUID;
  v_user_role VARCHAR(50);
  v_has_permission BOOLEAN;
BEGIN
  -- Get permission ID
  SELECT id INTO v_permission_id
  FROM public.permissions
  WHERE name = p_permission_name AND is_active = TRUE;
  
  IF v_permission_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get user role
  SELECT role INTO v_user_role
  FROM public.users
  WHERE id = p_user_id;
  
  IF v_user_role IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Super admins have all permissions
  IF v_user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;
  
  -- Check for explicit user permission (grant or deny)
  SELECT granted INTO v_has_permission
  FROM public.user_permissions
  WHERE user_id = p_user_id 
    AND permission_id = v_permission_id;
  
  IF v_has_permission IS NOT NULL THEN
    RETURN v_has_permission;
  END IF;
  
  -- Check role-based permission
  SELECT TRUE INTO v_has_permission
  FROM public.role_permissions
  WHERE role = v_user_role 
    AND permission_id = v_permission_id;
  
  RETURN COALESCE(v_has_permission, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.user_has_permission IS 'Check if a user has a specific permission';

-- Get all permissions for a user
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS TABLE(
  permission_name VARCHAR,
  permission_label VARCHAR,
  category VARCHAR,
  source VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.name,
    p.label,
    p.category,
    CASE
      WHEN up.id IS NOT NULL THEN 'user_override'
      ELSE 'role'
    END AS source
  FROM public.permissions p
  LEFT JOIN public.users u ON u.id = p_user_id
  LEFT JOIN public.role_permissions rp ON rp.role = u.role AND rp.permission_id = p.id
  LEFT JOIN public.user_permissions up ON up.user_id = p_user_id 
    AND up.permission_id = p.id 
    AND up.granted = TRUE
  WHERE p.is_active = TRUE
    AND (
      u.role = 'super_admin' -- Super admins get all
      OR rp.id IS NOT NULL   -- Role has permission
      OR up.id IS NOT NULL   -- User has explicit grant
    )
    AND NOT EXISTS ( -- Exclude explicit denies
      SELECT 1 FROM public.user_permissions deny
      WHERE deny.user_id = p_user_id
        AND deny.permission_id = p.id
        AND deny.granted = FALSE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_permissions IS 'Get all permissions for a user';

-- =============================================================================
-- 6. SEED DEFAULT PERMISSIONS
-- =============================================================================

INSERT INTO public.permissions (name, label, description, category, is_system) VALUES
-- Ticket permissions
('tickets.view', 'View Tickets', 'Can view tickets', 'tickets', TRUE),
('tickets.create', 'Create Tickets', 'Can create new tickets', 'tickets', TRUE),
('tickets.update', 'Update Tickets', 'Can edit ticket details', 'tickets', TRUE),
('tickets.delete', 'Delete Tickets', 'Can delete tickets', 'tickets', TRUE),
('tickets.assign', 'Assign Tickets', 'Can assign tickets to staff', 'tickets', TRUE),
('tickets.close', 'Close Tickets', 'Can close/resolve tickets', 'tickets', TRUE),
('tickets.comment', 'Comment on Tickets', 'Can add comments to tickets', 'tickets', TRUE),

-- Invoice permissions
('invoices.view', 'View Invoices', 'Can view invoices', 'invoices', TRUE),
('invoices.create', 'Create Invoices', 'Can create new invoices', 'invoices', TRUE),
('invoices.update', 'Update Invoices', 'Can edit invoice details', 'invoices', TRUE),
('invoices.delete', 'Delete Invoices', 'Can delete invoices', 'invoices', TRUE),
('invoices.send', 'Send Invoices', 'Can send invoices to clients', 'invoices', TRUE),
('invoices.payment', 'Record Payments', 'Can record invoice payments', 'invoices', TRUE),

-- Contract permissions
('contracts.view', 'View Contracts', 'Can view contracts', 'contracts', TRUE),
('contracts.create', 'Create Contracts', 'Can create new contracts', 'contracts', TRUE),
('contracts.update', 'Update Contracts', 'Can edit contract details', 'contracts', TRUE),
('contracts.delete', 'Delete Contracts', 'Can delete contracts', 'contracts', TRUE),
('contracts.send', 'Send Contracts', 'Can send contracts for signature', 'contracts', TRUE),
('contracts.sign', 'Sign Contracts', 'Can sign contracts', 'contracts', TRUE),

-- User management permissions
('users.view', 'View Users', 'Can view user list', 'users', TRUE),
('users.create', 'Create Users', 'Can create new users', 'users', TRUE),
('users.update', 'Update Users', 'Can edit user details', 'users', TRUE),
('users.delete', 'Delete Users', 'Can delete users', 'users', TRUE),
('users.permissions', 'Manage User Permissions', 'Can manage user permissions', 'users', TRUE),

-- Organization permissions
('organizations.view', 'View Organizations', 'Can view organizations', 'organizations', TRUE),
('organizations.create', 'Create Organizations', 'Can create new organizations', 'organizations', TRUE),
('organizations.update', 'Update Organizations', 'Can edit organization details', 'organizations', TRUE),
('organizations.delete', 'Delete Organizations', 'Can delete organizations', 'organizations', TRUE),

-- Settings permissions
('settings.view', 'View Settings', 'Can view settings', 'settings', TRUE),
('settings.update', 'Update Settings', 'Can update system settings', 'settings', TRUE),
('settings.branding', 'Manage Branding', 'Can update portal branding', 'settings', TRUE),
('settings.integrations', 'Manage Integrations', 'Can manage third-party integrations', 'settings', TRUE),

-- Report permissions
('reports.view', 'View Reports', 'Can view reports and analytics', 'reports', TRUE),
('reports.export', 'Export Reports', 'Can export reports', 'reports', TRUE),

-- Service permissions
('services.view', 'View Services', 'Can view services', 'services', TRUE),
('services.create', 'Create Services', 'Can create service requests', 'services', TRUE),
('services.update', 'Update Services', 'Can edit service details', 'services', TRUE),
('services.approve', 'Approve Services', 'Can approve service requests', 'services', TRUE),

-- Message permissions
('messages.view', 'View Messages', 'Can view messages', 'messages', TRUE),
('messages.send', 'Send Messages', 'Can send messages', 'messages', TRUE),
('messages.delete', 'Delete Messages', 'Can delete messages', 'messages', TRUE),

-- Audit permissions
('audit.view', 'View Audit Logs', 'Can view audit logs', 'audit', TRUE)

ON CONFLICT (name) DO NOTHING;

-- =============================================================================
-- 7. SEED DEFAULT ROLE PERMISSIONS
-- =============================================================================

-- Super admin gets all permissions (handled in function, but let's be explicit)
-- Staff role permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'staff', id FROM public.permissions
WHERE name IN (
  'tickets.view', 'tickets.create', 'tickets.update', 'tickets.assign', 'tickets.close', 'tickets.comment',
  'invoices.view', 'invoices.create', 'invoices.update', 'invoices.send', 'invoices.payment',
  'contracts.view', 'contracts.create', 'contracts.update', 'contracts.send',
  'users.view', 'users.create', 'users.update',
  'organizations.view',
  'settings.view',
  'reports.view', 'reports.export',
  'services.view', 'services.create', 'services.update', 'services.approve',
  'messages.view', 'messages.send'
)
ON CONFLICT DO NOTHING;

-- Partner role permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'partner', id FROM public.permissions
WHERE name IN (
  'tickets.view', 'tickets.create', 'tickets.comment',
  'invoices.view',
  'contracts.view', 'contracts.sign',
  'users.view', 'users.create', 'users.update',
  'organizations.view', 'organizations.update',
  'settings.view', 'settings.branding',
  'services.view', 'services.create',
  'messages.view', 'messages.send'
)
ON CONFLICT DO NOTHING;

-- Partner staff role permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'partner_staff', id FROM public.permissions
WHERE name IN (
  'tickets.view', 'tickets.create', 'tickets.comment',
  'invoices.view',
  'contracts.view',
  'settings.view',
  'services.view', 'services.create',
  'messages.view', 'messages.send'
)
ON CONFLICT DO NOTHING;

-- Client role permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'client', id FROM public.permissions
WHERE name IN (
  'tickets.view', 'tickets.create', 'tickets.comment',
  'invoices.view',
  'contracts.view', 'contracts.sign',
  'settings.view',
  'services.view', 'services.create',
  'messages.view', 'messages.send'
)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 8. VIEW FOR PERMISSION SUMMARY
-- =============================================================================

CREATE OR REPLACE VIEW public.role_permission_summary AS
SELECT 
  r.role,
  COUNT(rp.id) AS permission_count,
  json_agg(
    json_build_object(
      'permission_name', p.name,
      'permission_label', p.label,
      'category', p.category
    ) ORDER BY p.category, p.name
  ) AS permissions
FROM (
  SELECT DISTINCT unnest(ARRAY['super_admin', 'staff', 'partner', 'partner_staff', 'client']) AS role
) r
LEFT JOIN public.role_permissions rp ON rp.role = r.role
LEFT JOIN public.permissions p ON p.id = rp.permission_id AND p.is_active = TRUE
GROUP BY r.role;

COMMENT ON VIEW public.role_permission_summary IS 'Summary of permissions by role';

GRANT SELECT ON public.role_permission_summary TO authenticated;

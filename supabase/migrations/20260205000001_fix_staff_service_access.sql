-- Fix RLS policies to allow staff/admin to see ALL services and service requests
-- regardless of organization

-- Drop existing organization-restricted policies on services
DROP POLICY IF EXISTS "Staff can manage services" ON services;
DROP POLICY IF EXISTS "Staff can view all org services" ON services;

-- Create new policy: Staff/Admin can view ALL services (regardless of organization)
CREATE POLICY "Staff can view all services" ON services
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('super_admin', 'staff')
  )
);

-- Create new policy: Staff/Admin can manage ALL services (regardless of organization)
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

-- Drop existing organization-restricted policies on service_requests
DROP POLICY IF EXISTS "Staff can update org service requests" ON service_requests;
DROP POLICY IF EXISTS "Users can view own service requests" ON service_requests;

-- Create new policy: Staff/Admin can view ALL service requests
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

-- Create new policy: Staff/Admin can update ALL service requests
CREATE POLICY "Staff can update all service requests" ON service_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('super_admin', 'staff')
  )
);

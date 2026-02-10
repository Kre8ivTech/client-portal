-- Update RLS policy for services table to ensure global services are visible to all authenticated users

-- Drop existing SELECT policy if it exists
DROP POLICY IF EXISTS "Users can view services in their organization" ON services;
DROP POLICY IF EXISTS "Users can view org services" ON services;
DROP POLICY IF EXISTS "Users can view available services" ON services;

-- Create new SELECT policy that includes global services
CREATE POLICY "Users can view services"
  ON services FOR SELECT
  USING (
    -- Service is active
    is_active = true
    AND (
      -- Global services are visible to everyone
      is_global = true
      OR
      -- Organization-specific services visible to org members
      organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
      OR
      -- White-label: Parent org services visible to child org members
      organization_id IN (
        SELECT parent_org_id FROM organizations
        WHERE id IN (
          SELECT organization_id FROM users WHERE id = auth.uid()
        )
      )
    )
  );

-- Ensure the is_global column exists (for backwards compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'is_global'
  ) THEN
    ALTER TABLE services ADD COLUMN is_global BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN services.is_global IS 'If true, this service is available to all organizations (global service catalog)';

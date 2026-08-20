-- Site Monitoring table for tracking uptime, SSL, and performance of client websites
-- Used by the Partner Overview > Website Monitoring page

CREATE TABLE IF NOT EXISTS site_monitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('up', 'down', 'degraded', 'unknown')),
  last_check_at TIMESTAMPTZ,
  response_time_ms INTEGER,
  uptime_percentage_30d NUMERIC(5,2),
  ssl_expiry_date DATE,
  performance_score INTEGER CHECK (performance_score IS NULL OR (performance_score >= 0 AND performance_score <= 100)),
  last_downtime_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  check_interval_seconds INTEGER NOT NULL DEFAULT 300, -- 5 min default
  notify_on_down BOOLEAN NOT NULL DEFAULT true,
  notify_on_ssl_expiry BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_site_monitors_org ON site_monitors(organization_id);
CREATE INDEX idx_site_monitors_status ON site_monitors(status);

-- RLS
ALTER TABLE site_monitors ENABLE ROW LEVEL SECURITY;

-- Staff and super_admin can see all monitors
CREATE POLICY "Staff and super_admin read all site_monitors"
  ON site_monitors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'staff')
    )
  );

-- Partners can see monitors for their own org and child orgs
CREATE POLICY "Partners read own and child org site_monitors"
  ON site_monitors FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE id = (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
      UNION
      SELECT id FROM organizations WHERE parent_org_id = (
        SELECT organization_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Clients can see monitors for their own org
CREATE POLICY "Clients read own org site_monitors"
  ON site_monitors FOR SELECT
  TO authenticated
  USING (
    organization_id = (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Only staff/admin can insert/update/delete monitors
CREATE POLICY "Staff manage site_monitors"
  ON site_monitors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin', 'staff')
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_site_monitors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER site_monitors_updated_at
  BEFORE UPDATE ON site_monitors
  FOR EACH ROW
  EXECUTE FUNCTION update_site_monitors_updated_at();

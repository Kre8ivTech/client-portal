-- Migration: Calendar integrations, schedules, capacity, and ticket estimates
-- Description: Adds calendar sync storage, staff schedules, capacity snapshots, and AI estimates
-- Date: 2026-01-31

-- =============================================================================
-- CALENDAR INTEGRATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS calendar_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    provider VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'microsoft')),
    account_email VARCHAR(255),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,
    scope TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'error')),
    last_synced_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT calendar_integrations_user_provider_unique UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_integrations_org ON calendar_integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_integrations_user ON calendar_integrations(user_id);

CREATE TRIGGER update_calendar_integrations_updated_at
    BEFORE UPDATE ON calendar_integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their calendar integrations"
ON calendar_integrations FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view org calendar integrations"
ON calendar_integrations FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'super_admin')
    )
);

-- =============================================================================
-- CALENDAR LISTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS calendar_calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES calendar_integrations(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    name TEXT NOT NULL,
    time_zone TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT calendar_calendars_external_unique UNIQUE (integration_id, external_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_calendars_org ON calendar_calendars(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_calendars_user ON calendar_calendars(user_id);

CREATE TRIGGER update_calendar_calendars_updated_at
    BEFORE UPDATE ON calendar_calendars
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE calendar_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their calendars"
ON calendar_calendars FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view org calendars"
ON calendar_calendars FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'super_admin')
    )
);

-- =============================================================================
-- CALENDAR EVENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    calendar_id UUID NOT NULL REFERENCES calendar_calendars(id) ON DELETE CASCADE,
    external_id TEXT NOT NULL,
    title TEXT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    is_busy BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT calendar_events_external_unique UNIQUE (calendar_id, external_id),
    CONSTRAINT calendar_events_time_valid CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_org ON calendar_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_at);

CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their events"
ON calendar_events FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view org events"
ON calendar_events FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'super_admin')
    )
);

-- =============================================================================
-- STAFF WORK SCHEDULES
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    time_zone TEXT NOT NULL DEFAULT 'UTC',
    work_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
    start_time TIME NOT NULL DEFAULT '09:00',
    end_time TIME NOT NULL DEFAULT '17:00',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT staff_work_schedules_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_work_schedules_org ON staff_work_schedules(organization_id);

CREATE TRIGGER update_staff_work_schedules_updated_at
    BEFORE UPDATE ON staff_work_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE staff_work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their work schedule"
ON staff_work_schedules FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view org schedules"
ON staff_work_schedules FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'super_admin')
    )
);

-- =============================================================================
-- CAPACITY SNAPSHOTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS capacity_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    window_start DATE NOT NULL,
    window_end DATE NOT NULL,
    total_available_hours NUMERIC(10,2),
    total_booked_hours NUMERIC(10,2),
    total_capacity_hours NUMERIC(10,2),
    generated_by UUID REFERENCES profiles(id),
    notes JSONB DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_org ON capacity_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_capacity_snapshots_window ON capacity_snapshots(window_start, window_end);

ALTER TABLE capacity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view org capacity snapshots"
ON capacity_snapshots FOR SELECT
TO authenticated
USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'super_admin')
    )
);

-- =============================================================================
-- TICKET ESTIMATES
-- =============================================================================

CREATE TABLE IF NOT EXISTS ticket_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    estimated_hours NUMERIC(10,2) NOT NULL,
    estimated_cost_cents INTEGER,
    estimated_completion_at TIMESTAMPTZ,
    estimated_completion_reason TEXT,
    created_by UUID REFERENCES profiles(id),
    ai_model TEXT,
    ai_confidence NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_estimates_ticket ON ticket_estimates(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ticket_estimates_org ON ticket_estimates(organization_id);

ALTER TABLE ticket_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view estimates for accessible tickets"
ON ticket_estimates FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM tickets t
        JOIN profiles p ON p.id = auth.uid()
        WHERE t.id = ticket_estimates.ticket_id
        AND (
            p.role IN ('staff', 'super_admin')
            OR t.organization_id = p.organization_id
            OR t.organization_id IN (
                SELECT id FROM organizations WHERE parent_org_id = p.organization_id
            )
        )
    )
);

CREATE POLICY "Staff can create ticket estimates"
ON ticket_estimates FOR INSERT
TO authenticated
WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.role IN ('staff', 'super_admin')
    )
);

-- Migration: Staff Capacity & Work Scheduling
-- Description: Tables for staff availability, work hours, and capacity planning
-- Date: 2026-01-29

-- =============================================================================
-- STAFF WORK SCHEDULES (Default availability patterns)
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Day of week (0 = Sunday, 6 = Saturday)
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    
    -- Work hours for this day
    start_time TIME,
    end_time TIME,
    is_working_day BOOLEAN DEFAULT TRUE,
    
    -- Capacity (hours available for ticket work vs meetings, admin, etc.)
    available_hours NUMERIC(4,2) DEFAULT 6.0, -- Realistic: 6 of 8 hours
    
    -- Timezone
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(profile_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_profile ON staff_schedules(profile_id);

-- =============================================================================
-- STAFF TIME OFF / CALENDAR BLOCKS
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_calendar_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Block type
    block_type VARCHAR(30) NOT NULL 
        CHECK (block_type IN ('time_off', 'meeting', 'focus_time', 'out_of_office', 'holiday')),
    
    title VARCHAR(255),
    description TEXT,
    
    -- Time range
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    
    -- Recurring blocks
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule VARCHAR(255), -- iCal RRULE format
    
    -- External calendar sync
    external_calendar_id VARCHAR(255),
    external_event_id VARCHAR(255),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_time_range CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_calendar_blocks_profile ON staff_calendar_blocks(profile_id);
CREATE INDEX IF NOT EXISTS idx_calendar_blocks_dates ON staff_calendar_blocks(start_at, end_at);

-- =============================================================================
-- STAFF SKILLS & SPECIALIZATIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS staff_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    skill_name VARCHAR(100) NOT NULL,
    skill_category VARCHAR(50), -- 'technical', 'billing', 'design', etc.
    proficiency_level INTEGER DEFAULT 3 CHECK (proficiency_level BETWEEN 1 AND 5),
    
    -- For ticket routing
    can_handle_categories JSONB DEFAULT '[]', -- ticket categories this skill applies to
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(profile_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_staff_skills_profile ON staff_skills(profile_id);
CREATE INDEX IF NOT EXISTS idx_staff_skills_category ON staff_skills(skill_category);

-- =============================================================================
-- TASK ESTIMATES & TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS task_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to ticket or standalone task
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    
    -- Estimates
    estimated_hours NUMERIC(6,2) NOT NULL,
    estimated_by UUID REFERENCES profiles(id),
    estimation_method VARCHAR(30) DEFAULT 'manual'
        CHECK (estimation_method IN ('manual', 'ai_suggested', 'historical_average', 'complexity_based')),
    
    -- AI analysis context
    ai_analysis JSONB,
    -- {
    --   "complexity_score": 0.7,
    --   "similar_tickets": ["id1", "id2"],
    --   "avg_similar_hours": 4.5,
    --   "confidence": 0.85,
    --   "factors": ["requires_investigation", "multiple_systems"]
    -- }
    
    -- Actual tracking
    actual_hours NUMERIC(6,2),
    variance_hours NUMERIC(6,2) GENERATED ALWAYS AS (actual_hours - estimated_hours) STORED,
    
    -- For estimation improvement
    was_accurate BOOLEAN, -- Within 20% of estimate
    feedback TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT has_parent CHECK (ticket_id IS NOT NULL OR task_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_task_estimates_ticket ON task_estimates(ticket_id);
CREATE INDEX IF NOT EXISTS idx_task_estimates_task ON task_estimates(task_id);

-- =============================================================================
-- WORKLOAD SNAPSHOTS (For historical analysis)
-- =============================================================================

CREATE TABLE IF NOT EXISTS workload_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    snapshot_date DATE NOT NULL,
    
    -- Capacity
    available_hours NUMERIC(4,2) NOT NULL,
    scheduled_hours NUMERIC(4,2) NOT NULL,
    
    -- Breakdown
    ticket_hours NUMERIC(4,2) DEFAULT 0,
    meeting_hours NUMERIC(4,2) DEFAULT 0,
    admin_hours NUMERIC(4,2) DEFAULT 0,
    
    -- Counts
    open_tickets INTEGER DEFAULT 0,
    open_tasks INTEGER DEFAULT 0,
    
    -- Utilization
    utilization_percent NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN available_hours > 0 
             THEN (scheduled_hours / available_hours) * 100 
             ELSE 0 
        END
    ) STORED,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(profile_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_workload_snapshots_profile ON workload_snapshots(profile_id);
CREATE INDEX IF NOT EXISTS idx_workload_snapshots_date ON workload_snapshots(snapshot_date);

-- =============================================================================
-- COMPLETION ESTIMATES (Client-facing)
-- =============================================================================

CREATE TABLE IF NOT EXISTS completion_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What we're estimating
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    project_id UUID,
    
    -- The estimate
    estimated_start_date DATE,
    estimated_completion_date DATE NOT NULL,
    confidence_level VARCHAR(20) DEFAULT 'medium'
        CHECK (confidence_level IN ('low', 'medium', 'high')),
    confidence_percent INTEGER CHECK (confidence_percent BETWEEN 0 AND 100),
    
    -- How it was calculated
    estimation_method VARCHAR(30) NOT NULL
        CHECK (estimation_method IN ('ai_calculated', 'manual_override', 'sla_based', 'commitment')),
    
    -- AI reasoning
    ai_reasoning JSONB,
    -- {
    --   "work_hours_needed": 8,
    --   "assigned_to": "staff-id",
    --   "staff_availability": [...],
    --   "queue_position": 3,
    --   "blocking_factors": [],
    --   "calculation_timestamp": "..."
    -- }
    
    -- Visibility
    visible_to_client BOOLEAN DEFAULT TRUE,
    client_message TEXT, -- Human-friendly explanation
    
    -- Tracking
    was_met BOOLEAN,
    actual_completion_date DATE,
    
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT has_target CHECK (ticket_id IS NOT NULL OR task_id IS NOT NULL OR project_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_completion_estimates_ticket ON completion_estimates(ticket_id);
CREATE INDEX IF NOT EXISTS idx_completion_estimates_visible ON completion_estimates(visible_to_client) WHERE visible_to_client = TRUE;

-- =============================================================================
-- AI ANALYSIS CACHE
-- =============================================================================

CREATE TABLE IF NOT EXISTS ai_analysis_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What was analyzed
    entity_type VARCHAR(30) NOT NULL, -- 'ticket', 'task', 'workload', etc.
    entity_id UUID NOT NULL,
    analysis_type VARCHAR(50) NOT NULL, -- 'categorization', 'priority', 'estimation', 'sentiment'
    
    -- The analysis
    analysis_result JSONB NOT NULL,
    model_used VARCHAR(100),
    prompt_hash VARCHAR(64), -- To detect if re-analysis needed
    
    -- Metadata
    tokens_used INTEGER,
    latency_ms INTEGER,
    
    -- Validity
    expires_at TIMESTAMP WITH TIME ZONE,
    invalidated_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(entity_type, entity_id, analysis_type)
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_entity ON ai_analysis_cache(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON ai_analysis_cache(expires_at) WHERE expires_at IS NOT NULL;

-- =============================================================================
-- FUNCTIONS: Calculate staff availability
-- =============================================================================

CREATE OR REPLACE FUNCTION get_staff_availability(
    p_profile_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    work_date DATE,
    available_hours NUMERIC,
    blocked_hours NUMERIC,
    net_available_hours NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS work_date
    ),
    schedule AS (
        SELECT 
            ds.work_date,
            COALESCE(ss.available_hours, 0) as available_hours,
            COALESCE(ss.is_working_day, FALSE) as is_working_day
        FROM date_series ds
        LEFT JOIN staff_schedules ss ON ss.profile_id = p_profile_id 
            AND ss.day_of_week = EXTRACT(DOW FROM ds.work_date)
    ),
    blocks AS (
        SELECT 
            ds.work_date,
            COALESCE(SUM(
                EXTRACT(EPOCH FROM (
                    LEAST(cb.end_at, ds.work_date + interval '1 day') - 
                    GREATEST(cb.start_at, ds.work_date::timestamp)
                )) / 3600
            ), 0) as blocked_hours
        FROM date_series ds
        LEFT JOIN staff_calendar_blocks cb ON cb.profile_id = p_profile_id
            AND cb.start_at < ds.work_date + interval '1 day'
            AND cb.end_at > ds.work_date::timestamp
        GROUP BY ds.work_date
    )
    SELECT 
        s.work_date,
        CASE WHEN s.is_working_day THEN s.available_hours ELSE 0 END as available_hours,
        COALESCE(b.blocked_hours, 0) as blocked_hours,
        GREATEST(
            CASE WHEN s.is_working_day THEN s.available_hours ELSE 0 END - COALESCE(b.blocked_hours, 0),
            0
        ) as net_available_hours
    FROM schedule s
    LEFT JOIN blocks b ON b.work_date = s.work_date
    ORDER BY s.work_date;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_calendar_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workload_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE completion_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;

-- Staff can view/edit their own schedules
CREATE POLICY "Staff can manage own schedule"
    ON staff_schedules FOR ALL
    USING (profile_id = auth.uid());

-- Admins can view all schedules
CREATE POLICY "Admins can view all schedules"
    ON staff_schedules FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Similar policies for other tables
CREATE POLICY "Staff can manage own calendar"
    ON staff_calendar_blocks FOR ALL
    USING (profile_id = auth.uid());

CREATE POLICY "Admins can view all calendars"
    ON staff_calendar_blocks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Completion estimates visible to relevant parties
CREATE POLICY "Clients can view their estimates"
    ON completion_estimates FOR SELECT
    USING (
        visible_to_client = TRUE
        AND EXISTS (
            SELECT 1 FROM tickets t
            WHERE t.id = completion_estimates.ticket_id
            AND t.created_by = auth.uid()
        )
    );

CREATE POLICY "Staff can manage estimates"
    ON completion_estimates FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

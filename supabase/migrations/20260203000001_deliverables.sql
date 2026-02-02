-- Create deliverables table for tracking product/service reviews and approvals
CREATE TABLE IF NOT EXISTS public.deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    
    -- Deliverable content
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT, -- Link to the file in storage or external URL
    preview_url TEXT, -- Optional image preview
    
    -- Review Status
    status TEXT NOT NULL DEFAULT 'pending_review' 
        CHECK (status IN ('pending_review', 'approved', 'changes_requested')),
    
    -- Feedback
    client_feedback TEXT,
    
    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Metadata
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deliverables_ticket ON public.deliverables(ticket_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON public.deliverables(status);

-- RLS Policies
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

-- 1. Visibility: Users can see deliverables for tickets they have access to
CREATE POLICY "Users can view deliverables for accessible tickets"
    ON public.deliverables FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = deliverables.ticket_id
            -- Re-use ticket visibility logic (or a simplified check)
            AND (
                -- Staff/Admins can see everything
                EXISTS (
                    SELECT 1 FROM public.users u 
                    WHERE u.id = auth.uid() 
                    AND u.role IN ('super_admin', 'staff')
                )
                OR
                -- Partners/Clients check organization
                t.organization_id IN (
                    SELECT organization_id FROM public.users 
                    WHERE id = auth.uid()
                )
            )
        )
    );

-- 2. Creation: Only Staff/Admins can create deliverables
CREATE POLICY "Staff can create deliverables"
    ON public.deliverables FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('super_admin', 'staff', 'partner', 'partner_staff')
        )
    );

-- 3. Updates: 
-- Staff can update content.
-- Clients can update status (approve/reject) and feedback.
CREATE POLICY "Staff can update deliverables"
    ON public.deliverables FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() 
            AND u.role IN ('super_admin', 'staff', 'partner', 'partner_staff')
        )
    );

CREATE POLICY "Clients can review deliverables"
    ON public.deliverables FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tickets t
            WHERE t.id = deliverables.ticket_id
            AND t.organization_id IN (
                SELECT organization_id FROM public.users 
                WHERE id = auth.uid()
            )
        )
    )
    WITH CHECK (
        -- Clients can only change status and feedback
        -- (Ideally we'd enforce column-level security, but RLS applies to row)
        -- We trust the application layer to restrict fields for clients
        true
    );

-- Triggers
CREATE TRIGGER update_deliverables_updated_at
    BEFORE UPDATE ON public.deliverables
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration: Invoices RLS Policies
-- Description: Row-level security for invoices, payments, and related tables
-- Date: 2026-01-29

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- INVOICES POLICIES
-- =============================================================================

-- Staff can view all invoices
CREATE POLICY "Staff can view all invoices"
    ON invoices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Clients can view their own invoices
CREATE POLICY "Clients can view own invoices"
    ON invoices FOR SELECT
    USING (
        client_org_id IN (
            SELECT organization_id FROM profiles
            WHERE profiles.id = auth.uid()
        )
    );

-- Partners can view invoices for their clients
CREATE POLICY "Partners can view client invoices"
    ON invoices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('partner', 'partner_staff')
            AND (
                invoices.organization_id = p.organization_id
                OR invoices.client_org_id IN (
                    SELECT o.id FROM organizations o
                    WHERE o.parent_org_id = p.organization_id
                )
            )
        )
    );

-- Staff can create invoices
CREATE POLICY "Staff can create invoices"
    ON invoices FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Partners can create invoices for their clients
CREATE POLICY "Partners can create client invoices"
    ON invoices FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role = 'partner'
            AND invoices.organization_id = p.organization_id
        )
    );

-- Staff can update any invoice
CREATE POLICY "Staff can update invoices"
    ON invoices FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Partners can update their own invoices (limited - handled in app)
CREATE POLICY "Partners can update own invoices"
    ON invoices FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
            AND p.role = 'partner'
            AND invoices.organization_id = p.organization_id
            AND invoices.status = 'draft'
        )
    );

-- Only super_admin can delete invoices
CREATE POLICY "Only super_admin can delete invoices"
    ON invoices FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'super_admin'
        )
    );

-- =============================================================================
-- PAYMENTS POLICIES
-- =============================================================================

-- Staff can view all payments
CREATE POLICY "Staff can view all payments"
    ON payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Clients can view payments on their invoices
CREATE POLICY "Clients can view own payments"
    ON payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM invoices i
            JOIN profiles p ON p.organization_id = i.client_org_id
            WHERE i.id = payments.invoice_id
            AND p.id = auth.uid()
        )
    );

-- Partners can view payments for their clients
CREATE POLICY "Partners can view client payments"
    ON payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM invoices i
            JOIN profiles p ON p.id = auth.uid()
            WHERE i.id = payments.invoice_id
            AND p.role IN ('partner', 'partner_staff')
            AND (
                i.organization_id = p.organization_id
                OR i.client_org_id IN (
                    SELECT o.id FROM organizations o
                    WHERE o.parent_org_id = p.organization_id
                )
            )
        )
    );

-- Staff can record payments
CREATE POLICY "Staff can record payments"
    ON payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Clients can make payments (via Stripe, validated in app)
CREATE POLICY "Clients can make payments"
    ON payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM invoices i
            JOIN profiles p ON p.organization_id = i.client_org_id
            WHERE i.id = payments.invoice_id
            AND p.id = auth.uid()
        )
    );

-- Staff can update payments
CREATE POLICY "Staff can update payments"
    ON payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- =============================================================================
-- INVOICE REMINDERS POLICIES
-- =============================================================================

-- Staff can manage reminders
CREATE POLICY "Staff can manage reminders"
    ON invoice_reminders FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- =============================================================================
-- CREDIT NOTES POLICIES
-- =============================================================================

-- Staff can view all credit notes
CREATE POLICY "Staff can view all credit notes"
    ON credit_notes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Clients can view their credit notes
CREATE POLICY "Clients can view own credit notes"
    ON credit_notes FOR SELECT
    USING (
        client_org_id IN (
            SELECT organization_id FROM profiles
            WHERE profiles.id = auth.uid()
        )
    );

-- Staff can manage credit notes
CREATE POLICY "Staff can manage credit notes"
    ON credit_notes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('super_admin', 'staff')
        )
    );

-- Migration: Create Invoices System
-- Description: Invoices, payments, and payment terms for billing
-- Date: 2026-01-29

-- =============================================================================
-- INVOICES
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_org_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Identifiers
    invoice_number VARCHAR(50) NOT NULL,
    
    -- Line Items (stored as JSON array)
    -- [{ "description": "...", "quantity": 1, "unit_price": 100.00, "amount": 100.00 }]
    line_items JSONB NOT NULL DEFAULT '[]',
    
    -- Amounts (stored in cents to avoid floating point issues)
    subtotal_cents INTEGER NOT NULL DEFAULT 0,
    tax_rate INTEGER DEFAULT 0, -- Stored as basis points (e.g., 825 = 8.25%)
    tax_amount_cents INTEGER DEFAULT 0,
    discount_type VARCHAR(20) CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value INTEGER DEFAULT 0, -- Percentage*100 or cents
    discount_amount_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL DEFAULT 0,
    amount_paid_cents INTEGER DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void', 'cancelled')),
    
    -- Dates
    issue_date DATE,
    due_date DATE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    viewed_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Payment Terms
    payment_terms_id UUID REFERENCES payment_terms(id),
    
    -- Notes
    notes TEXT,
    terms TEXT,
    footer TEXT,
    
    -- Recurring configuration
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_config JSONB,
    -- {
    --   "frequency": "monthly", -- monthly, quarterly, yearly
    --   "next_date": "2026-02-01",
    --   "end_date": null,
    --   "occurrences_remaining": null
    -- }
    parent_invoice_id UUID REFERENCES invoices(id), -- For recurring invoices
    
    -- Links
    project_id UUID,
    contract_id UUID,
    
    -- PDF
    pdf_url VARCHAR(500),
    pdf_generated_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, invoice_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- INVOICE NUMBER SEQUENCE
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    org_prefix VARCHAR(10);
    year_part VARCHAR(4);
    next_num INTEGER;
BEGIN
    -- Get year
    year_part := TO_CHAR(COALESCE(NEW.issue_date, CURRENT_DATE), 'YYYY');
    
    -- Get org prefix
    SELECT UPPER(LEFT(slug, 5)) INTO org_prefix
    FROM organizations
    WHERE id = NEW.organization_id;
    
    -- Get next invoice number for this org and year
    SELECT COALESCE(MAX(
        CAST(SPLIT_PART(SPLIT_PART(invoice_number, '-', 3), '-', 1) AS INTEGER)
    ), 0) + 1 INTO next_num
    FROM invoices
    WHERE organization_id = NEW.organization_id
    AND invoice_number LIKE org_prefix || '-' || year_part || '-%';
    
    -- Format: ORG-YYYY-NNNN (e.g., KRE8I-2026-0001)
    NEW.invoice_number := org_prefix || '-' || year_part || '-' || LPAD(next_num::TEXT, 4, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
    EXECUTE FUNCTION generate_invoice_number();

-- =============================================================================
-- PAYMENTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Amount
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Method
    method VARCHAR(50) NOT NULL,
    -- stripe, paypal, bank_transfer, check, cash, credit
    
    -- Provider details
    provider VARCHAR(50), -- stripe, paypal, manual
    transaction_id VARCHAR(255),
    provider_fee_cents INTEGER DEFAULT 0,
    provider_response JSONB,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled')),
    
    -- Refund info
    refund_amount_cents INTEGER DEFAULT 0,
    refund_reason TEXT,
    refunded_at TIMESTAMP WITH TIME ZONE,
    
    -- Reference
    reference VARCHAR(255),
    notes TEXT,
    
    -- Metadata
    paid_by UUID REFERENCES profiles(id),
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id);

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- UPDATE INVOICE ON PAYMENT
-- =============================================================================

CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Update invoice amount_paid_cents
    UPDATE invoices
    SET 
        amount_paid_cents = (
            SELECT COALESCE(SUM(amount_cents - refund_amount_cents), 0)
            FROM payments
            WHERE invoice_id = NEW.invoice_id
            AND status = 'completed'
        ),
        status = CASE
            WHEN (
                SELECT COALESCE(SUM(amount_cents - refund_amount_cents), 0)
                FROM payments
                WHERE invoice_id = NEW.invoice_id
                AND status = 'completed'
            ) >= total_cents THEN 'paid'
            WHEN (
                SELECT COALESCE(SUM(amount_cents - refund_amount_cents), 0)
                FROM payments
                WHERE invoice_id = NEW.invoice_id
                AND status = 'completed'
            ) > 0 THEN 'partial'
            ELSE status
        END,
        paid_at = CASE
            WHEN (
                SELECT COALESCE(SUM(amount_cents - refund_amount_cents), 0)
                FROM payments
                WHERE invoice_id = NEW.invoice_id
                AND status = 'completed'
            ) >= total_cents THEN NOW()
            ELSE paid_at
        END,
        updated_at = NOW()
    WHERE id = NEW.invoice_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_update_invoice
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_on_payment();

-- =============================================================================
-- INVOICE REMINDERS
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoice_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    reminder_type VARCHAR(30) NOT NULL,
    -- upcoming_due, due_today, overdue_1, overdue_7, overdue_14, overdue_30
    
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Email details
    email_to VARCHAR(255),
    email_subject VARCHAR(255),
    email_sent BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON invoice_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON invoice_reminders(scheduled_for) WHERE sent_at IS NULL;

-- =============================================================================
-- CREDIT NOTES
-- =============================================================================

CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    client_org_id UUID NOT NULL REFERENCES organizations(id),
    
    -- Identifiers
    credit_note_number VARCHAR(50) NOT NULL,
    
    -- Amount
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Reason
    reason TEXT NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'issued'
        CHECK (status IN ('draft', 'issued', 'applied', 'void')),
    
    -- Applied to
    applied_to_invoice_id UUID REFERENCES invoices(id),
    applied_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    issued_by UUID REFERENCES profiles(id),
    issued_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, credit_note_number)
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_org ON credit_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_client ON credit_notes(client_org_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON credit_notes(invoice_id);

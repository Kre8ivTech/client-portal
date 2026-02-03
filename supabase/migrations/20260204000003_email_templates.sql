-- Migration: Email Templates System
-- Description: Customizable email templates for notifications with variable placeholders
-- Date: 2026-02-04

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE email_template_type AS ENUM (
    'new_user',
    'new_tenant',
    'new_organization',
    'new_task',
    'new_service_request',
    'new_project',
    'new_invoice',
    'invoice_paid',
    'invoice_overdue',
    'ticket_created',
    'ticket_updated',
    'ticket_comment',
    'ticket_assigned',
    'ticket_resolved',
    'ticket_closed',
    'sla_warning',
    'sla_breach',
    'password_reset',
    'magic_link',
    'welcome'
);

-- =============================================================================
-- EMAIL TEMPLATES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = system default template

    -- Template identification
    template_type email_template_type NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Email content
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT, -- Plain text fallback (optional)

    -- From address customization (if NULL, use system default)
    from_name VARCHAR(255),
    from_email VARCHAR(255),
    reply_to VARCHAR(255),

    -- Template variables definition
    -- Example: [{"name": "user_name", "label": "User Name", "required": true, "default": "User"}]
    variables JSONB DEFAULT '[]',

    -- Template status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE, -- Only one default per type per org (or system)

    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_email_templates_organization ON email_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON email_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_email_templates_default ON email_templates(is_default) WHERE is_default = TRUE;

-- Unique constraint: only one default template per type per organization (or system-wide if org is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_unique_default
ON email_templates(template_type, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid))
WHERE is_default = TRUE;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger for updated_at
CREATE TRIGGER update_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to ensure only one default per type per org
CREATE OR REPLACE FUNCTION ensure_single_default_email_template()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = TRUE THEN
        -- Unset other defaults for this type in the same org (or system-wide)
        UPDATE email_templates
        SET is_default = FALSE
        WHERE template_type = NEW.template_type
        AND id != NEW.id
        AND (
            (organization_id IS NULL AND NEW.organization_id IS NULL)
            OR organization_id = NEW.organization_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_email_template_trigger
    BEFORE INSERT OR UPDATE ON email_templates
    FOR EACH ROW
    WHEN (NEW.is_default = TRUE)
    EXECUTE FUNCTION ensure_single_default_email_template();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- View: Users can view templates in their organization or system default templates
CREATE POLICY "Users can view org and system templates"
ON email_templates FOR SELECT
TO authenticated
USING (
    organization_id IS NULL -- System default templates
    OR
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
    OR
    -- Partners can view their client org templates
    organization_id IN (
        SELECT id FROM organizations
        WHERE parent_org_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
    )
);

-- Insert: Only super_admin and staff can create templates
CREATE POLICY "Staff can create email templates"
ON email_templates FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
    AND (
        -- System templates only for super_admin
        (organization_id IS NULL AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
        ))
        OR
        -- Org templates for staff in that org
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    )
);

-- Update: Only super_admin and staff can update templates
CREATE POLICY "Staff can update email templates"
ON email_templates FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
    AND (
        (organization_id IS NULL AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
        ))
        OR
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
    AND (
        (organization_id IS NULL AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
        ))
        OR
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    )
);

-- Delete: Only super_admin and staff can delete templates
CREATE POLICY "Staff can delete email templates"
ON email_templates FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'staff')
    )
    AND (
        (organization_id IS NULL AND EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'
        ))
        OR
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    )
);

-- =============================================================================
-- SEED DEFAULT TEMPLATES
-- =============================================================================

-- System default templates (organization_id = NULL)
INSERT INTO email_templates (organization_id, template_type, name, description, subject, body_html, variables, is_active, is_default)
VALUES
-- New User Welcome
(NULL, 'new_user', 'New User Welcome', 'Sent when a new user account is created',
'Welcome to {{portal_name}}!',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">Welcome to {{portal_name}}</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{user_name}},</p>
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">Your account has been created successfully. You can now access the portal and start using our services.</p>
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">Click the button below to log in to your account:</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:6px;">
<a href="{{login_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">Log In to Your Account</a>
</td></tr></table>
<p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">If you have any questions, please don''t hesitate to reach out to our support team.</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>',
'[{"name": "portal_name", "label": "Portal Name", "required": true, "default": "KT-Portal"},
{"name": "user_name", "label": "User Name", "required": true, "default": "User"},
{"name": "login_url", "label": "Login URL", "required": true, "default": ""},
{"name": "unsubscribe_url", "label": "Unsubscribe URL", "required": false, "default": ""}]'::jsonb,
TRUE, TRUE),

-- New Ticket Created
(NULL, 'ticket_created', 'Ticket Created', 'Sent when a new support ticket is created',
'New Ticket: {{ticket_subject}} [#{{ticket_number}}]',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">New Support Ticket</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">A new ticket has been created:</p>
<table width="100%" style="background-color:#f9fafb;border-radius:6px;padding:16px;margin:0 0 24px;">
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Ticket:</strong></td><td style="color:#6b7280;padding:8px 16px;">#{{ticket_number}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Subject:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{ticket_subject}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Priority:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{ticket_priority}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Created by:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{created_by}}</td></tr>
</table>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:6px;">
<a href="{{ticket_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">View Ticket</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>',
'[{"name": "portal_name", "label": "Portal Name", "required": true, "default": "KT-Portal"},
{"name": "ticket_number", "label": "Ticket Number", "required": true},
{"name": "ticket_subject", "label": "Ticket Subject", "required": true},
{"name": "ticket_priority", "label": "Ticket Priority", "required": true, "default": "Medium"},
{"name": "created_by", "label": "Created By", "required": true},
{"name": "ticket_url", "label": "Ticket URL", "required": true},
{"name": "unsubscribe_url", "label": "Unsubscribe URL", "required": false}]'::jsonb,
TRUE, TRUE),

-- Invoice Created
(NULL, 'new_invoice', 'New Invoice', 'Sent when a new invoice is created',
'Invoice #{{invoice_number}} - {{amount}} Due {{due_date}}',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">New Invoice</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{client_name}},</p>
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">A new invoice has been generated for your account:</p>
<table width="100%" style="background-color:#f9fafb;border-radius:6px;padding:16px;margin:0 0 24px;">
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Invoice #:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{invoice_number}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Amount:</strong></td><td style="color:#374151;padding:8px 16px;font-weight:600;font-size:18px;">{{amount}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Due Date:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{due_date}}</td></tr>
</table>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:6px;">
<a href="{{invoice_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">View & Pay Invoice</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>',
'[{"name": "portal_name", "label": "Portal Name", "required": true, "default": "KT-Portal"},
{"name": "client_name", "label": "Client Name", "required": true},
{"name": "invoice_number", "label": "Invoice Number", "required": true},
{"name": "amount", "label": "Amount", "required": true},
{"name": "due_date", "label": "Due Date", "required": true},
{"name": "invoice_url", "label": "Invoice URL", "required": true},
{"name": "unsubscribe_url", "label": "Unsubscribe URL", "required": false}]'::jsonb,
TRUE, TRUE),

-- Invoice Paid
(NULL, 'invoice_paid', 'Invoice Paid', 'Sent when an invoice is paid',
'Payment Received - Invoice #{{invoice_number}}',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#10b981 0%,#059669 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">Payment Received</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{client_name}},</p>
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">Thank you for your payment! We''ve received your payment for the following invoice:</p>
<table width="100%" style="background-color:#ecfdf5;border-radius:6px;padding:16px;margin:0 0 24px;border:1px solid #a7f3d0;">
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Invoice #:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{invoice_number}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Amount Paid:</strong></td><td style="color:#059669;padding:8px 16px;font-weight:600;font-size:18px;">{{amount}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Payment Date:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{payment_date}}</td></tr>
</table>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:6px;">
<a href="{{receipt_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">View Receipt</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>',
'[{"name": "portal_name", "label": "Portal Name", "required": true, "default": "KT-Portal"},
{"name": "client_name", "label": "Client Name", "required": true},
{"name": "invoice_number", "label": "Invoice Number", "required": true},
{"name": "amount", "label": "Amount Paid", "required": true},
{"name": "payment_date", "label": "Payment Date", "required": true},
{"name": "receipt_url", "label": "Receipt URL", "required": true},
{"name": "unsubscribe_url", "label": "Unsubscribe URL", "required": false}]'::jsonb,
TRUE, TRUE),

-- SLA Warning
(NULL, 'sla_warning', 'SLA Warning', 'Sent when a ticket is approaching SLA deadline',
'SLA Warning: Ticket #{{ticket_number}} approaching deadline',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">SLA Warning</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">The following ticket is approaching its SLA deadline:</p>
<table width="100%" style="background-color:#fffbeb;border-radius:6px;padding:16px;margin:0 0 24px;border:1px solid #fcd34d;">
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Ticket:</strong></td><td style="color:#6b7280;padding:8px 16px;">#{{ticket_number}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Subject:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{ticket_subject}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Priority:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{ticket_priority}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Time Remaining:</strong></td><td style="color:#d97706;padding:8px 16px;font-weight:600;">{{time_remaining}}</td></tr>
</table>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:6px;">
<a href="{{ticket_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">View Ticket</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>',
'[{"name": "portal_name", "label": "Portal Name", "required": true, "default": "KT-Portal"},
{"name": "ticket_number", "label": "Ticket Number", "required": true},
{"name": "ticket_subject", "label": "Ticket Subject", "required": true},
{"name": "ticket_priority", "label": "Ticket Priority", "required": true},
{"name": "time_remaining", "label": "Time Remaining", "required": true},
{"name": "ticket_url", "label": "Ticket URL", "required": true},
{"name": "unsubscribe_url", "label": "Unsubscribe URL", "required": false}]'::jsonb,
TRUE, TRUE),

-- SLA Breach
(NULL, 'sla_breach', 'SLA Breach', 'Sent when a ticket has breached its SLA',
'SLA BREACH: Ticket #{{ticket_number}} is overdue',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">SLA Breach Alert</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">The following ticket has exceeded its SLA deadline and requires immediate attention:</p>
<table width="100%" style="background-color:#fef2f2;border-radius:6px;padding:16px;margin:0 0 24px;border:1px solid #fecaca;">
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Ticket:</strong></td><td style="color:#6b7280;padding:8px 16px;">#{{ticket_number}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Subject:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{ticket_subject}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Priority:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{ticket_priority}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Overdue By:</strong></td><td style="color:#dc2626;padding:8px 16px;font-weight:600;">{{overdue_by}}</td></tr>
</table>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%);border-radius:6px;">
<a href="{{ticket_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">View Ticket Now</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>',
'[{"name": "portal_name", "label": "Portal Name", "required": true, "default": "KT-Portal"},
{"name": "ticket_number", "label": "Ticket Number", "required": true},
{"name": "ticket_subject", "label": "Ticket Subject", "required": true},
{"name": "ticket_priority", "label": "Ticket Priority", "required": true},
{"name": "overdue_by", "label": "Overdue By", "required": true},
{"name": "ticket_url", "label": "Ticket URL", "required": true},
{"name": "unsubscribe_url", "label": "Unsubscribe URL", "required": false}]'::jsonb,
TRUE, TRUE),

-- Ticket Comment
(NULL, 'ticket_comment', 'Ticket Comment', 'Sent when a new comment is added to a ticket',
'New comment on Ticket #{{ticket_number}}',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">New Comment</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;"><strong>{{commenter_name}}</strong> added a comment to ticket <strong>#{{ticket_number}}</strong>:</p>
<div style="background-color:#f9fafb;border-radius:6px;padding:16px;margin:0 0 24px;border-left:4px solid #667eea;">
<p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">{{comment_content}}</p>
</div>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:6px;">
<a href="{{ticket_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">View & Reply</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>',
'[{"name": "portal_name", "label": "Portal Name", "required": true, "default": "KT-Portal"},
{"name": "ticket_number", "label": "Ticket Number", "required": true},
{"name": "commenter_name", "label": "Commenter Name", "required": true},
{"name": "comment_content", "label": "Comment Content", "required": true},
{"name": "ticket_url", "label": "Ticket URL", "required": true},
{"name": "unsubscribe_url", "label": "Unsubscribe URL", "required": false}]'::jsonb,
TRUE, TRUE),

-- New Project
(NULL, 'new_project', 'New Project Created', 'Sent when a new project is created',
'New Project: {{project_name}}',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">New Project</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">Hi {{recipient_name}},</p>
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">A new project has been created:</p>
<table width="100%" style="background-color:#f9fafb;border-radius:6px;padding:16px;margin:0 0 24px;">
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Project:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{project_name}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Description:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{project_description}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Start Date:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{start_date}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Created by:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{created_by}}</td></tr>
</table>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:6px;">
<a href="{{project_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">View Project</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>',
'[{"name": "portal_name", "label": "Portal Name", "required": true, "default": "KT-Portal"},
{"name": "recipient_name", "label": "Recipient Name", "required": true},
{"name": "project_name", "label": "Project Name", "required": true},
{"name": "project_description", "label": "Project Description", "required": false, "default": ""},
{"name": "start_date", "label": "Start Date", "required": false},
{"name": "created_by", "label": "Created By", "required": true},
{"name": "project_url", "label": "Project URL", "required": true},
{"name": "unsubscribe_url", "label": "Unsubscribe URL", "required": false}]'::jsonb,
TRUE, TRUE),

-- New Service Request
(NULL, 'new_service_request', 'New Service Request', 'Sent when a new service request is submitted',
'New Service Request: {{service_name}}',
'<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,''Helvetica Neue'',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">New Service Request</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">A new service request has been submitted:</p>
<table width="100%" style="background-color:#f9fafb;border-radius:6px;padding:16px;margin:0 0 24px;">
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Service:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{service_name}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Requested by:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{requested_by}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Organization:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{organization_name}}</td></tr>
<tr><td style="padding:8px 16px;"><strong style="color:#374151;">Details:</strong></td><td style="color:#6b7280;padding:8px 16px;">{{request_details}}</td></tr>
</table>
<table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:6px;">
<a href="{{request_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;">View Request</a>
</td></tr></table>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>',
'[{"name": "portal_name", "label": "Portal Name", "required": true, "default": "KT-Portal"},
{"name": "service_name", "label": "Service Name", "required": true},
{"name": "requested_by", "label": "Requested By", "required": true},
{"name": "organization_name", "label": "Organization Name", "required": true},
{"name": "request_details", "label": "Request Details", "required": false},
{"name": "request_url", "label": "Request URL", "required": true},
{"name": "unsubscribe_url", "label": "Unsubscribe URL", "required": false}]'::jsonb,
TRUE, TRUE);

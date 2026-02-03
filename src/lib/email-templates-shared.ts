
export type EmailTemplateType =
  | 'new_user'
  | 'new_tenant'
  | 'new_organization'
  | 'new_task'
  | 'new_service_request'
  | 'new_project'
  | 'new_invoice'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'ticket_created'
  | 'ticket_updated'
  | 'ticket_comment'
  | 'ticket_assigned'
  | 'ticket_resolved'
  | 'ticket_closed'
  | 'sla_warning'
  | 'sla_breach'
  | 'password_reset'
  | 'magic_link'
  | 'welcome'

export type TemplateVariable = {
  name: string
  label: string
  required?: boolean
  default?: string
}

export type EmailTemplate = {
  id: string
  organization_id: string | null
  template_type: EmailTemplateType
  name: string
  description: string | null
  subject: string
  body_html: string
  body_text: string | null
  from_name: string | null
  from_email: string | null
  reply_to: string | null
  variables: TemplateVariable[]
  is_active: boolean
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export const VALID_TEMPLATE_TYPES: EmailTemplateType[] = [
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
]

/**
 * Get template type display name
 */
export function getTemplateTypeDisplayName(type: EmailTemplateType): string {
  const displayNames: Record<EmailTemplateType, string> = {
    new_user: 'New User Welcome',
    new_tenant: 'New Tenant',
    new_organization: 'New Organization',
    new_task: 'New Task',
    new_service_request: 'New Service Request',
    new_project: 'New Project',
    new_invoice: 'New Invoice',
    invoice_paid: 'Invoice Paid',
    invoice_overdue: 'Invoice Overdue',
    ticket_created: 'Ticket Created',
    ticket_updated: 'Ticket Updated',
    ticket_comment: 'Ticket Comment',
    ticket_assigned: 'Ticket Assigned',
    ticket_resolved: 'Ticket Resolved',
    ticket_closed: 'Ticket Closed',
    sla_warning: 'SLA Warning',
    sla_breach: 'SLA Breach',
    password_reset: 'Password Reset',
    magic_link: 'Magic Link Login',
    welcome: 'Welcome Email'
  }
  return displayNames[type] || type
}

/**
 * Get all template types with display names
 */
export function getTemplateTypes(): Array<{ value: EmailTemplateType; label: string }> {
  return VALID_TEMPLATE_TYPES.map(type => ({
    value: type,
    label: getTemplateTypeDisplayName(type)
  }))
}

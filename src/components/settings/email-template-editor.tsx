'use client'

import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Loader2,
  Save,
  Eye,
  Code,
  Variable,
  ChevronDown,
  Info,
  Plus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createEmailTemplate,
  updateEmailTemplate,
  renderEmailTemplate,
  type EmailTemplate,
  type EmailTemplateType,
  type TemplateVariable,
} from '@/lib/actions/email-templates'

const TEMPLATE_TYPES: Array<{ value: EmailTemplateType; label: string; variables: TemplateVariable[] }> = [
  {
    value: 'new_user',
    label: 'New User Welcome',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'user_name', label: 'User Name', required: true },
      { name: 'login_url', label: 'Login URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'ticket_created',
    label: 'Ticket Created',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'ticket_number', label: 'Ticket Number', required: true },
      { name: 'ticket_subject', label: 'Ticket Subject', required: true },
      { name: 'ticket_priority', label: 'Ticket Priority', required: true },
      { name: 'created_by', label: 'Created By', required: true },
      { name: 'ticket_url', label: 'Ticket URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'ticket_updated',
    label: 'Ticket Updated',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'ticket_number', label: 'Ticket Number', required: true },
      { name: 'ticket_subject', label: 'Ticket Subject', required: true },
      { name: 'changes', label: 'Changes Description', required: true },
      { name: 'ticket_url', label: 'Ticket URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'ticket_comment',
    label: 'Ticket Comment',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'ticket_number', label: 'Ticket Number', required: true },
      { name: 'commenter_name', label: 'Commenter Name', required: true },
      { name: 'comment_content', label: 'Comment Content', required: true },
      { name: 'ticket_url', label: 'Ticket URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'ticket_assigned',
    label: 'Ticket Assigned',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'ticket_number', label: 'Ticket Number', required: true },
      { name: 'ticket_subject', label: 'Ticket Subject', required: true },
      { name: 'assignee_name', label: 'Assignee Name', required: true },
      { name: 'assigned_by', label: 'Assigned By', required: true },
      { name: 'ticket_url', label: 'Ticket URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'ticket_resolved',
    label: 'Ticket Resolved',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'ticket_number', label: 'Ticket Number', required: true },
      { name: 'ticket_subject', label: 'Ticket Subject', required: true },
      { name: 'resolution', label: 'Resolution Summary' },
      { name: 'ticket_url', label: 'Ticket URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'ticket_closed',
    label: 'Ticket Closed',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'ticket_number', label: 'Ticket Number', required: true },
      { name: 'ticket_subject', label: 'Ticket Subject', required: true },
      { name: 'ticket_url', label: 'Ticket URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'new_invoice',
    label: 'New Invoice',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'client_name', label: 'Client Name', required: true },
      { name: 'invoice_number', label: 'Invoice Number', required: true },
      { name: 'amount', label: 'Amount', required: true },
      { name: 'due_date', label: 'Due Date', required: true },
      { name: 'invoice_url', label: 'Invoice URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'invoice_paid',
    label: 'Invoice Paid',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'client_name', label: 'Client Name', required: true },
      { name: 'invoice_number', label: 'Invoice Number', required: true },
      { name: 'amount', label: 'Amount Paid', required: true },
      { name: 'payment_date', label: 'Payment Date', required: true },
      { name: 'receipt_url', label: 'Receipt URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'invoice_overdue',
    label: 'Invoice Overdue',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'client_name', label: 'Client Name', required: true },
      { name: 'invoice_number', label: 'Invoice Number', required: true },
      { name: 'amount', label: 'Amount Due', required: true },
      { name: 'days_overdue', label: 'Days Overdue', required: true },
      { name: 'invoice_url', label: 'Invoice URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'sla_warning',
    label: 'SLA Warning',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'ticket_number', label: 'Ticket Number', required: true },
      { name: 'ticket_subject', label: 'Ticket Subject', required: true },
      { name: 'ticket_priority', label: 'Ticket Priority', required: true },
      { name: 'time_remaining', label: 'Time Remaining', required: true },
      { name: 'ticket_url', label: 'Ticket URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'sla_breach',
    label: 'SLA Breach',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'ticket_number', label: 'Ticket Number', required: true },
      { name: 'ticket_subject', label: 'Ticket Subject', required: true },
      { name: 'ticket_priority', label: 'Ticket Priority', required: true },
      { name: 'overdue_by', label: 'Overdue By', required: true },
      { name: 'ticket_url', label: 'Ticket URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'new_project',
    label: 'New Project',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'recipient_name', label: 'Recipient Name', required: true },
      { name: 'project_name', label: 'Project Name', required: true },
      { name: 'project_description', label: 'Project Description' },
      { name: 'start_date', label: 'Start Date' },
      { name: 'created_by', label: 'Created By', required: true },
      { name: 'project_url', label: 'Project URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'new_service_request',
    label: 'New Service Request',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'service_name', label: 'Service Name', required: true },
      { name: 'requested_by', label: 'Requested By', required: true },
      { name: 'organization_name', label: 'Organization Name', required: true },
      { name: 'request_details', label: 'Request Details' },
      { name: 'request_url', label: 'Request URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'new_task',
    label: 'New Task',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'recipient_name', label: 'Recipient Name', required: true },
      { name: 'task_name', label: 'Task Name', required: true },
      { name: 'task_description', label: 'Task Description' },
      { name: 'due_date', label: 'Due Date' },
      { name: 'assigned_by', label: 'Assigned By', required: true },
      { name: 'task_url', label: 'Task URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'new_tenant',
    label: 'New Tenant',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'tenant_name', label: 'Tenant Name', required: true },
      { name: 'admin_name', label: 'Admin Name', required: true },
      { name: 'login_url', label: 'Login URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'new_organization',
    label: 'New Organization',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'organization_name', label: 'Organization Name', required: true },
      { name: 'admin_name', label: 'Admin Name', required: true },
      { name: 'login_url', label: 'Login URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'welcome',
    label: 'Welcome Email',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'user_name', label: 'User Name', required: true },
      { name: 'login_url', label: 'Login URL', required: true },
      { name: 'unsubscribe_url', label: 'Unsubscribe URL' },
    ],
  },
  {
    value: 'password_reset',
    label: 'Password Reset',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'user_name', label: 'User Name', required: true },
      { name: 'reset_url', label: 'Reset URL', required: true },
      { name: 'expires_in', label: 'Expires In' },
    ],
  },
  {
    value: 'magic_link',
    label: 'Magic Link Login',
    variables: [
      { name: 'portal_name', label: 'Portal Name', required: true, default: 'KT-Portal' },
      { name: 'user_name', label: 'User Name', required: true },
      { name: 'magic_link', label: 'Magic Link URL', required: true },
      { name: 'expires_in', label: 'Expires In' },
    ],
  },
]

interface EmailTemplateEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: EmailTemplate | null
  isCreateMode: boolean
  isSuperAdmin: boolean
  organizationId: string | null
  onSave: () => void
  onCancel: () => void
}

export function EmailTemplateEditor({
  open,
  onOpenChange,
  template,
  isCreateMode,
  isSuperAdmin,
  organizationId,
  onSave,
  onCancel,
}: EmailTemplateEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [variablesOpen, setVariablesOpen] = useState(true)
  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    template_type: 'ticket_created' as EmailTemplateType,
    description: '',
    subject: '',
    body_html: '',
    body_text: '',
    from_name: '',
    from_email: '',
    reply_to: '',
    is_default: false,
    is_system: false,
    variables: [] as TemplateVariable[],
  })

  // Preview state
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({})
  const [renderedPreview, setRenderedPreview] = useState<{
    subject: string
    html: string
  } | null>(null)

  // Initialize form when template changes
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        template_type: template.template_type,
        description: template.description || '',
        subject: template.subject,
        body_html: template.body_html,
        body_text: template.body_text || '',
        from_name: template.from_name || '',
        from_email: template.from_email || '',
        reply_to: template.reply_to || '',
        is_default: template.is_default,
        is_system: template.organization_id === null,
        variables: template.variables || [],
      })
    } else if (isCreateMode) {
      const defaultType = TEMPLATE_TYPES[0]
      setFormData({
        name: '',
        template_type: defaultType.value,
        description: '',
        subject: '',
        body_html: getDefaultTemplate(),
        body_text: '',
        from_name: '',
        from_email: '',
        reply_to: '',
        is_default: false,
        is_system: false,
        variables: defaultType.variables,
      })
    }
  }, [template, isCreateMode])

  // Update variables when template type changes in create mode
  useEffect(() => {
    if (isCreateMode) {
      const typeConfig = TEMPLATE_TYPES.find((t) => t.value === formData.template_type)
      if (typeConfig) {
        setFormData((prev) => ({
          ...prev,
          variables: typeConfig.variables,
        }))
      }
    }
  }, [formData.template_type, isCreateMode])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await createEmailTemplate({
        name: formData.name,
        template_type: formData.template_type,
        subject: formData.subject,
        body_html: formData.body_html,
        description: formData.description || undefined,
        body_text: formData.body_text || undefined,
        from_name: formData.from_name || undefined,
        from_email: formData.from_email || undefined,
        reply_to: formData.reply_to || undefined,
        variables: formData.variables,
        organization_id: formData.is_system && isSuperAdmin ? null : organizationId,
        is_default: formData.is_default,
      })
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      toast.success('Template created successfully')
      onSave()
    },
    onError: (error) => {
      toast.error('Failed to create template', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error('No template to update')
      const result = await updateEmailTemplate(template.id, {
        name: formData.name,
        description: formData.description || undefined,
        subject: formData.subject,
        body_html: formData.body_html,
        body_text: formData.body_text || undefined,
        from_name: formData.from_name || undefined,
        from_email: formData.from_email || undefined,
        reply_to: formData.reply_to || undefined,
        variables: formData.variables,
        is_default: formData.is_default,
      })
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      toast.success('Template updated successfully')
      onSave()
    },
    onError: (error) => {
      toast.error('Failed to update template', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!template) {
        // Generate preview locally for new templates
        let subject = formData.subject
        let html = formData.body_html

        for (const variable of formData.variables) {
          const placeholder = `{{${variable.name}}}`
          const value = previewVariables[variable.name] || variable.default || `[${variable.label}]`
          const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g')
          subject = subject.replace(regex, value)
          html = html.replace(regex, value)
        }

        return { subject, html }
      }

      const result = await renderEmailTemplate(template.id, previewVariables)
      if (!result.success) throw new Error(result.error)
      return result.data
    },
    onSuccess: (data) => {
      if (data) {
        setRenderedPreview({
          subject: data.subject,
          html: data.html,
        })
      }
    },
  })

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required')
      return
    }
    if (!formData.subject.trim()) {
      toast.error('Subject is required')
      return
    }
    if (!formData.body_html.trim()) {
      toast.error('Email body is required')
      return
    }

    if (isCreateMode) {
      createMutation.mutate()
    } else {
      updateMutation.mutate()
    }
  }

  const insertVariable = (variableName: string, target: 'subject' | 'body') => {
    const placeholder = `{{${variableName}}}`

    if (target === 'subject' && subjectRef.current) {
      const input = subjectRef.current
      const start = input.selectionStart || 0
      const end = input.selectionEnd || 0
      const newValue = formData.subject.slice(0, start) + placeholder + formData.subject.slice(end)
      setFormData((prev) => ({ ...prev, subject: newValue }))
      setTimeout(() => {
        input.focus()
        input.setSelectionRange(start + placeholder.length, start + placeholder.length)
      }, 0)
    } else if (target === 'body' && bodyRef.current) {
      const textarea = bodyRef.current
      const start = textarea.selectionStart || 0
      const end = textarea.selectionEnd || 0
      const newValue = formData.body_html.slice(0, start) + placeholder + formData.body_html.slice(end)
      setFormData((prev) => ({ ...prev, body_html: newValue }))
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length)
      }, 0)
    }
  }

  const isSystemTemplate = template?.organization_id === null
  const canEdit = isSuperAdmin || !isSystemTemplate || isCreateMode
  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isCreateMode ? 'Create Email Template' : canEdit ? 'Edit Email Template' : 'View Email Template'}
          </DialogTitle>
          <DialogDescription>
            {isCreateMode
              ? 'Create a new email template for notifications.'
              : 'Customize how your email notifications look and feel.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">
              <Code className="mr-2 h-4 w-4" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview" onClick={() => previewMutation.mutate()}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="flex-1 overflow-y-auto mt-4 space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="My Custom Template"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Template Type</Label>
                <Select
                  value={formData.template_type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, template_type: value as EmailTemplateType }))
                  }
                  disabled={!isCreateMode}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this template"
                disabled={!canEdit}
              />
            </div>

            {/* Variables Section */}
            <Collapsible open={variablesOpen} onOpenChange={setVariablesOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-3">
                  <div className="flex items-center gap-2">
                    <Variable className="h-4 w-4" />
                    <span>Available Variables</span>
                    <Badge variant="secondary">{formData.variables.length}</Badge>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${variablesOpen ? 'rotate-180' : ''}`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Click a variable to insert it at your cursor position
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {formData.variables.map((variable) => (
                      <div key={variable.name} className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => insertVariable(variable.name, 'body')}
                          className="text-xs font-mono"
                          disabled={!canEdit}
                        >
                          {`{{${variable.name}}}`}
                        </Button>
                        {variable.required && (
                          <Badge variant="destructive" className="text-xs">
                            Required
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Subject */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="subject">Subject Line</Label>
                <div className="flex gap-1">
                  {formData.variables.slice(0, 3).map((v) => (
                    <Button
                      key={v.name}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => insertVariable(v.name, 'subject')}
                      disabled={!canEdit}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {v.name}
                    </Button>
                  ))}
                </div>
              </div>
              <Input
                ref={subjectRef}
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
                placeholder="Email subject line..."
                disabled={!canEdit}
              />
            </div>

            {/* Body HTML */}
            <div className="space-y-2">
              <Label htmlFor="body">Email Body (HTML)</Label>
              <Textarea
                ref={bodyRef}
                id="body"
                value={formData.body_html}
                onChange={(e) => setFormData((prev) => ({ ...prev, body_html: e.target.value }))}
                placeholder="<html>...</html>"
                className="min-h-[300px] font-mono text-sm"
                disabled={!canEdit}
              />
            </div>

            {/* Advanced Settings */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between px-3">
                  Advanced Settings
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="from_name">From Name</Label>
                    <Input
                      id="from_name"
                      value={formData.from_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, from_name: e.target.value }))}
                      placeholder="KT-Portal Support"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="from_email">From Email</Label>
                    <Input
                      id="from_email"
                      type="email"
                      value={formData.from_email}
                      onChange={(e) => setFormData((prev) => ({ ...prev, from_email: e.target.value }))}
                      placeholder="support@example.com"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reply_to">Reply-To</Label>
                    <Input
                      id="reply_to"
                      type="email"
                      value={formData.reply_to}
                      onChange={(e) => setFormData((prev) => ({ ...prev, reply_to: e.target.value }))}
                      placeholder="support@example.com"
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="is_default">Set as Default</Label>
                    <p className="text-xs text-muted-foreground">
                      Use this template by default for {formData.template_type.replace(/_/g, ' ')} emails
                    </p>
                  </div>
                  <Switch
                    id="is_default"
                    checked={formData.is_default}
                    onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_default: checked }))}
                    disabled={!canEdit}
                  />
                </div>

                {isSuperAdmin && isCreateMode && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="is_system">System Template</Label>
                      <p className="text-xs text-muted-foreground">
                        Make this a system-wide template (available to all organizations)
                      </p>
                    </div>
                    <Switch
                      id="is_system"
                      checked={formData.is_system}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_system: checked }))}
                    />
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-hidden flex flex-col mt-4">
            {/* Preview Variables */}
            <div className="mb-4 p-4 rounded-lg border bg-muted/30">
              <p className="text-sm font-medium mb-2">Test Variables</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {formData.variables.slice(0, 6).map((variable) => (
                  <div key={variable.name} className="space-y-1">
                    <Label className="text-xs">{variable.label}</Label>
                    <Input
                      value={previewVariables[variable.name] || ''}
                      onChange={(e) =>
                        setPreviewVariables((prev) => ({ ...prev, [variable.name]: e.target.value }))
                      }
                      placeholder={variable.default || variable.label}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => previewMutation.mutate()}
                className="mt-2"
                disabled={previewMutation.isPending}
              >
                {previewMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Refresh Preview
              </Button>
            </div>

            {/* Preview Frame */}
            <div className="flex-1 overflow-hidden rounded-lg border">
              {renderedPreview ? (
                <div className="h-full flex flex-col">
                  <div className="p-3 border-b bg-muted/30">
                    <p className="text-sm">
                      <strong>Subject:</strong> {renderedPreview.subject}
                    </p>
                  </div>
                  <iframe
                    srcDoc={renderedPreview.html}
                    className="flex-1 w-full border-0"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <p>Click &quot;Preview&quot; to see how your email will look</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {isCreateMode ? 'Create Template' : 'Save Changes'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function getDefaultTemplate(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
<tr><td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:32px;text-align:center;">
<h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:600;">{{portal_name}}</h1>
</td></tr>
<tr><td style="padding:32px;">
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">Hello,</p>
<p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">Your email content goes here.</p>
</td></tr>
<tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-top:1px solid #e5e7eb;">
<p style="color:#9ca3af;font-size:12px;margin:0;">{{portal_name}} | <a href="{{unsubscribe_url}}" style="color:#9ca3af;">Manage notifications</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
}

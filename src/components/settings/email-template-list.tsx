'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Loader2,
  Search,
  Mail,
  Plus,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Star,
  Globe,
  Building,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteEmailTemplate,
  duplicateEmailTemplate,
  setDefaultTemplate,
} from '@/lib/actions/email-templates'
import {
  type EmailTemplate,
  type EmailTemplateType,
  getTemplateTypeDisplayName,
} from '@/lib/email-templates-shared'
import { EmailTemplateEditor } from './email-template-editor'
import { SendTestEmailDialog } from './send-test-email-dialog'

interface EmailTemplateListProps {
  isSuperAdmin: boolean
  organizationId: string | null
}

const TEMPLATE_TYPE_GROUPS: Record<string, { label: string; types: EmailTemplateType[] }> = {
  tickets: {
    label: 'Tickets',
    types: ['ticket_created', 'ticket_updated', 'ticket_comment', 'ticket_assigned', 'ticket_resolved', 'ticket_closed'],
  },
  invoices: {
    label: 'Invoices',
    types: ['new_invoice', 'invoice_paid', 'invoice_overdue'],
  },
  users: {
    label: 'Users & Organizations',
    types: ['new_user', 'new_tenant', 'new_organization', 'welcome'],
  },
  sla: {
    label: 'SLA Alerts',
    types: ['sla_warning', 'sla_breach'],
  },
  projects: {
    label: 'Projects & Services',
    types: ['new_project', 'new_service_request', 'new_task'],
  },
  auth: {
    label: 'Authentication',
    types: ['password_reset', 'magic_link'],
  },
}


export function EmailTemplateList({ isSuperAdmin, organizationId }: EmailTemplateListProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<EmailTemplate | null>(null)
  const [testEmailTemplate, setTestEmailTemplate] = useState<EmailTemplate | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'organization' | 'system'>('all')

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('template_type', { ascending: true })
        .order('is_default', { ascending: false })
        .order('name', { ascending: true })

      if (error) throw error
      return data as EmailTemplate[]
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const result = await deleteEmailTemplate(templateId)
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      toast.success('Template deleted successfully')
      setTemplateToDelete(null)
    },
    onError: (error) => {
      toast.error('Failed to delete template', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const result = await duplicateEmailTemplate(templateId)
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      toast.success('Template duplicated successfully')
      if (result.data) {
        setSelectedTemplate(result.data)
        setIsCreateMode(false)
        setIsEditorOpen(true)
      }
    },
    onError: (error) => {
      toast.error('Failed to duplicate template', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  // Set default mutation
  const setDefaultMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const result = await setDefaultTemplate(templateId)
      if (!result.success) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] })
      toast.success('Template set as default')
    },
    onError: (error) => {
      toast.error('Failed to set default template', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
    },
  })

  // Filter templates
  const filteredTemplates = templates?.filter((template) => {
    // Search filter
    const matchesSearch =
      !searchQuery ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getTemplateTypeDisplayName(template.template_type).toLowerCase().includes(searchQuery.toLowerCase())

    // Tab filter
    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'system' && template.organization_id === null) ||
      (activeTab === 'organization' && template.organization_id !== null)

    return matchesSearch && matchesTab
  })

  // Group templates by type
  const groupedTemplates = Object.entries(TEMPLATE_TYPE_GROUPS).map(([key, group]) => ({
    key,
    label: group.label,
    templates: filteredTemplates?.filter((t) => group.types.includes(t.template_type)) || [],
  }))

  const handleEdit = (template: EmailTemplate) => {
    setSelectedTemplate(template)
    setIsCreateMode(false)
    setIsEditorOpen(true)
  }

  const handleCreate = () => {
    setSelectedTemplate(null)
    setIsCreateMode(true)
    setIsEditorOpen(true)
  }

  const handleEditorClose = () => {
    setIsEditorOpen(false)
    setSelectedTemplate(null)
    setIsCreateMode(false)
  }

  const handleEditorSave = () => {
    queryClient.invalidateQueries({ queryKey: ['email-templates'] })
    handleEditorClose()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="all">All Templates</TabsTrigger>
          <TabsTrigger value="organization">
            <Building className="mr-2 h-4 w-4" />
            Organization
          </TabsTrigger>
          {isSuperAdmin && (
            <TabsTrigger value="system">
              <Globe className="mr-2 h-4 w-4" />
              System Defaults
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {groupedTemplates.every((g) => g.templates.length === 0) ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No templates found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? 'Try adjusting your search' : 'Create your first email template'}
                </p>
                {!searchQuery && (
                  <Button className="mt-4" onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Template
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {groupedTemplates
                .filter((group) => group.templates.length > 0)
                .map((group) => (
                  <div key={group.key}>
                    <h3 className="text-lg font-semibold mb-4">{group.label}</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {group.templates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          isSuperAdmin={isSuperAdmin}
                          organizationId={organizationId}
                          onEdit={() => handleEdit(template)}
                          onDuplicate={() => duplicateMutation.mutate(template.id)}
                          onDelete={() => setTemplateToDelete(template)}
                          onSetDefault={() => setDefaultMutation.mutate(template.id)}
                          onSendTest={() => setTestEmailTemplate(template)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Editor Dialog */}
      <EmailTemplateEditor
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        template={selectedTemplate}
        isCreateMode={isCreateMode}
        isSuperAdmin={isSuperAdmin}
        organizationId={organizationId}
        onSave={handleEditorSave}
        onCancel={handleEditorClose}
      />

      {/* Send Test Email Dialog */}
      {testEmailTemplate && (
        <SendTestEmailDialog
          open={!!testEmailTemplate}
          onOpenChange={(open) => !open && setTestEmailTemplate(null)}
          template={testEmailTemplate}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{templateToDelete?.name}&quot;? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => templateToDelete && deleteMutation.mutate(templateToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface TemplateCardProps {
  template: EmailTemplate
  isSuperAdmin: boolean
  organizationId: string | null
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onSetDefault: () => void
  onSendTest: () => void
}

function TemplateCard({
  template,
  isSuperAdmin,
  organizationId,
  onEdit,
  onDuplicate,
  onDelete,
  onSetDefault,
  onSendTest,
}: TemplateCardProps) {
  const isSystemTemplate = template.organization_id === null
  const canEdit = isSuperAdmin || (!isSystemTemplate && template.organization_id === organizationId)
  const canDelete = canEdit && !template.is_default
  const canSetDefault = canEdit && !template.is_default

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base font-medium truncate">{template.name}</CardTitle>
              {template.is_default && (
                <Badge variant="secondary" className="shrink-0">
                  <Star className="mr-1 h-3 w-3" />
                  Default
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              {getTemplateTypeDisplayName(template.template_type)}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onSendTest}>
                <Send className="mr-2 h-4 w-4" />
                Send Test Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" />
                {canEdit ? 'Edit' : 'View'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              {canSetDefault && (
                <DropdownMenuItem onClick={onSetDefault}>
                  <Star className="mr-2 h-4 w-4" />
                  Set as Default
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isSystemTemplate ? (
            <Badge variant="outline" className="text-xs">
              <Globe className="mr-1 h-3 w-3" />
              System
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              <Building className="mr-1 h-3 w-3" />
              Custom
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{template.subject}</p>
      </CardContent>
    </Card>
  )
}

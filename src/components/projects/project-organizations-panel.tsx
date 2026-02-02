'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Building2, Plus, Loader2, Trash2 } from 'lucide-react'
import { PROJECT_ORG_ROLE_OPTIONS } from '@/lib/validators/project'

type ProjectOrganization = {
  id: string
  organization_id: string
  role: string
  is_active: boolean
  organization: {
    id: string
    name: string
    type: string
    status: string
  } | null
}

type Organization = {
  id: string
  name: string
  type: string
  status: string
}

interface ProjectOrganizationsPanelProps {
  projectId: string
  projectOrganizations: ProjectOrganization[]
  availableOrganizations: Organization[]
  canEdit: boolean
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'client':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'partner':
      return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'vendor':
      return 'bg-orange-100 text-orange-700 border-orange-200'
    case 'collaborator':
      return 'bg-green-100 text-green-700 border-green-200'
    default:
      return ''
  }
}

export function ProjectOrganizationsPanel({
  projectId,
  projectOrganizations,
  availableOrganizations,
  canEdit,
}: ProjectOrganizationsPanelProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedOrgs, setSelectedOrgs] = useState<{ orgId: string; role: string }[]>([])
  const [updatingOrgId, setUpdatingOrgId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const activeOrgs = projectOrganizations.filter((o) => o.is_active)
  const existingOrgIds = projectOrganizations.map((o) => o.organization_id)
  const availableToAdd = availableOrganizations.filter((o) => !existingOrgIds.includes(o.id))

  const toggleOrg = (orgId: string) => {
    setSelectedOrgs((prev) => {
      const existing = prev.find((o) => o.orgId === orgId)
      if (existing) {
        return prev.filter((o) => o.orgId !== orgId)
      }
      return [...prev, { orgId, role: 'client' }]
    })
  }

  const updateSelectedRole = (orgId: string, role: string) => {
    setSelectedOrgs((prev) => prev.map((o) => (o.orgId === orgId ? { ...o, role } : o)))
  }

  async function handleAddOrganizations() {
    if (selectedOrgs.length === 0) return

    setIsSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const inserts = selectedOrgs.map((o) => ({
        project_id: projectId,
        organization_id: o.orgId,
        role: o.role,
        assigned_by: user?.id,
      }))

      const { error } = await supabase.from('project_organizations').insert(inserts)

      if (error) throw error

      setIsAddDialogOpen(false)
      setSelectedOrgs([])
      router.refresh()
    } catch (error) {
      console.error('Failed to add organizations:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateRole(projectOrgId: string, newRole: string) {
    setUpdatingOrgId(projectOrgId)
    try {
      const { error } = await supabase
        .from('project_organizations')
        .update({ role: newRole })
        .eq('id', projectOrgId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to update role:', error)
    } finally {
      setUpdatingOrgId(null)
    }
  }

  async function handleRemoveOrganization(projectOrgId: string) {
    if (!confirm('Are you sure you want to remove this organization from the project?')) return

    setUpdatingOrgId(projectOrgId)
    try {
      const { error } = await supabase
        .from('project_organizations')
        .update({ is_active: false })
        .eq('id', projectOrgId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to remove organization:', error)
    } finally {
      setUpdatingOrgId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>
              Client organizations and partners associated with this project
            </CardDescription>
          </div>
          {canEdit && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Organization
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Organizations</DialogTitle>
                  <DialogDescription>
                    Select organizations to associate with this project.
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[400px] pr-4">
                  {availableToAdd.length === 0 ? (
                    <p className="py-8 text-center text-slate-500">
                      All available organizations are already assigned.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableToAdd.map((org) => {
                        const isSelected = selectedOrgs.some((o) => o.orgId === org.id)
                        const selection = selectedOrgs.find((o) => o.orgId === org.id)

                        return (
                          <div
                            key={org.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`add-org-${org.id}`}
                                checked={isSelected}
                                onCheckedChange={() => toggleOrg(org.id)}
                              />
                              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-slate-500" />
                              </div>
                              <Label
                                htmlFor={`add-org-${org.id}`}
                                className="cursor-pointer font-normal"
                              >
                                <span className="block">{org.name}</span>
                                <span className="text-xs text-slate-500 capitalize">{org.type}</span>
                              </Label>
                            </div>
                            {isSelected && (
                              <Select
                                value={selection?.role ?? 'client'}
                                onValueChange={(value) => updateSelectedRole(org.id, value)}
                              >
                                <SelectTrigger className="w-[130px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PROJECT_ORG_ROLE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </ScrollArea>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAddDialogOpen(false)
                      setSelectedOrgs([])
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddOrganizations}
                    disabled={selectedOrgs.length === 0 || isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add {selectedOrgs.length > 0 ? `(${selectedOrgs.length})` : ''}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activeOrgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <Building2 className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No organizations</h3>
            <p className="text-slate-500 text-sm">
              {canEdit
                ? 'Add client organizations to associate with this project.'
                : 'No organizations have been assigned yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrgs.map((projectOrg) => {
              const org = projectOrg.organization
              const isUpdating = updatingOrgId === projectOrg.id

              return (
                <div
                  key={projectOrg.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{org?.name ?? 'Unknown'}</p>
                      <p className="text-sm text-slate-500 capitalize">{org?.type ?? 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <>
                        <Select
                          value={projectOrg.role}
                          onValueChange={(value) => handleUpdateRole(projectOrg.id, value)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROJECT_ORG_ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOrganization(projectOrg.id)}
                          disabled={isUpdating}
                          className="text-slate-400 hover:text-red-500"
                        >
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Badge variant="outline" className={getRoleBadgeColor(projectOrg.role)}>
                        {PROJECT_ORG_ROLE_OPTIONS.find((r) => r.value === projectOrg.role)?.label ??
                          projectOrg.role}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

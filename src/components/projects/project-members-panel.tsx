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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserPlus, Loader2, Trash2, Users } from 'lucide-react'
import { PROJECT_MEMBER_ROLE_OPTIONS } from '@/lib/validators/project'

type ProjectMember = {
  id: string
  user_id: string
  role: string
  is_active: boolean
  joined_at: string
  user: {
    id: string
    email: string
    role: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

type StaffUser = {
  id: string
  email: string
  role: string
  profiles: { name: string | null; avatar_url: string | null } | null
}

interface ProjectMembersPanelProps {
  projectId: string
  members: ProjectMember[]
  availableStaff: StaffUser[]
  canEdit: boolean
}

function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'project_manager':
      return 'bg-purple-100 text-purple-700 border-purple-200'
    case 'account_manager':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'team_member':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'observer':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return ''
  }
}

export function ProjectMembersPanel({
  projectId,
  members,
  availableStaff,
  canEdit,
}: ProjectMembersPanelProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState<{ userId: string; role: string }[]>([])
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const activeMembers = members.filter((m) => m.is_active)
  const existingMemberIds = members.map((m) => m.user_id)
  const availableToAdd = availableStaff.filter((s) => !existingMemberIds.includes(s.id))

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const existing = prev.find((u) => u.userId === userId)
      if (existing) {
        return prev.filter((u) => u.userId !== userId)
      }
      return [...prev, { userId, role: 'team_member' }]
    })
  }

  const updateSelectedRole = (userId: string, role: string) => {
    setSelectedUsers((prev) =>
      prev.map((u) => (u.userId === userId ? { ...u, role } : u))
    )
  }

  async function handleAddMembers() {
    if (selectedUsers.length === 0) return

    setIsSubmitting(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const inserts = selectedUsers.map((s) => ({
        project_id: projectId,
        user_id: s.userId,
        role: s.role,
        assigned_by: user?.id,
      }))

      const { error } = await supabase.from('project_members').insert(inserts)

      if (error) throw error

      setIsAddDialogOpen(false)
      setSelectedUsers([])
      router.refresh()
    } catch (error) {
      console.error('Failed to add members:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleUpdateRole(memberId: string, newRole: string) {
    setUpdatingMemberId(memberId)
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to update role:', error)
    } finally {
      setUpdatingMemberId(null)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Are you sure you want to remove this member from the project?')) return

    setUpdatingMemberId(memberId)
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ is_active: false, left_at: new Date().toISOString() })
        .eq('id', memberId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to remove member:', error)
    } finally {
      setUpdatingMemberId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>
              People assigned to work on this project
            </CardDescription>
          </div>
          {canEdit && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Team Members</DialogTitle>
                  <DialogDescription>
                    Select staff members to add to this project.
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[400px] pr-4">
                  {availableToAdd.length === 0 ? (
                    <p className="py-8 text-center text-slate-500">
                      All available staff members are already assigned.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {availableToAdd.map((user) => {
                        const isSelected = selectedUsers.some((s) => s.userId === user.id)
                        const selection = selectedUsers.find((s) => s.userId === user.id)
                        const displayName = user.profiles?.name ?? user.email

                        return (
                          <div
                            key={user.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`add-member-${user.id}`}
                                checked={isSelected}
                                onCheckedChange={() => toggleUser(user.id)}
                              />
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={user.profiles?.avatar_url ?? undefined} />
                                <AvatarFallback className="text-xs">
                                  {displayName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <Label
                                htmlFor={`add-member-${user.id}`}
                                className="cursor-pointer font-normal"
                              >
                                <span className="block">{displayName}</span>
                                <span className="text-xs text-slate-500">{user.email}</span>
                              </Label>
                            </div>
                            {isSelected && (
                              <Select
                                value={selection?.role ?? 'team_member'}
                                onValueChange={(value) => updateSelectedRole(user.id, value)}
                              >
                                <SelectTrigger className="w-[130px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PROJECT_MEMBER_ROLE_OPTIONS.map((option) => (
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
                      setSelectedUsers([])
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddMembers}
                    disabled={selectedUsers.length === 0 || isSubmitting}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add {selectedUsers.length > 0 ? `(${selectedUsers.length})` : ''}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {activeMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <Users className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No team members</h3>
            <p className="text-slate-500 text-sm">
              {canEdit
                ? 'Add team members to start collaborating on this project.'
                : 'No team members have been assigned yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeMembers.map((member) => {
              const displayName = member.user?.profiles?.name ?? member.user?.email ?? 'Unknown'
              const initials = displayName.slice(0, 2).toUpperCase()
              const isUpdating = updatingMemberId === member.id

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-slate-50/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.user?.profiles?.avatar_url ?? undefined} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-slate-900">{displayName}</p>
                      <p className="text-sm text-slate-500">{member.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleUpdateRole(member.id, value)}
                          disabled={isUpdating}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PROJECT_MEMBER_ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
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
                      <Badge variant="outline" className={getRoleBadgeColor(member.role)}>
                        {PROJECT_MEMBER_ROLE_OPTIONS.find((r) => r.value === member.role)?.label ??
                          member.role}
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

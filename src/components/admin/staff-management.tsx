'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { UserPlus, X, CheckCircle, AlertCircle, Users, Building, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface StaffMember {
  id: string
  email: string
  role: string
  status: string
  profiles: { name: string | null }
}

interface Organization {
  id: string
  name: string
  type: string
}

interface StaffAssignment {
  id: string
  staff_user_id: string
  organization_id: string
  assignment_role: string | null
  assigned_at: string
  organizations: { id: string; name: string }
  users: { id: string; email: string; profiles: { name: string | null } }
}

interface StaffManagementProps {
  staffMembers: StaffMember[]
  organizations: Organization[]
  initialAssignments: StaffAssignment[]
}

const ASSIGNMENT_ROLE_OPTIONS = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'account_manager', label: 'Account Manager' },
  { value: 'technical_lead', label: 'Technical Lead' },
  { value: 'support_specialist', label: 'Support Specialist' },
] as const

export function StaffManagement({
  staffMembers,
  organizations,
  initialAssignments,
}: StaffManagementProps) {
  const router = useRouter()
  const [assignments, setAssignments] = useState(initialAssignments)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  const [selectedOrg, setSelectedOrg] = useState<string>('')
  const [assignmentRole, setAssignmentRole] = useState<string>('project_manager')

  // Edit state
  const [editingAssignment, setEditingAssignment] = useState<StaffAssignment | null>(null)
  const [editAssignmentRole, setEditAssignmentRole] = useState<string>('project_manager')

  useEffect(() => {
    setAssignments(initialAssignments)
  }, [initialAssignments])

  const handleAddAssignment = async () => {
    if (!selectedStaff || !selectedOrg) {
      setError('Please select both a staff member and an organization')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/staff-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_user_id: selectedStaff,
          organization_id: selectedOrg,
          assignment_role: assignmentRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create assignment')
      }

      toast.success('Staff member assigned successfully')
      if (data?.data) {
        setAssignments((prev) => [data.data as StaffAssignment, ...prev])
      }
      setIsAddDialogOpen(false)
      setSelectedStaff('')
      setSelectedOrg('')
      setAssignmentRole('project_manager')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditDialog = (assignment: StaffAssignment) => {
    setEditingAssignment(assignment)
    setEditAssignmentRole(assignment.assignment_role || 'project_manager')
    setError(null)
    setIsEditDialogOpen(true)
  }

  const handleUpdateAssignment = async () => {
    if (!editingAssignment) return

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/staff-assignments/${editingAssignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_role: editAssignmentRole,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update assignment')
      }

      toast.success('Assignment updated successfully')
      if (data?.data) {
        const updated = data.data as StaffAssignment
        setAssignments((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)))
      }

      setIsEditDialogOpen(false)
      setEditingAssignment(null)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this assignment?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/staff-assignments/${assignmentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove assignment')
      }

      toast.success('Assignment removed successfully')
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const assignmentsByStaff = useMemo(() => {
    // Group assignments by staff member
    return assignments.reduce((acc, assignment) => {
      const staffId = assignment.staff_user_id
      if (!acc[staffId]) {
        acc[staffId] = []
      }
      acc[staffId].push(assignment)
      return acc
    }, {} as Record<string, StaffAssignment[]>)
  }, [assignments])

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Global Access:</strong> All staff members automatically have access to all organizations.
          Assignments below are optional for tracking project managers and account managers.
        </AlertDescription>
      </Alert>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{staffMembers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{organizations.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Assignments</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{assignments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Staff Members & Assignments</CardTitle>
              <CardDescription>
                Manage which staff members are assigned to which organizations
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Assign Staff
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign Staff to Organization</DialogTitle>
                  <DialogDescription>
                    Assign a staff member to an organization as a project manager or account manager.
                  </DialogDescription>
                </DialogHeader>

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="staff-select">Staff Member</Label>
                    <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                      <SelectTrigger id="staff-select">
                        <SelectValue placeholder="Select staff member" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffMembers.map((staff) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.profiles?.name || staff.email}
                            <span className="text-muted-foreground ml-2">
                              ({staff.role})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="org-select">Organization</Label>
                    <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                      <SelectTrigger id="org-select">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                            <span className="text-muted-foreground ml-2 text-xs">
                              ({org.type})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role-select">Assignment Role</Label>
                    <Select value={assignmentRole} onValueChange={setAssignmentRole}>
                      <SelectTrigger id="role-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNMENT_ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddAssignment} disabled={isSubmitting}>
                    {isSubmitting ? 'Assigning...' : 'Assign'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned Organizations</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffMembers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No staff members found
                  </TableCell>
                </TableRow>
              ) : (
                staffMembers.map((staff) => {
                  const staffAssignments = assignmentsByStaff[staff.id] || []
                  return (
                    <TableRow key={staff.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{staff.profiles?.name || 'Unnamed'}</div>
                          <div className="text-sm text-muted-foreground">{staff.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={staff.role === 'super_admin' ? 'default' : 'secondary'}>
                          {staff.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={staff.status === 'active' ? 'default' : 'secondary'}>
                          {staff.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {staffAssignments.length === 0 ? (
                          <span className="text-sm text-muted-foreground">
                            No specific assignments (has global access)
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {staffAssignments.map((assignment) => (
                              <Badge
                                key={assignment.id}
                                variant="outline"
                                className="flex items-center gap-1"
                              >
                                {assignment.organizations.name}
                                {assignment.assignment_role && (
                                  <span className="text-xs opacity-70">
                                    ({assignment.assignment_role.replace('_', ' ')})
                                  </span>
                                )}
                                <button
                                  onClick={() => openEditDialog(assignment)}
                                  className="ml-1 hover:text-primary"
                                  title="Edit assignment"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => handleRemoveAssignment(assignment.id)}
                                  className="ml-1 hover:text-destructive"
                                  title="Remove assignment"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs text-muted-foreground">
                          {staffAssignments.length} assignment{staffAssignments.length !== 1 ? 's' : ''}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Assignment Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Staff Assignment</DialogTitle>
            <DialogDescription>
              Update the assignment role for this staff member.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="text-sm">
              <div className="font-medium">
                {editingAssignment?.users?.profiles?.name || editingAssignment?.users?.email}
              </div>
              <div className="text-muted-foreground">
                {editingAssignment?.organizations?.name}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role-select">Assignment Role</Label>
              <Select value={editAssignmentRole} onValueChange={setEditAssignmentRole}>
                <SelectTrigger id="edit-role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNMENT_ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateAssignment} disabled={isUpdating || !editingAssignment}>
              {isUpdating ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

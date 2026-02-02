'use client'

import { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateUser } from '@/lib/actions/admin-users'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import type { UserRole, UpdateUserInput } from '@/lib/validators/user'

interface EditUserDialogProps {
  user: {
    id: string
    role: string
    organization_id: string | null
    is_account_manager?: boolean
    status?: string
    user_profiles: { name: string | null }[]
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  currentUserRole: UserRole
  organizations?: { id: string; name: string }[]
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onSuccess,
  currentUserRole,
  organizations = [],
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  
  // Form state
  const [name, setName] = useState(user.user_profiles[0]?.name || '')
  const [role, setRole] = useState<string>(user.role || 'client')
  const [organizationId, setOrganizationId] = useState<string>(user.organization_id || '')
  const [isAccountManager, setIsAccountManager] = useState<boolean>(!!user.is_account_manager)
  const [status, setStatus] = useState<string>(user.status || 'active')

  const canEditPermissions = currentUserRole === 'super_admin'
  const showAccountManager = canEditPermissions && (role === 'staff' || role === 'super_admin')
  const showOrganization = canEditPermissions && (role === 'client' || role === 'partner_staff')
  const showStatus = canEditPermissions

  const roleOptions = useMemo(() => {
    const options: { value: UserRole; label: string }[] = [
      { value: 'client', label: 'Client' },
      { value: 'staff', label: 'Staff' },
      { value: 'super_admin', label: 'Super Admin' },
      { value: 'partner', label: 'Partner' },
      { value: 'partner_staff', label: 'Partner Staff' },
    ]
    return options
  }, [])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload: UpdateUserInput = canEditPermissions
        ? {
            name,
            role: role as UserRole,
            organization_id: showOrganization ? (organizationId || null) : undefined,
            is_account_manager: showAccountManager ? isAccountManager : undefined,
            status: showStatus ? (status as any) : undefined,
          }
        : { name }

      const result = await updateUser(user.id, payload)

      if (result.success) {
        toast({ title: 'Success', description: 'User updated successfully' })
        onSuccess()
        onOpenChange(false)
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{canEditPermissions ? 'Edit Permissions' : 'Edit User'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="User's full name"
            />
          </div>
          
          {canEditPermissions && (
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showOrganization && (
            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showAccountManager && (
            <div className="space-y-2">
              <Label htmlFor="account-manager">Account Manager</Label>
              <Select
                value={isAccountManager ? 'yes' : 'no'}
                onValueChange={(v) => setIsAccountManager(v === 'yes')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showStatus && (
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

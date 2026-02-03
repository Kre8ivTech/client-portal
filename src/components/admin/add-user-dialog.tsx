'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createUser } from '@/lib/actions/admin-users'
import { useToast } from '@/hooks/use-toast'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getAllowedRolesToCreate, type UserRole } from '@/lib/validators/user'

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  currentUserRole: UserRole
  isAccountManager: boolean
  organizations?: { id: string; name: string }[]
}

export function AddUserDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  currentUserRole,
  isAccountManager,
  organizations = []
}: AddUserDialogProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  
  // Form state
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<string>('client')
  const [organizationId, setOrganizationId] = useState<string>('')
  const [isAccountManagerFlag, setIsAccountManagerFlag] = useState(false)
  const [sendInviteEmail, setSendInviteEmail] = useState(true)

  // Get allowed roles based on current user
  const allowedRoles = getAllowedRolesToCreate(currentUserRole, isAccountManager)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setEmail('')
      setName('')
      setRole('client')
      setOrganizationId('')
      setIsAccountManagerFlag(false)
      setSendInviteEmail(true)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Basic client-side validation
      if (!email || !name || !role) {
        toast({ 
          title: 'Validation Error', 
          description: 'Please fill in all required fields', 
          variant: 'destructive' 
        })
        setLoading(false)
        return
      }

      // If creating a client, organization is required
      if (role === 'client' && !organizationId && currentUserRole === 'super_admin') {
        toast({ 
          title: 'Validation Error', 
          description: 'Organization is required for client users', 
          variant: 'destructive' 
        })
        setLoading(false)
        return
      }

      const result = await createUser({
        email: email.trim(),
        name: name.trim(),
        role: role as UserRole,
        organization_id: organizationId || null,
        is_account_manager: isAccountManagerFlag,
        send_invite_email: sendInviteEmail,
      })

      if (result.success) {
        toast({ 
          title: 'Success', 
          description: `User ${name} created successfully${sendInviteEmail ? '. An invite email has been sent.' : '.'}` 
        })
        onSuccess()
        onOpenChange(false)
      } else {
        toast({ 
          title: 'Error', 
          description: result.error || 'Failed to create user', 
          variant: 'destructive' 
        })
      }
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'An unexpected error occurred', 
        variant: 'destructive' 
      })
    } finally {
      setLoading(false)
    }
  }

  // Check if staff role can be created and if account manager flag is relevant
  const canCreateStaff = allowedRoles.includes('staff' as UserRole)
  const showAccountManagerFlag = role === 'staff' || role === 'super_admin'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account. An invite email will be sent to set up their password.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="required">
              Email Address
            </Label>
            <Input 
              id="email" 
              type="email"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="user@example.com"
              required
              disabled={loading}
            />
          </div>
          
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="required">
              Full Name
            </Label>
            <Input 
              id="name" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="John Doe"
              required
              disabled={loading}
            />
          </div>
          
          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role" className="required">
              Role
            </Label>
            <Select value={role} onValueChange={setRole} disabled={loading}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedRoles.includes('client' as UserRole) && (
                  <SelectItem value="client">Client</SelectItem>
                )}
                {allowedRoles.includes('staff' as UserRole) && (
                  <SelectItem value="staff">Staff</SelectItem>
                )}
                {allowedRoles.includes('super_admin' as UserRole) && (
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                )}
                {allowedRoles.includes('partner' as UserRole) && (
                  <SelectItem value="partner">Partner</SelectItem>
                )}
                {allowedRoles.includes('partner_staff' as UserRole) && (
                  <SelectItem value="partner_staff">Partner Staff</SelectItem>
                )}
              </SelectContent>
            </Select>
            {!canCreateStaff && (
              <p className="text-xs text-muted-foreground">
                You can only create client users
              </p>
            )}
          </div>

          {/* Organization - Only show for super_admin when creating clients or if organizations available */}
          {(role === 'client' || role === 'partner_staff') && organizations.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="organization" className={role === 'client' ? 'required' : ''}>
                Organization
              </Label>
              <Select value={organizationId} onValueChange={setOrganizationId} disabled={loading}>
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

          {/* Account Manager Flag - Only for staff and super_admin roles */}
          {showAccountManagerFlag && canCreateStaff && (
            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="account-manager" className="text-base">
                  Account Manager
                </Label>
                <p className="text-sm text-muted-foreground">
                  Can manage invoices and financial operations
                </p>
              </div>
              <Switch
                id="account-manager"
                checked={isAccountManagerFlag}
                onCheckedChange={setIsAccountManagerFlag}
                disabled={loading}
              />
            </div>
          )}

          {/* Send Invite Email */}
          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="send-invite" className="text-base">
                Send Invite Email
              </Label>
              <p className="text-sm text-muted-foreground">
                User will receive an email to set their password
              </p>
            </div>
            <Switch
              id="send-invite"
              checked={sendInviteEmail}
              onCheckedChange={setSendInviteEmail}
              disabled={loading}
            />
          </div>

          {/* Warning about password */}
          {!sendInviteEmail && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The user will need to use the &quot;Forgot Password&quot; feature to set their password.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

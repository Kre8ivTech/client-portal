import { createServerSupabaseClient } from '@/lib/supabase/server'
import { PermissionsManagement } from '@/components/admin/permissions-management'
import { redirect } from 'next/navigation'

export default async function PermissionsPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'super_admin') {
    redirect('/dashboard')
  }

  // Fetch all permissions
  const { data: permissions } = await (supabase as any)
    .from('permissions')
    .select('*')
    .order('category, name')

  // Fetch role permissions
  const { data: rolePermissions } = await (supabase as any)
    .from('role_permissions')
    .select('role, permission_id, permissions(name, label, category)')
    .order('role')

  // Group by role
  const permissionsByRole = (rolePermissions || []).reduce((acc: any, rp: any) => {
    if (!acc[rp.role]) acc[rp.role] = []
    acc[rp.role].push(rp.permission_id)
    return acc
  }, {})

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Permissions Management</h1>
        <p className="text-muted-foreground mt-2">
          Configure granular permissions for each role. Super admins always have all permissions.
        </p>
      </div>

      <PermissionsManagement
        permissions={permissions || []}
        initialRolePermissions={permissionsByRole}
      />
    </div>
  )
}

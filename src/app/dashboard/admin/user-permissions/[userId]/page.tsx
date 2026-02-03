import { createServerSupabaseClient } from '@/lib/supabase/server'
import { UserPermissionsEditor } from '@/components/admin/user-permissions-editor'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function UserPermissionsPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { userId } = await params

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

  // Fetch the target user
  const { data: targetUser } = await (supabase as any)
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!targetUser) {
    redirect('/dashboard/users')
  }

  // Fetch all permissions
  const { data: allPermissions } = await (supabase as any)
    .from('permissions')
    .select('*')
    .order('category, name')

  // Fetch user's role permissions
  const { data: rolePerms } = await (supabase as any)
    .from('role_permissions')
    .select('permission_id')
    .eq('role', targetUser.role)

  const rolePermissionIds = (rolePerms || []).map((rp: any) => rp.permission_id)

  // Fetch user-specific permission overrides
  const { data: userPerms } = await (supabase as any)
    .from('user_permissions')
    .select('*, permissions(id, name, label, category)')
    .eq('user_id', userId)

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/users">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Permissions</h1>
          <p className="text-muted-foreground mt-1">
            Manage permissions for {targetUser.name || targetUser.email}
          </p>
        </div>
      </div>

      <UserPermissionsEditor
        targetUser={targetUser}
        allPermissions={allPermissions || []}
        rolePermissionIds={rolePermissionIds}
        initialUserPermissions={userPerms || []}
      />
    </div>
  )
}

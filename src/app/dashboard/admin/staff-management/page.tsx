import { createServerSupabaseClient } from '@/lib/supabase/server'
import { StaffManagement } from '@/components/admin/staff-management'
import { redirect } from 'next/navigation'

export default async function StaffManagementPage() {
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

  // Fetch all staff members
  const { data: staffMembers } = await (supabase as any)
    .from('users')
    .select('id, email, role, status, profiles!inner(name)')
    .in('role', ['super_admin', 'staff'])
    .order('email')

  // Fetch all organizations
  const { data: organizations } = await (supabase as any)
    .from('organizations')
    .select('id, name, type')
    .order('name')

  // Fetch existing staff assignments
  const { data: staffAssignments } = await (supabase as any)
    .from('staff_organization_assignments')
    .select(`
      *,
      organizations(id, name),
      users!staff_user_id(id, email, profiles(name))
    `)
    .eq('is_active', true)
    .order('assigned_at', { ascending: false })

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
        <p className="text-muted-foreground mt-2">
          Assign staff members (project managers/account managers) to organizations. 
          Staff members have global access to all organizations.
        </p>
      </div>

      <StaffManagement
        staffMembers={staffMembers || []}
        organizations={organizations || []}
        initialAssignments={staffAssignments || []}
      />
    </div>
  )
}

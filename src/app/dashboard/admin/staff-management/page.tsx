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

  if (!profile) {
    redirect('/dashboard')
  }

  const isSuperAdmin = profile.role === 'super_admin'
  const isStaff = profile.role === 'staff'

  // Staff users can access this page only if they are an active project manager for at least one org.
  let managedOrganizationIds: string[] | null = null
  if (!isSuperAdmin) {
    if (!isStaff) redirect('/dashboard')

    const { data: pmAssignments } = await (supabase as any)
      .from('staff_organization_assignments')
      .select('organization_id')
      .eq('staff_user_id', user.id)
      .eq('is_active', true)
      .eq('assignment_role', 'project_manager')

    managedOrganizationIds = (pmAssignments ?? []).map((a: any) => a.organization_id)
    if (managedOrganizationIds.length === 0) {
      redirect('/dashboard')
    }
  }

  // Fetch all staff members
  const { data: staffMembers } = await (supabase as any)
    .from('users')
    .select('id, email, role, status, profiles!inner(name)')
    .in('role', ['super_admin', 'staff'])
    .order('email')

  // Fetch organizations (super_admin sees all; staff project managers see managed orgs only)
  const orgQuery = (supabase as any)
    .from('organizations')
    .select('id, name, type')
    .order('name')
  const { data: organizations } = managedOrganizationIds
    ? await orgQuery.in('id', managedOrganizationIds)
    : await orgQuery

  // Fetch existing staff assignments
  const assignmentsQuery = (supabase as any)
    .from('staff_organization_assignments')
    .select(
      `
      *,
      organizations(id, name),
      users!staff_user_id(id, email, profiles(name))
    `
    )
    .eq('is_active', true)
    .order('assigned_at', { ascending: false })
  const { data: staffAssignments } = managedOrganizationIds
    ? await assignmentsQuery.in('organization_id', managedOrganizationIds)
    : await assignmentsQuery

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

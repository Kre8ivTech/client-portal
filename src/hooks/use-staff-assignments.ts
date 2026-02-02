import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type StaffAssignment = Database['public']['Tables']['staff_assignments']['Row']
type StaffAssignmentInsert = Database['public']['Tables']['staff_assignments']['Insert']

interface StaffWithProfile {
  id: string
  email: string
  organization_id: string
  role: string
  profiles: {
    name: string | null
    avatar_url: string | null
  } | null
}

export function useStaffAssignments(
  assignableType: string,
  assignableId: string
) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch staff assignments for a resource
  const { data: assignments, isLoading, error } = useQuery({
    queryKey: ['staff-assignments', assignableType, assignableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_assignments')
        .select(`
          *,
          staff:users!staff_user_id(
            id,
            email,
            organization_id,
            role,
            profiles(name, avatar_url)
          ),
          assigned_by_user:users!assigned_by(
            id,
            profiles(name)
          )
        `)
        .eq('assignable_type', assignableType)
        .eq('assignable_id', assignableId)
        .is('unassigned_at', null)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as (StaffAssignment & {
        staff: StaffWithProfile
        assigned_by_user: { id: string; profiles: { name: string | null } | null } | null
      })[]
    },
    enabled: !!assignableId && !!assignableType,
  })

  // Assign staff member
  const assignStaff = useMutation({
    mutationFn: async (data: {
      staffUserId: string
      organizationId: string
      role?: 'primary' | 'backup' | 'observer' | 'reviewer'
    }) => {
      const { data: result, error } = await (supabase as any)
        .from('staff_assignments')
        .insert({
          assignable_type: assignableType,
          assignable_id: assignableId,
          staff_user_id: data.staffUserId,
          organization_id: data.organizationId,
          role: data.role || 'primary',
        })
        .select()
        .single()

      if (error) throw error
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['staff-assignments', assignableType, assignableId],
      })
    },
  })

  // Unassign staff member (soft delete by setting unassigned_at)
  const unassignStaff = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await (supabase as any)
        .from('staff_assignments')
        .update({ unassigned_at: new Date().toISOString() })
        .eq('id', assignmentId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['staff-assignments', assignableType, assignableId],
      })
    },
  })

  // Update assignment role
  const updateRole = useMutation({
    mutationFn: async (data: {
      assignmentId: string
      role: 'primary' | 'backup' | 'observer' | 'reviewer'
    }) => {
      const { error } = await (supabase as any)
        .from('staff_assignments')
        .update({ role: data.role })
        .eq('id', data.assignmentId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['staff-assignments', assignableType, assignableId],
      })
    },
  })

  return {
    assignments: assignments || [],
    isLoading,
    error,
    assignStaff: assignStaff.mutate,
    unassignStaff: unassignStaff.mutate,
    updateRole: updateRole.mutate,
    isAssigning: assignStaff.isPending,
    isUnassigning: unassignStaff.isPending,
    isUpdating: updateRole.isPending,
  }
}

// Hook to get all staff members available for assignment in an organization
export function useAvailableStaff(organizationId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['available-staff', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          role,
          organization_id,
          profiles(name, avatar_url)
        `)
        .eq('organization_id', organizationId)
        .in('role', ['staff', 'super_admin', 'partner'])
        .order('profiles(name)', { ascending: true })

      if (error) throw error
      return (data ?? []).map((row: any) => ({
        ...row,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles ?? null,
      })) as StaffWithProfile[]
    },
    enabled: !!organizationId,
  })
}

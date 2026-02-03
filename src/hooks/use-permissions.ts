'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Permission {
  id: string
  name: string
  label: string
  description: string | null
  category: string
  is_system: boolean
  is_active: boolean
}

/**
 * Hook to fetch and check user permissions
 */
export function useUserPermissions(userId?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['user-permissions', userId],
    queryFn: async () => {
      if (!userId) return []

      const { data, error } = await (supabase as any).rpc('get_user_permissions', {
        p_user_id: userId,
      })

      if (error) throw error
      return data as Array<{
        permission_name: string
        permission_label: string
        category: string
        source: 'role' | 'user_override'
      }>
    },
    enabled: !!userId,
  })
}

/**
 * Hook to check if user has a specific permission
 */
export function useHasPermission(userId: string | undefined, permissionName: string) {
  const { data: permissions, isLoading } = useUserPermissions(userId)

  const hasPermission =
    permissions?.some((p) => p.permission_name === permissionName) ?? false

  return { hasPermission, isLoading }
}

/**
 * Hook to check if user has any of the specified permissions
 */
export function useHasAnyPermission(
  userId: string | undefined,
  permissionNames: string[]
) {
  const { data: permissions, isLoading } = useUserPermissions(userId)

  const hasAnyPermission =
    permissions?.some((p) => permissionNames.includes(p.permission_name)) ?? false

  return { hasAnyPermission, isLoading }
}

/**
 * Hook to check if user has all of the specified permissions
 */
export function useHasAllPermissions(
  userId: string | undefined,
  permissionNames: string[]
) {
  const { data: permissions, isLoading } = useUserPermissions(userId)

  const hasAllPermissions =
    permissionNames.every((name) =>
      permissions?.some((p) => p.permission_name === name)
    ) ?? false

  return { hasAllPermissions, isLoading }
}

/**
 * Client-side permission check helper
 * Returns true if user has the permission, false otherwise
 */
export async function checkPermission(
  userId: string,
  permissionName: string
): Promise<boolean> {
  const supabase = createClient()

  try {
    const { data, error } = await (supabase as any).rpc('user_has_permission', {
      p_user_id: userId,
      p_permission_name: permissionName,
    })

    if (error) {
      console.error('Error checking permission:', error)
      return false
    }

    return data ?? false
  } catch (error) {
    console.error('Error in checkPermission:', error)
    return false
  }
}

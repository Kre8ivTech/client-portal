'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { requireRole } from '@/lib/require-role'

export async function deleteUser(userId: string) {
  await requireRole(['super_admin', 'staff'])
  
  const supabase = await createServerSupabaseClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { success: false, error: 'Unauthorized' }
  }

  // Prevent self-deletion
  if (userId === currentUser.id) {
    return { success: false, error: 'You cannot delete your own account' }
  }

  // Get user details before deletion for audit log
  const { data: userToDelete } = await (supabase as any)
    .from('users')
    .select('email, role')
    .eq('id', userId)
    .single()

  try {
    // Delete from Supabase Auth (this will cascade to public.users and public.profiles via triggers/FKs)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError)
      return { success: false, error: deleteError.message }
    }

    await writeAuditLog({
      action: 'user.delete',
      entity_type: 'user',
      entity_id: userId,
      details: {
        deleted_email: userToDelete?.email,
        deleted_role: userToDelete?.role
      }
    })

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (error: any) {
    console.error('Delete user error:', error)
    return { success: false, error: error.message || 'Failed to delete user' }
  }
}

export async function updateUser(userId: string, data: { name?: string; role?: string; organization_id?: string | null }) {
  await requireRole(['super_admin', 'staff'])
  
  const supabase = await createServerSupabaseClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    // 1. Update public.users (role, organization)
    if (data.role || data.organization_id !== undefined) {
      const updates: any = {}
      if (data.role) updates.role = data.role
      if (data.organization_id !== undefined) updates.organization_id = data.organization_id

      const { error: userError } = await (supabase as any)
        .from('users')
        .update(updates)
        .eq('id', userId)

      if (userError) throw userError
    }

    // 2. Update public.profiles (name)
    if (data.name) {
      const { error: profileError } = await (supabase as any)
        .from('profiles')
        .update({ name: data.name })
        .eq('user_id', userId)

      if (profileError) throw profileError
    }

    await writeAuditLog({
      action: 'user.update',
      entity_type: 'user',
      entity_id: userId,
      new_values: data
    })

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (error: any) {
    console.error('Update user error:', error)
    return { success: false, error: error.message || 'Failed to update user' }
  }
}

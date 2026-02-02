'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { requireRole } from '@/lib/require-role'
import { createUserSchema, updateUserSchema, canCreateUsers, getAllowedRolesToCreate, type CreateUserInput, type UpdateUserInput } from '@/lib/validators/user'

export async function createUser(input: CreateUserInput) {
  await requireRole(['super_admin', 'staff'])
  
  const supabase = await createServerSupabaseClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { success: false, error: 'Unauthorized' }
  }

  // Get current user's profile
  const { data: currentUserData } = await (supabase as any)
    .from('users')
    .select('role, organization_id, is_account_manager')
    .eq('id', currentUser.id)
    .single()

  if (!currentUserData) {
    return { success: false, error: 'User profile not found' }
  }

  // Check if user can create users
  if (!canCreateUsers(currentUserData.role, currentUserData.is_account_manager)) {
    return { success: false, error: 'You do not have permission to create users' }
  }

  // Validate input
  const validationResult = createUserSchema.safeParse(input)
  if (!validationResult.success) {
    return { 
      success: false, 
      error: 'Validation failed', 
      details: validationResult.error.flatten().fieldErrors 
    }
  }

  const data = validationResult.data

  // Check if user is trying to create a role they're not allowed to
  const allowedRoles = getAllowedRolesToCreate(currentUserData.role, currentUserData.is_account_manager)
  if (!allowedRoles.includes(data.role as any)) {
    return { 
      success: false, 
      error: `You are not allowed to create users with role: ${data.role}` 
    }
  }

  // If creating a client, ensure organization_id is set
  if (data.role === 'client' && !data.organization_id) {
    // For non-super_admin, use their own organization
    if (currentUserData.role !== 'super_admin') {
      data.organization_id = currentUserData.organization_id
    } else {
      return { success: false, error: 'organization_id is required when creating a client' }
    }
  }

  try {
    // Check if email already exists
    const { data: existingUser } = await (supabase as any)
      .from('users')
      .select('id, email')
      .eq('email', data.email)
      .maybeSingle()

    if (existingUser) {
      return { success: false, error: 'A user with this email already exists' }
    }

    // Use admin client to create user in Supabase Auth
    const supabaseAdmin = getSupabaseAdmin()
    
    // Generate a temporary password
    const temporaryPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12)
    
    const { data: newAuthUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        name: data.name,
      }
    })

    if (createAuthError || !newAuthUser.user) {
      console.error('Error creating auth user:', createAuthError)
      return { success: false, error: createAuthError?.message || 'Failed to create user' }
    }

    // Create user record in public.users table
    const { error: createUserError } = await (supabaseAdmin as any)
      .from('users')
      .insert({
        id: newAuthUser.user.id,
        email: data.email,
        role: data.role,
        organization_id: data.organization_id,
        is_account_manager: data.is_account_manager,
        status: 'active',
      })

    if (createUserError) {
      console.error('Error creating user record:', createUserError)
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      return { success: false, error: 'Failed to create user record' }
    }

    // Create profile record
    const { error: createProfileError } = await (supabaseAdmin as any)
      .from('profiles')
      .insert({
        user_id: newAuthUser.user.id,
        name: data.name,
      })

    if (createProfileError) {
      console.error('Error creating profile:', createProfileError)
      // Non-critical error, profile trigger should handle this
    }

    // Send invite email if requested
    if (data.send_invite_email) {
      const { error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'invite',
        email: data.email,
      })

      if (inviteError) {
        console.error('Error sending invite email:', inviteError)
        // Non-critical error
      }
    }

    // Write audit log
    await writeAuditLog({
      action: 'user.create',
      entity_type: 'user',
      entity_id: newAuthUser.user.id,
      details: {
        email: data.email,
        name: data.name,
        role: data.role,
        organization_id: data.organization_id,
        is_account_manager: data.is_account_manager,
      }
    })

    revalidatePath('/dashboard/users')
    return { 
      success: true, 
      user: {
        id: newAuthUser.user.id,
        email: data.email,
        name: data.name,
        role: data.role,
      }
    }
  } catch (error: any) {
    console.error('Create user error:', error)
    return { success: false, error: error.message || 'Failed to create user' }
  }
}

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
    // Delete from Supabase Auth (requires service role; cascades to public.users/public.profiles via FK)
    const supabaseAdmin = getSupabaseAdmin()
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

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

export async function updateUser(userId: string, input: UpdateUserInput) {
  await requireRole(['super_admin', 'staff'])
  
  const supabase = await createServerSupabaseClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const validationResult = updateUserSchema.safeParse(input)
    if (!validationResult.success) {
      return {
        success: false,
        error: 'Validation failed',
        details: validationResult.error.flatten().fieldErrors,
      }
    }

    const data = validationResult.data

    // Current user row (role/org)
    const { data: currentUserData } = await (supabase as any)
      .from('users')
      .select('id, role, organization_id')
      .eq('id', currentUser.id)
      .single()

    const currentRole = currentUserData?.role as string | undefined
    const currentOrgId = (currentUserData?.organization_id as string | null | undefined) ?? null

    if (!currentRole) {
      return { success: false, error: 'User profile not found' }
    }

    const isSuperAdmin = currentRole === 'super_admin'
    const isStaff = currentRole === 'staff'

    // Prevent self-demotion / lockout
    if (isSuperAdmin && userId === currentUser.id && data.role && data.role !== 'super_admin') {
      return { success: false, error: 'You cannot change your own role from super_admin' }
    }

    // Staff limitations: can only edit client users within their own org, and only update display name
    if (isStaff && !isSuperAdmin) {
      // Ensure target user is in same org and is a client
      const { data: targetUser } = await (supabase as any)
        .from('users')
        .select('id, role, organization_id')
        .eq('id', userId)
        .single()

      if (!targetUser) {
        return { success: false, error: 'User not found' }
      }

      if (targetUser.organization_id !== currentOrgId) {
        return { success: false, error: 'Forbidden - Can only manage users in your organization' }
      }

      if (targetUser.role !== 'client') {
        return { success: false, error: 'Forbidden - Staff can only edit client users' }
      }

      // Strip disallowed fields
      const allowed: UpdateUserInput = { name: data.name }
      const supabaseAdmin = getSupabaseAdmin()
      if (allowed.name) {
        const { error: profileError } = await (supabaseAdmin as any)
          .from('profiles')
          .update({ name: allowed.name })
          .eq('user_id', userId)
        if (profileError) throw profileError
      }

      await writeAuditLog({
        action: 'user.update',
        entity_type: 'user',
        entity_id: userId,
        new_values: allowed,
      })

      revalidatePath('/dashboard/users')
      return { success: true }
    }

    // Super admin can update all fields (via service role)
    const supabaseAdmin = getSupabaseAdmin()

    // 1. Update public.users (role, organization, flags, status)
    const userUpdates: any = {}
    if (data.role) userUpdates.role = data.role
    if (data.organization_id !== undefined) userUpdates.organization_id = data.organization_id
    if (data.is_account_manager !== undefined) userUpdates.is_account_manager = data.is_account_manager
    if (data.status) userUpdates.status = data.status

    if (Object.keys(userUpdates).length > 0) {
      const { error: userError } = await (supabaseAdmin as any)
        .from('users')
        .update(userUpdates)
        .eq('id', userId)
      if (userError) throw userError
    }

    // 2. Update public.profiles (name)
    if (data.name) {
      const { error: profileError } = await (supabaseAdmin as any)
        .from('profiles')
        .update({ name: data.name })
        .eq('user_id', userId)
      if (profileError) throw profileError
    }

    await writeAuditLog({
      action: 'user.update',
      entity_type: 'user',
      entity_id: userId,
      new_values: data,
    })

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (error: any) {
    console.error('Update user error:', error)
    return { success: false, error: error.message || 'Failed to update user' }
  }
}

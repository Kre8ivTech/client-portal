'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { writeAuditLog } from '@/lib/audit'
import { requireRole } from '@/lib/require-role'
import { createUserSchema, canCreateUsers, getAllowedRolesToCreate, type CreateUserInput } from '@/lib/validators/user'

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

  // Validate organization assignment for non-super admins
  if (data.organization_id && currentUserData.role !== 'super_admin') {
    if (data.organization_id !== currentUserData.organization_id) {
      // Check if it's a child organization
      const { data: targetOrg } = await (supabase as any)
        .from('organizations')
        .select('parent_org_id')
        .eq('id', data.organization_id)
        .single()
      
      if (!targetOrg || targetOrg.parent_org_id !== currentUserData.organization_id) {
        return { success: false, error: 'You can only assign users to your organization or its client organizations' }
      }
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

    // Ensure user record exists in public.users table.
    // Note: DB trigger `on_auth_user_created` already inserts a row into `public.users`,
    // so we must upsert (not insert) to avoid duplicate PK errors.
    const { error: createUserError } = await (supabaseAdmin as any)
      .from('users')
      .upsert({
        id: newAuthUser.user.id,
        email: data.email,
        role: data.role,
        organization_id: data.organization_id,
        is_account_manager: data.is_account_manager,
        status: 'active',
      }, { onConflict: 'id' })

    if (createUserError) {
      console.error('Error creating user record:', createUserError)
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(newAuthUser.user.id)
      return { success: false, error: 'Failed to create user record' }
    }

    // Ensure profile record exists (trigger usually creates it)
    const { error: createProfileError } = await (supabaseAdmin as any)
      .from('profiles')
      .upsert({
        user_id: newAuthUser.user.id,
        name: data.name,
      }, { onConflict: 'user_id' })

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

export async function updateUser(
  userId: string,
  data: { name?: string; role?: string; organization_id?: string | null; email?: string }
) {
  await requireRole(['super_admin', 'staff'])
  
  const supabase = await createServerSupabaseClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  if (!currentUser) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()

    // Get admin profile
    const { data: adminProfileData, error: adminProfileError } = await (supabase as any)
      .from('users')
      .select('id, email, role, organization_id')
      .eq('id', currentUser.id)
      .single()

    if (adminProfileError || !adminProfileData) {
      return { success: false, error: 'User profile not found' }
    }

    const adminProfile = adminProfileData as { id: string; email: string; role: string; organization_id: string | null }

    // Get target user (use admin client to bypass RLS safely)
    const { data: targetUserData, error: targetUserError } = await (supabaseAdmin as any)
      .from('users')
      .select(`
        id, 
        email, 
        organization_id,
        organizations:organization_id (
          parent_org_id
        )
      `)
      .eq('id', userId)
      .single()

    if (targetUserError || !targetUserData) {
      return { success: false, error: 'User not found' }
    }

    const targetUser = targetUserData as { 
      id: string; 
      email: string; 
      organization_id: string | null;
      organizations: { parent_org_id: string | null } | null 
    }

    // Enforce organization scoping for non-super admins
    if (adminProfile.role !== 'super_admin') {
      const isSameOrg = targetUser.organization_id === adminProfile.organization_id;
      const isChildOrg = targetUser.organizations?.parent_org_id === adminProfile.organization_id;
      
      if (!isSameOrg && !isChildOrg) {
        return { success: false, error: 'Forbidden - Can only manage users in your organization or client organizations' }
      }
    }

    // 1. Update email (Supabase Auth + public.users)
    const normalizedEmail = data.email ? String(data.email).trim().toLowerCase() : undefined
    if (normalizedEmail && normalizedEmail !== targetUser.email) {
      // Ensure unique email
      const { data: existingUser } = await (supabaseAdmin as any)
        .from('users')
        .select('id, email')
        .eq('email', normalizedEmail)
        .maybeSingle()

      if (existingUser && existingUser.id !== userId) {
        return { success: false, error: 'A user with this email already exists' }
      }

      // Update Auth user email (confirm immediately to avoid blocking login)
      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: normalizedEmail,
        email_confirm: true as any,
      })

      if (authUpdateError) {
        return { success: false, error: authUpdateError.message || 'Failed to update user email' }
      }

      // Update public.users email (rollback auth email if this fails)
      const { error: usersEmailError } = await (supabaseAdmin as any)
        .from('users')
        .update({ email: normalizedEmail })
        .eq('id', userId)

      if (usersEmailError) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: targetUser.email,
            email_confirm: true as any,
          })
        } catch {
          // best-effort rollback
        }
        return { success: false, error: 'Failed to update user email' }
      }
    }

    // 2. Update public.users (role, organization)
    if (data.role || data.organization_id !== undefined) {
      const updates: any = {}
      if (data.role) updates.role = data.role
      if (data.organization_id !== undefined) updates.organization_id = data.organization_id

      const { error: userError } = await (supabaseAdmin as any)
        .from('users')
        .update(updates)
        .eq('id', userId)

      if (userError) throw userError
    }

    // 3. Update public.profiles (name)
    if (data.name !== undefined) {
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
      old_values: {
        email: targetUser.email,
      },
      new_values: {
        ...data,
        ...(normalizedEmail ? { email: normalizedEmail } : {}),
      },
      details: {
        updated_by: currentUser.id,
        updated_by_email: adminProfile.email,
      },
    })

    revalidatePath('/dashboard/users')
    return { success: true }
  } catch (error: any) {
    console.error('Update user error:', error)
    return { success: false, error: error.message || 'Failed to update user' }
  }
}

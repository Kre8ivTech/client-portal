import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Server-side permission check
 * Use this in Server Components and API routes
 */
export async function hasPermission(
  userId: string,
  permissionName: string
): Promise<boolean> {
  try {
    const { data, error } = await (supabaseAdmin as any).rpc('user_has_permission', {
      p_user_id: userId,
      p_permission_name: permissionName,
    })

    if (error) {
      console.error('Error checking permission:', error)
      return false
    }

    return data ?? false
  } catch (error) {
    console.error('Error in hasPermission:', error)
    return false
  }
}

/**
 * Server-side check for multiple permissions (ANY)
 */
export async function hasAnyPermission(
  userId: string,
  permissionNames: string[]
): Promise<boolean> {
  try {
    const checks = await Promise.all(
      permissionNames.map((name) => hasPermission(userId, name))
    )
    return checks.some((result) => result === true)
  } catch (error) {
    console.error('Error in hasAnyPermission:', error)
    return false
  }
}

/**
 * Server-side check for multiple permissions (ALL)
 */
export async function hasAllPermissions(
  userId: string,
  permissionNames: string[]
): Promise<boolean> {
  try {
    const checks = await Promise.all(
      permissionNames.map((name) => hasPermission(userId, name))
    )
    return checks.every((result) => result === true)
  } catch (error) {
    console.error('Error in hasAllPermissions:', error)
    return false
  }
}

/**
 * Get all permissions for a user
 */
export async function getUserPermissions(userId: string) {
  try {
    const { data, error } = await (supabaseAdmin as any).rpc('get_user_permissions', {
      p_user_id: userId,
    })

    if (error) {
      console.error('Error getting user permissions:', error)
      return []
    }

    return data as Array<{
      permission_name: string
      permission_label: string
      category: string
      source: 'role' | 'user_override'
    }>
  } catch (error) {
    console.error('Error in getUserPermissions:', error)
    return []
  }
}

/**
 * Require specific permission or throw error
 * Use in API routes to enforce permissions
 */
export async function requirePermission(
  userId: string,
  permissionName: string
): Promise<void> {
  const has = await hasPermission(userId, permissionName)
  if (!has) {
    throw new Error(`Permission denied: ${permissionName}`)
  }
}

/**
 * Permission categories for organization
 */
export const PERMISSION_CATEGORIES = {
  TICKETS: 'tickets',
  INVOICES: 'invoices',
  CONTRACTS: 'contracts',
  USERS: 'users',
  ORGANIZATIONS: 'organizations',
  SETTINGS: 'settings',
  REPORTS: 'reports',
  SERVICES: 'services',
  MESSAGES: 'messages',
  AUDIT: 'audit',
} as const

/**
 * Common permission names
 */
export const PERMISSIONS = {
  // Tickets
  TICKETS_VIEW: 'tickets.view',
  TICKETS_CREATE: 'tickets.create',
  TICKETS_UPDATE: 'tickets.update',
  TICKETS_DELETE: 'tickets.delete',
  TICKETS_ASSIGN: 'tickets.assign',
  TICKETS_CLOSE: 'tickets.close',
  TICKETS_COMMENT: 'tickets.comment',

  // Invoices
  INVOICES_VIEW: 'invoices.view',
  INVOICES_CREATE: 'invoices.create',
  INVOICES_UPDATE: 'invoices.update',
  INVOICES_DELETE: 'invoices.delete',
  INVOICES_SEND: 'invoices.send',
  INVOICES_PAYMENT: 'invoices.payment',

  // Contracts
  CONTRACTS_VIEW: 'contracts.view',
  CONTRACTS_CREATE: 'contracts.create',
  CONTRACTS_UPDATE: 'contracts.update',
  CONTRACTS_DELETE: 'contracts.delete',
  CONTRACTS_SEND: 'contracts.send',
  CONTRACTS_SIGN: 'contracts.sign',

  // Users
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DELETE: 'users.delete',
  USERS_PERMISSIONS: 'users.permissions',

  // Organizations
  ORGANIZATIONS_VIEW: 'organizations.view',
  ORGANIZATIONS_CREATE: 'organizations.create',
  ORGANIZATIONS_UPDATE: 'organizations.update',
  ORGANIZATIONS_DELETE: 'organizations.delete',

  // Settings
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_UPDATE: 'settings.update',
  SETTINGS_BRANDING: 'settings.branding',
  SETTINGS_INTEGRATIONS: 'settings.integrations',

  // Reports
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // Services
  SERVICES_VIEW: 'services.view',
  SERVICES_CREATE: 'services.create',
  SERVICES_UPDATE: 'services.update',
  SERVICES_APPROVE: 'services.approve',

  // Messages
  MESSAGES_VIEW: 'messages.view',
  MESSAGES_SEND: 'messages.send',
  MESSAGES_DELETE: 'messages.delete',

  // Audit
  AUDIT_VIEW: 'audit.view',
} as const

/**
 * Staff Assignment Notification Triggers
 *
 * Helper functions to trigger notifications when staff are assigned to tasks
 * Call these after staff assignments are created
 */

'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import {
  notifyServiceRequestAssigned,
  notifyProjectRequestAssigned,
} from './task-notifications'

/**
 * Trigger notification when staff is assigned to a service request
 * Call this after creating a staff_assignment record for a service_request
 */
export async function notifyStaffAssignedToServiceRequest(
  serviceRequestId: string,
  staffUserId: string
) {
  try {
    const supabase = await createServerSupabaseClient()

    // Get service request details
    const { data: serviceRequest, error } = await supabase
      .from('service_requests')
      .select(`
        *,
        service:services(name),
        requested_by_user:users!service_requests_requested_by_fkey(id, profiles:profiles(name))
      `)
      .eq('id', serviceRequestId)
      .single()

    if (error || !serviceRequest) {
      console.error('[Staff Assignment] Failed to get service request:', error)
      return { success: false }
    }

    // Trigger notification
    return await notifyServiceRequestAssigned(
      serviceRequestId,
      (serviceRequest as any).request_number || 'N/A',
      (serviceRequest as any).service?.name || 'Service',
      (serviceRequest as any).requested_by_user?.profiles?.name || 'Client',
      (serviceRequest as any).priority || 'medium'
    )
  } catch (error) {
    console.error('[Staff Assignment] Error notifying staff assignment:', error)
    return { success: false }
  }
}

/**
 * Trigger notification when staff is assigned to a project request
 * Call this after creating a staff_assignment record for a project_request
 */
export async function notifyStaffAssignedToProjectRequest(
  projectRequestId: string,
  staffUserId: string
) {
  try {
    const supabase = await createServerSupabaseClient()

    // Get project request details
    const { data: projectRequest, error } = await supabase
      .from('project_requests')
      .select(`
        *,
        requested_by_user:users!project_requests_requested_by_fkey(id, profiles:profiles(name))
      `)
      .eq('id', projectRequestId)
      .single()

    if (error || !projectRequest) {
      console.error('[Staff Assignment] Failed to get project request:', error)
      return { success: false }
    }

    // Trigger notification
    return await notifyProjectRequestAssigned(
      projectRequestId,
      (projectRequest as any).request_number || 'N/A',
      (projectRequest as any).title || 'Project',
      (projectRequest as any).requested_by_user?.profiles?.name || 'Client',
      (projectRequest as any).priority || 'medium'
    )
  } catch (error) {
    console.error('[Staff Assignment] Error notifying staff assignment:', error)
    return { success: false }
  }
}

/**
 * Usage Instructions:
 *
 * After creating a staff assignment, call the appropriate notification function:
 *
 * Example for service requests:
 * ```typescript
 * // Create staff assignment
 * await supabase.from('staff_assignments').insert({
 *   assignable_type: 'service_request',
 *   assignable_id: serviceRequestId,
 *   staff_user_id: staffUserId,
 *   role: 'primary'
 * })
 *
 * // Trigger notification
 * await notifyStaffAssignedToServiceRequest(serviceRequestId, staffUserId)
 * ```
 *
 * Example for project requests:
 * ```typescript
 * // Create staff assignment
 * await supabase.from('staff_assignments').insert({
 *   assignable_type: 'project_request',
 *   assignable_id: projectRequestId,
 *   staff_user_id: staffUserId,
 *   role: 'primary'
 * })
 *
 * // Trigger notification
 * await notifyStaffAssignedToProjectRequest(projectRequestId, staffUserId)
 * ```
 */

'use server'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'

/**
 * Notify a user when a project task is assigned to them.
 */
export async function notifyTaskAssigned(
  taskId: string,
  projectId: string,
  assignedToUserId: string,
  taskTitle: string,
  assignedByUserId?: string
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: assignee } = await (supabaseAdmin as any)
      .from('users')
      .select('email, full_name')
      .eq('id', assignedToUserId)
      .single()

    if (!assignee?.email) return

    const { data: project } = await (supabaseAdmin as any)
      .from('projects')
      .select('name, organization_id')
      .eq('id', projectId)
      .single()

    let assignedByName = 'A team member'
    if (assignedByUserId) {
      const { data: assigner } = await (supabaseAdmin as any)
        .from('users')
        .select('full_name, email')
        .eq('id', assignedByUserId)
        .single()
      if (assigner) {
        assignedByName = assigner.full_name || assigner.email
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    await sendTemplatedEmail({
      to: assignee.email,
      templateType: 'new_task',
      variables: {
        recipient_name: assignee.full_name || assignee.email,
        task_title: taskTitle,
        project_name: project?.name || 'Unknown Project',
        assigned_by_name: assignedByName,
        task_url: `${appUrl}/dashboard/projects/${projectId}/tasks`,
        app_url: appUrl,
        current_year: new Date().getFullYear().toString(),
      },
      organizationId: project?.organization_id,
    })
  } catch (error) {
    console.error('[Notifications] Failed to send task assigned email:', error)
  }
}

/**
 * Notify all project members when project status changes.
 */
export async function notifyProjectStatusChanged(
  projectId: string,
  newStatus: string,
  oldStatus: string,
  changedByUserId: string
) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    const { data: project } = await (supabaseAdmin as any)
      .from('projects')
      .select('name, organization_id')
      .eq('id', projectId)
      .single()

    if (!project) return

    let changedByName = 'A team member'
    if (changedByUserId) {
      const { data: changer } = await (supabaseAdmin as any)
        .from('users')
        .select('full_name, email')
        .eq('id', changedByUserId)
        .single()
      if (changer) {
        changedByName = changer.full_name || changer.email
      }
    }

    // Get all active project members
    const { data: members } = await (supabaseAdmin as any)
      .from('project_members')
      .select('user_id, user:users!project_members_user_id_fkey(email, full_name)')
      .eq('project_id', projectId)
      .eq('is_active', true)

    if (!members?.length) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    for (const member of members) {
      if (!member.user?.email) continue
      // Skip notifying the person who made the change
      if (member.user_id === changedByUserId) continue

      await sendTemplatedEmail({
        to: member.user.email,
        templateType: 'project_status_changed',
        variables: {
          recipient_name: member.user.full_name || member.user.email,
          project_name: project.name,
          old_status: formatStatus(oldStatus),
          new_status: formatStatus(newStatus),
          changed_by_name: changedByName,
          project_url: `${appUrl}/dashboard/projects/${projectId}`,
          app_url: appUrl,
          current_year: new Date().getFullYear().toString(),
        },
        organizationId: project.organization_id,
      }).catch(() => {})
    }
  } catch (error) {
    console.error('[Notifications] Failed to send project status email:', error)
  }
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Cron Job: Task Acknowledgement Check
 *
 * Runs periodically (every hour) to check for unacknowledged tasks
 * Sends reminder emails for tasks that have been unacknowledged for 24+ hours
 *
 * Triggered by Vercel Cron
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'

// Use admin client to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
) as any

export async function GET(request: NextRequest) {
  try {
    // Verify this is a Vercel Cron request (basic security)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Cron] Starting task acknowledgement check...')

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Find unacknowledged tasks older than 24 hours
    const { data: unacknowledgedRecords, error: queryError } = await supabaseAdmin
      .from('task_acknowledgements')
      .select(`
        id,
        task_type,
        task_id,
        acknowledged_by,
        acknowledgement_token,
        created_at,
        organization:organizations(id, name),
        recipient:users!task_acknowledgements_acknowledged_by_fkey(id, email, role, profiles:profiles(name))
      `)
      .is('acknowledged_at', null) // Not acknowledged yet
      .lt('created_at', twentyFourHoursAgo.toISOString()) // Created more than 24 hours ago
      .not('token_expires_at', 'lt', new Date().toISOString()) // Token not expired

    if (queryError) {
      console.error('[Cron] Failed to query unacknowledged tasks:', queryError)
      return NextResponse.json(
        { error: 'Failed to query unacknowledged tasks' },
        { status: 500 }
      )
    }

    if (!unacknowledgedRecords || unacknowledgedRecords.length === 0) {
      console.log('[Cron] No unacknowledged tasks found')
      return NextResponse.json({
        success: true,
        message: 'No unacknowledged tasks to remind',
        count: 0,
      })
    }

    console.log(`[Cron] Found ${unacknowledgedRecords.length} unacknowledged tasks`)

    const remindersSent: string[] = []
    const remindersFailed: string[] = []

    // Group by task to get task details
    const tasksToProcess = new Map<string, typeof unacknowledgedRecords>()

    for (const record of unacknowledgedRecords) {
      const taskKey = `${record.task_type}:${record.task_id}`
      if (!tasksToProcess.has(taskKey)) {
        tasksToProcess.set(taskKey, [])
      }
      tasksToProcess.get(taskKey)!.push(record)
    }

    // Process each task
    for (const [taskKey, records] of tasksToProcess) {
      const [taskType, taskId] = taskKey.split(':')
      const tableName = taskType === 'service_request' ? 'service_requests' : 'project_requests'

      // Get task details
      const { data: task, error: taskError } = await supabaseAdmin
        .from(tableName)
        .select(`
          *,
          organization:organizations(id, name),
          requested_by_user:users!${tableName}_requested_by_fkey(id, email, profiles:profiles(name))
        `)
        .eq('id', taskId)
        .single()

      if (taskError || !task) {
        console.error(`[Cron] Failed to get task ${taskKey}:`, taskError)
        records.forEach((r: any) => remindersFailed.push(r.id))
        continue
      }

      // Calculate hours ago
      const createdAt = new Date(records[0].created_at)
      const hoursAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60))

      // Get list of who has already acknowledged (if any)
      const { data: acknowledgedRecords } = await supabaseAdmin
        .from('task_acknowledgements')
        .select(`
          acknowledged_by,
          acknowledger:users!task_acknowledgements_acknowledged_by_fkey(id, profiles:profiles(name))
        `)
        .eq('task_type', taskType)
        .eq('task_id', taskId)
        .not('acknowledged_at', 'is', null)

      const acknowledgedByNames = acknowledgedRecords?.map((r: any) => r.acknowledger?.profiles?.name || 'Unknown') || []

      // Send reminder to each unacknowledged recipient
      for (const record of records) {
        if (!record.recipient?.email) {
          remindersFailed.push(record.id)
          continue
        }

        // Build acknowledgement URL
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const acknowledgementUrl = `${appUrl}/api/tasks/acknowledge?token=${record.acknowledgement_token}`
        const requestPath = taskType === 'service_request' ? 'service-requests' : 'project-requests'
        const requestUrl = `${appUrl}/${requestPath}/${taskId}`

        // Determine task title
        const taskTitle = taskType === 'service_request'
          ? (task as any).service_id || 'Service Request'
          : (task as any).title || 'Project Request'

        // Determine priority class for styling
        const priorityClass = task.priority === 'high' ? 'high' :
                              task.priority === 'low' ? 'low' : 'medium'

        // Send templated email
        const result = await sendTemplatedEmail({
          to: record.recipient.email,
          templateType: 'task_acknowledgement_reminder',
          variables: {
            recipient_name: record.recipient.profiles?.name || record.recipient.email,
            request_number: (task as any).request_number || 'N/A',
            task_type: taskType === 'service_request' ? 'Service Request' : 'Project Request',
            task_title_label: taskType === 'service_request' ? 'Service' : 'Project',
            task_title: taskTitle,
            client_name: task.requested_by_user?.profiles?.name || 'Unknown',
            organization_name: task.organization?.name || 'Unknown',
            priority: task.priority || 'medium',
            priority_class: priorityClass,
            hours_ago: hoursAgo.toString(),
            submitted_date: new Date(task.created_at).toLocaleString(),
            acknowledged_by_others: acknowledgedByNames.length > 0
              ? acknowledgedByNames.join(', ')
              : 'None',
            acknowledgement_url: acknowledgementUrl,
            request_url: requestUrl,
            current_year: new Date().getFullYear().toString(),
          },
          organizationId: record.organization?.id || '',
        })

        if (result.success) {
          remindersSent.push(record.id)
          console.log(`[Cron] Sent reminder to ${record.recipient.email} for ${taskKey}`)
        } else {
          remindersFailed.push(record.id)
          console.error(`[Cron] Failed to send reminder to ${record.recipient.email}:`, result.error)
        }
      }
    }

    console.log(`[Cron] Task acknowledgement check complete. Sent: ${remindersSent.length}, Failed: ${remindersFailed.length}`)

    return NextResponse.json({
      success: true,
      message: 'Task acknowledgement check complete',
      sent: remindersSent.length,
      failed: remindersFailed.length,
      remindersSent,
      remindersFailed,
    })
  } catch (error) {
    console.error('[Cron] Task acknowledgement check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

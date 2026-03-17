import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendTemplatedEmail } from '@/lib/notifications/providers/email'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin() as any
    const now = new Date()
    const tomorrow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000)
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ktportal.app'

    let sent = 0

    // Get tasks due tomorrow
    const { data: tasks1d } = await supabaseAdmin
      .from('project_tasks')
      .select('id, title, due_date, project_id, assigned_to, project:projects(name, organization_id), assignee:users!project_tasks_assigned_to_fkey(email, full_name)')
      .not('status', 'in', '("completed","cancelled")')
      .not('assigned_to', 'is', null)
      .gte('due_date', tomorrow.toISOString().split('T')[0])
      .lt('due_date', new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    // Get tasks due in 3 days
    const { data: tasks3d } = await supabaseAdmin
      .from('project_tasks')
      .select('id, title, due_date, project_id, assigned_to, project:projects(name, organization_id), assignee:users!project_tasks_assigned_to_fkey(email, full_name)')
      .not('status', 'in', '("completed","cancelled")')
      .not('assigned_to', 'is', null)
      .gte('due_date', threeDays.toISOString().split('T')[0])
      .lt('due_date', new Date(threeDays.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0])

    const allTasks = [
      ...(tasks1d || []).map((t: any) => ({ ...t, daysUntilDue: 1 })),
      ...(tasks3d || []).map((t: any) => ({ ...t, daysUntilDue: 3 })),
    ]

    for (const task of allTasks) {
      if (!task.assignee?.email) continue

      const result = await sendTemplatedEmail({
        to: task.assignee.email,
        templateType: 'task_due_reminder',
        variables: {
          recipient_name: task.assignee.full_name || task.assignee.email,
          task_title: task.title || 'Untitled Task',
          project_name: task.project?.name || 'Unknown Project',
          due_date: task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A',
          days_until_due: String(task.daysUntilDue),
          task_url: `${appUrl}/dashboard/projects/${task.project_id}/tasks/${task.id}`,
          app_url: appUrl,
          current_year: new Date().getFullYear().toString(),
        },
        organizationId: task.project?.organization_id,
      })

      if (result.success) sent++
    }

    return NextResponse.json({ success: true, sent, checked: allTasks.length })
  } catch (error) {
    console.error('[Cron] Task due reminder error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createTimeEntrySchema, updateTimeEntrySchema } from '@/lib/validators/project'

/**
 * GET /api/projects/[id]/time-entries
 * List time entries for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const task_id = searchParams.get('task_id')
    const user_id = searchParams.get('user_id')
    const billable = searchParams.get('billable')
    const billed = searchParams.get('billed')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    // Build query - RLS handles project access
    let query = (supabase as any)
      .from('project_time_entries')
      .select(`
        *,
        user:users!project_time_entries_user_id_fkey(
          id,
          email,
          profiles:profiles(name, avatar_url)
        ),
        task:project_tasks(id, title, task_number)
      `)
      .eq('project_id', projectId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })

    // Apply filters
    if (task_id) {
      query = query.eq('task_id', task_id)
    }
    if (user_id) {
      query = query.eq('user_id', user_id)
    }
    if (billable !== null && billable !== undefined) {
      query = query.eq('billable', billable === 'true')
    }
    if (billed !== null && billed !== undefined) {
      query = query.eq('billed', billed === 'true')
    }
    if (start_date) {
      query = query.gte('entry_date', start_date)
    }
    if (end_date) {
      query = query.lte('entry_date', end_date)
    }

    const { data: entries, error } = await query

    if (error) {
      console.error('Error listing time entries:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate summary
    const summary = {
      totalHours: entries?.reduce((sum: number, e: any) => sum + Number(e.hours), 0) ?? 0,
      billableHours: entries?.filter((e: any) => e.billable).reduce((sum: number, e: any) => sum + Number(e.hours), 0) ?? 0,
      billedHours: entries?.filter((e: any) => e.billed).reduce((sum: number, e: any) => sum + Number(e.hours), 0) ?? 0,
      unbilledHours: entries?.filter((e: any) => e.billable && !e.billed).reduce((sum: number, e: any) => sum + Number(e.hours), 0) ?? 0,
    }

    return NextResponse.json({ data: entries, summary })
  } catch (err) {
    console.error('Error listing time entries:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/time-entries
 * Create a new time entry
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user can access the project and is a member
    const { data: project, error: projectError } = await (supabase as any)
      .from('projects')
      .select('id, organization_id, default_hourly_rate')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const result = createTimeEntrySchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const input = result.data

    // Determine hourly rate (task rate > input rate > project default)
    let hourlyRate = input.hourly_rate ?? project.default_hourly_rate

    if (input.task_id) {
      const { data: task } = await (supabase as any)
        .from('project_tasks')
        .select('hourly_rate')
        .eq('id', input.task_id)
        .single()

      if (task?.hourly_rate) {
        hourlyRate = task.hourly_rate
      }
    }

    // Create the time entry
    const { data: entry, error: createError } = await (supabase as any)
      .from('project_time_entries')
      .insert({
        project_id: projectId,
        task_id: input.task_id,
        user_id: user.id,
        description: input.description,
        hours: input.hours,
        entry_date: input.entry_date,
        billable: input.billable,
        hourly_rate: hourlyRate,
      })
      .select(`
        *,
        user:users!project_time_entries_user_id_fkey(
          id,
          email,
          profiles:profiles(name, avatar_url)
        ),
        task:project_tasks(id, title, task_number)
      `)
      .single()

    if (createError) {
      console.error('Error creating time entry:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ data: entry }, { status: 201 })
  } catch (err) {
    console.error('Error creating time entry:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

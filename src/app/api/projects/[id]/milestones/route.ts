import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createMilestoneSchema } from '@/lib/validators/project'

/**
 * GET /api/projects/[id]/milestones
 * List milestones for a project
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
    const status = searchParams.get('status')

    // Build query - RLS handles project access
    let query = (supabase as any)
      .from('project_milestones')
      .select(`
        *,
        creator:users!project_milestones_created_by_fkey(
          id,
          email,
          profiles:profiles(name)
        ),
        tasks:project_tasks(count)
      `)
      .eq('project_id', projectId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('sort_order', { ascending: true })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    const { data: milestones, error } = await query

    if (error) {
      console.error('Error listing milestones:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: milestones })
  } catch (err) {
    console.error('Error listing milestones:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/milestones
 * Create a new milestone
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

    // Verify user can access the project
    const { data: project, error: projectError } = await (supabase as any)
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const result = createMilestoneSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.flatten() },
        { status: 400 }
      )
    }

    const input = result.data

    // Get max sort_order
    const { data: maxOrder } = await (supabase as any)
      .from('project_milestones')
      .select('sort_order')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const newOrder = (maxOrder?.sort_order ?? -1) + 1

    // Create the milestone
    const { data: milestone, error: createError } = await (supabase as any)
      .from('project_milestones')
      .insert({
        project_id: projectId,
        name: input.name,
        description: input.description,
        due_date: input.due_date,
        status: input.status,
        sort_order: input.sort_order ?? newOrder,
        created_by: user.id,
      })
      .select(`
        *,
        creator:users!project_milestones_created_by_fkey(
          id,
          email,
          profiles:profiles(name)
        )
      `)
      .single()

    if (createError) {
      console.error('Error creating milestone:', createError)
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    return NextResponse.json({ data: milestone }, { status: 201 })
  } catch (err) {
    console.error('Error creating milestone:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProjectsTimeline } from '@/components/projects/projects-timeline'

export const metadata = {
  title: 'Projects Timeline',
  description: 'Calendar view of all projects',
}

export const dynamic = 'force-dynamic'

export default async function ProjectsTimelinePage() {
  const supabase = await createServerSupabaseClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get user info with organization and role
  const { data: userData } = await supabase
    .from('users')
    .select('id, email, role, organization_id')
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  // Fetch all projects with their dates
  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select(
      `
      id,
      project_number,
      name,
      description,
      status,
      priority,
      start_date,
      target_end_date,
      actual_end_date,
      organization_id,
      organizations:organizations!inner (
        id,
        name
      )
    `
    )
    .order('start_date', { ascending: true })

  if (projectsError) {
    console.error('Error fetching projects:', projectsError)
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Projects Timeline
        </h1>
        <p className="text-muted-foreground mt-2">
          Calendar view of all your projects
        </p>
      </div>

      <ProjectsTimeline projects={projects || []} userRole={userData.role} />
    </div>
  )
}

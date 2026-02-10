import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ProjectsCommunication } from '@/components/projects/projects-communication'

export const metadata = {
  title: 'Projects Communication',
  description: 'Discussion board for all projects',
}

export const dynamic = 'force-dynamic'

export default async function ProjectsCommunicationPage() {
  const supabase = await createServerSupabaseClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get user info with profile
  const { data: userData } = await supabase
    .from('users')
    .select(
      `
      id,
      email,
      role,
      organization_id,
      profiles:profiles!user_id (
        name,
        avatar_url
      )
    `
    )
    .eq('id', user.id)
    .single()

  if (!userData) {
    redirect('/login')
  }

  // Fetch all accessible projects
  const { data: projects } = await supabase
    .from('projects')
    .select(
      `
      id,
      project_number,
      name,
      status,
      organization_id
    `
    )
    .order('name', { ascending: true })

  // Fetch project comments (messages) with author details
  const { data: comments } = await supabase
    .from('project_comments')
    .select(
      `
      id,
      project_id,
      content,
      content_html,
      parent_comment_id,
      is_pinned,
      created_at,
      updated_at,
      created_by,
      author:users!created_by (
        id,
        email,
        profiles:profiles!user_id (
          name,
          avatar_url
        )
      ),
      project:projects!inner (
        id,
        project_number,
        name,
        status
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(100)

  // Fetch all project members across all projects
  const { data: allMembers } = await supabase
    .from('project_members')
    .select(
      `
      project_id,
      user_id,
      is_active,
      user:users!user_id (
        id,
        email,
        role,
        profiles:profiles!user_id (
          name,
          avatar_url
        )
      )
    `
    )
    .eq('is_active', true)

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Projects Communication
        </h1>
        <p className="text-muted-foreground mt-2">
          Discuss and collaborate on your projects
        </p>
      </div>

      <ProjectsCommunication
        projects={projects || []}
        comments={comments || []}
        allMembers={allMembers || []}
        currentUser={{
          id: userData.id,
          email: userData.email,
          role: userData.role,
          name: userData.profiles?.name || null,
          avatar_url: userData.profiles?.avatar_url || null,
        }}
      />
    </div>
  )
}

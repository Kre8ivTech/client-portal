import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TicketDetail } from '@/components/tickets/ticket-detail'
import { notFound } from 'next/navigation'

export default async function TicketPage({
  params
}: {
  params: { id: string }
}) {
  const supabase = await createServerSupabaseClient()

  // Get current user to pass to client components
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    return notFound()
  }

  // Fetch ticket with creator profile join
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*, creator:profiles!created_by(name)')
    .eq('id', params.id)
    .eq('organization_id', profile.organization_id)
    .single()

  if (error || !ticket) {
    console.error('Error fetching ticket:', error)
    return notFound()
  }

  return <TicketDetail ticket={ticket as any} userId={user.id} userRole={profile.role} />
}

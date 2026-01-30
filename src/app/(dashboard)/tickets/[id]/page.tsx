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

  const { data: queueData } = await supabase.rpc('get_ticket_queue_position', {
    ticket_id: params.id,
  })

  const queue = Array.isArray(queueData) ? queueData[0] : null

  const { data: estimates } = await supabase
    .from('ticket_estimates')
    .select('*')
    .eq('ticket_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const estimate = estimates?.[0] ?? null

  return (
    <TicketDetail
      ticket={ticket as any}
      userId={user.id}
      userRole={profile.role}
      organizationId={profile.organization_id}
      queuePosition={queue?.position ?? null}
      queueTotal={queue?.total ?? null}
      estimate={estimate as any}
    />
  )
}

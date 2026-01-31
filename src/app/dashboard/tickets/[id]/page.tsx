import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TicketDetail } from '@/components/tickets/ticket-detail'
import { notFound } from 'next/navigation'

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  const { id } = await Promise.resolve(params)
  const supabase = await createServerSupabaseClient()

  // Get current user to pass to client components
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch ticket with creator profile join
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*, creator:profiles!created_by(name)')
    .eq('id', id)
    .single()

  if (error || !ticket) {
    return notFound()
  }

  type TicketWithCreator = typeof ticket & { creator: { name: string | null } | null }
  return <TicketDetail ticket={ticket as TicketWithCreator} userId={user.id} />
}

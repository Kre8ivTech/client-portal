import { createServerSupabaseClient } from '@/lib/supabase/server'
import { TicketDetail } from '@/components/tickets/ticket-detail'
import { notFound } from 'next/navigation'

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Get current user to pass to client components
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch ticket with creator profile join (via users table)
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*, creator:users!created_by(id, profiles(name))')
    .eq('id', id)
    .single()

  if (error || !ticket) {
    return notFound()
  }

  // Flatten the nested creator data structure (creator.profiles.name → creator.name)
  type QueryResult = typeof ticket & {
    creator: {
      id: string
      profiles: {
        name: string | null
      } | null
    } | null
  }

  const ticketWithCreator = {
    ...ticket,
    creator: (ticket as QueryResult).creator?.profiles
      ? { name: (ticket as QueryResult).creator.profiles.name }
      : null
  }

  type TicketWithCreator = typeof ticket & { creator: { name: string | null } | null }
  return <TicketDetail ticket={ticketWithCreator as TicketWithCreator} userId={user.id} />
}

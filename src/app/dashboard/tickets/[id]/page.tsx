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

  // Fetch ticket (cast through unknown due to generated types)
  const { data: ticketData, error } = await (supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .single() as unknown as Promise<{ data: Record<string, unknown> | null; error: Error | null }>)

  if (error || !ticketData) {
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

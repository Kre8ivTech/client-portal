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

  // Fetch creator profile separately (profiles.user_id = tickets.created_by)
  let creatorName: string | null = null
  if (ticketData.created_by) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('user_id', ticketData.created_by as string)
      .single()
    creatorName = (profile as { name: string | null } | null)?.name || null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ticketWithCreator = { ...ticketData, creator: { name: creatorName } } as any
  return <TicketDetail ticket={ticketWithCreator} userId={user.id} />
}

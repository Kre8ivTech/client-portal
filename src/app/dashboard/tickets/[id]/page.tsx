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

  // Get current user and their profile
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single() as any;

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
  type QueryResult = typeof ticketData & {
    creator: {
      id: string
      profiles: {
        name: string | null
      } | null
    } | null
  }

  const ticketWithCreator = {
    ...ticketData,
    creator: (ticketData as QueryResult).creator?.profiles
      ? { name: (ticketData as QueryResult).creator?.profiles?.name }
      : null
  }

  type TicketWithCreator = typeof ticketData & { creator: { name: string | null } | null }
  return (
    <TicketDetail 
      ticket={ticketWithCreator as any} 
      userId={user.id} 
      userRole={profile?.role} 
    />
  );
}

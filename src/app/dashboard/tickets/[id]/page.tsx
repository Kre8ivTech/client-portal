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

  // Fetch ticket with creator and assigned staff info
  const { data: ticketData, error } = await (supabase
    .from('tickets')
    .select('*, assigned_staff:user_profiles!tickets_assigned_to_fkey(id, name)')
    .eq('id', id)
    .single() as unknown as Promise<{ data: Record<string, unknown> | null; error: Error | null }>)

  if (error || !ticketData) {
    return notFound()
  }

  // Flatten the nested data structures
  type QueryResult = typeof ticketData & {
    creator: {
      id: string
      profiles: {
        name: string | null
      } | null
    } | null
    assigned_staff: {
      id: string
      name: string | null
    } | null
  }

  const ticketWithRelations = {
    ...ticketData,
    creator: (ticketData as QueryResult).creator?.profiles
      ? { name: (ticketData as QueryResult).creator?.profiles?.name }
      : null,
    assigned_staff: (ticketData as QueryResult).assigned_staff
  }

  const { data: deliverables } = await supabase
    .from('deliverables')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: false })

  return (
    <TicketDetail
      ticket={ticketWithRelations as any}
      userId={user.id}
      userRole={profile?.role}
      deliverables={deliverables || []}
    />
  );
}

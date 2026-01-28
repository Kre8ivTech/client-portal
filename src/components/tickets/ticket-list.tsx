'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { TicketCard } from './ticket-card'
import type { Database } from '@/types/database'
import { Loader2 } from 'lucide-react'

type Ticket = Database['public']['Tables']['tickets']['Row']

interface TicketListProps {
  initialTickets?: Ticket[]
}

export function TicketList({ initialTickets }: TicketListProps) {
  const supabase = createClient()

  const { data: tickets, isLoading, error } = useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    },
    initialData: initialTickets,
  })

  if (isLoading && !tickets) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500 bg-red-50 rounded-lg">
        Failed to load tickets. Please try again later.
      </div>
    )
  }

  if (!tickets || tickets.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
        <p>No tickets found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {tickets.map((ticket) => (
        <TicketCard 
          key={ticket.id} 
          ticket={ticket} 
          onClick={() => {
             // Navigation logic will go here
             // router.push(`/dashboard/tickets/${ticket.id}`)
          }}
        />
      ))}
    </div>
  )
}

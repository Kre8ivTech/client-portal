import { createServerSupabaseClient } from '@/lib/supabase/server'
import { StaffTicketList } from '@/components/tickets/staff-ticket-list'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from 'lucide-react'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Ticket Management | Admin',
  description: 'Manage and prioritize support tickets',
}

export default async function AdminTicketsPage() {
  const supabase = await createServerSupabaseClient()

  // Check auth and role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/dashboard')
  }

  const p = profile as { organization_id: string | null; role: string }
  if (!['super_admin', 'staff', 'partner'].includes(p.role)) {
    redirect('/dashboard')
  }

  // Fetch all tickets with related user data
  const ticketsQuery = supabase
    .from('tickets')
    .select(`
      *,
      created_by_user:users!created_by(id, profiles(name)),
      assigned_to_user:users!assigned_to(id, profiles(name))
    `)

  if (p.organization_id && p.role !== 'super_admin') {
    ticketsQuery.eq('organization_id', p.organization_id)
  }

  const { data: tickets, error } = await ticketsQuery.order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ticket Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage and prioritize support tickets
          </p>
        </div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load tickets: {error.message}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ticket Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage and prioritize support tickets by response time SLA
        </p>
      </div>

      {/* Staff Ticket List */}
      <StaffTicketList initialTickets={tickets || []} />
    </div>
  )
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format } from 'date-fns'
import { Ticket } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = (await createServerSupabaseClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id
  let openTicketsCount = 0
  let planName: string | null = null
  let supportHoursRemaining: string | null = null
  let recentTickets: { id: string; ticket_number: number; subject: string; status: string; created_at: string }[] = []

  if (organizationId) {
    const { count } = await supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .in('status', ['new', 'open', 'in_progress', 'pending_client'])

    openTicketsCount = count ?? 0

    const { data: assignment } = await supabase
      .from('plan_assignments')
      .select('support_hours_used, plans(name, support_hours_included)')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single()

    if (assignment?.plans) {
      const plan = assignment.plans as { name: string; support_hours_included: number } | null
      if (plan) {
        planName = plan.name
        const remaining = plan.support_hours_included - (assignment.support_hours_used ?? 0)
        supportHoursRemaining = `${Math.max(0, remaining)} hours remaining`
      }
    }

    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, ticket_number, subject, status, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(5)

    recentTickets = (tickets ?? []).map((t: { id: string; ticket_number: number; subject: string; status: string; created_at: string }) => ({
      id: t.id,
      ticket_number: t.ticket_number,
      subject: t.subject,
      status: t.status,
      created_at: t.created_at,
    }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Open Tickets"
          value={String(openTicketsCount)}
          description={openTicketsCount > 0 ? 'Awaiting response' : 'All caught up'}
        />
        <StatsCard
          title="Active Projects"
          value="—"
          description="On track"
        />
        <StatsCard
          title="Current Plan"
          value={planName ?? '—'}
          description={supportHoursRemaining ?? 'No active plan'}
        />
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm min-h-[400px]">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        {recentTickets.length === 0 ? (
          <p className="text-slate-500 italic">No recent activity to display.</p>
        ) : (
          <ul className="space-y-3">
            {recentTickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/dashboard/tickets/${ticket.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                    <Ticket className="h-4 w-4 text-slate-500 group-hover:text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate group-hover:text-primary transition-colors">
                      {ticket.subject}
                    </p>
                    <p className="text-xs text-slate-500">
                      #{ticket.ticket_number} · {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize shrink-0">
                    {ticket.status.replace('_', ' ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {recentTickets.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Link
              href="/dashboard/tickets"
              className="text-sm font-medium text-primary hover:underline"
            >
              View all tickets
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function StatsCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

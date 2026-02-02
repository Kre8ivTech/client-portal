import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import type { LucideIcon } from "lucide-react";
import { Ticket, FolderKanban, CreditCard, BookOpen, Wrench, Calendar as CalendarIcon, Users, DollarSign } from "lucide-react";
import { TicketCalendar } from "@/components/dashboard/ticket-calendar";
import { DashboardInbox } from "@/components/dashboard/inbox";
import { InboxWrapper } from "@/components/dashboard/inbox-wrapper";

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = (await createServerSupabaseClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role, is_account_manager')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id
  const userRole = profile?.role ?? 'client'
  const isAccountManager = profile?.is_account_manager ?? false
  
  let openTicketsCount = 0
  let planName: string | null = null
  let supportHoursRemaining: string | null = null
  let recentTickets: { id: string; ticket_number: number; subject: string; status: string; created_at: string }[] = []
  let calendarTickets: any[] = []
  
  // Staff-specific data
  let assignedClientsCount = 0
  let assignedClients: { id: string; name: string; slug: string }[] = []
  
  // Admin/Account Manager-specific data
  let paidInvoicesTotal = 0
  let overdueInvoicesTotal = 0
  let paidInvoicesCount = 0
  let overdueInvoicesCount = 0

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

    const { data: allTickets } = await supabase
      .from('tickets')
      .select('id, ticket_number, subject, status, priority, created_at, description, updated_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(100)
    
    calendarTickets = allTickets ?? []
  }

  // Fetch assigned clients for staff
  if (userRole === 'staff' || userRole === 'super_admin') {
    const { data: staffAssignments } = await supabase
      .from('staff_assignments')
      .select('organization_id, organizations(id, name, slug)')
      .eq('staff_user_id', user.id)
      .is('unassigned_at', null)
    
    if (staffAssignments && staffAssignments.length > 0) {
      // Get unique organizations
      const uniqueOrgs = new Map()
      staffAssignments.forEach((assignment: any) => {
        if (assignment.organizations && !uniqueOrgs.has(assignment.organizations.id)) {
          uniqueOrgs.set(assignment.organizations.id, assignment.organizations)
        }
      })
      assignedClients = Array.from(uniqueOrgs.values())
      assignedClientsCount = assignedClients.length
    }
  }

  // Fetch financial snapshot for admin and account managers
  if (userRole === 'super_admin' || (userRole === 'staff' && isAccountManager)) {
    // Get paid invoices total
    const { data: paidInvoices } = await supabase
      .from('invoices')
      .select('total, amount_paid')
      .eq('status', 'paid')
    
    if (paidInvoices && paidInvoices.length > 0) {
      paidInvoicesCount = paidInvoices.length
      paidInvoicesTotal = paidInvoices.reduce((sum: number, inv: any) => sum + (inv.amount_paid || 0), 0)
    }

    // Get overdue invoices
    const today = new Date().toISOString().split('T')[0]
    const { data: overdueInvoices } = await supabase
      .from('invoices')
      .select('total, balance_due')
      .in('status', ['sent', 'partially_paid'])
      .lt('due_date', today)
    
    if (overdueInvoices && overdueInvoices.length > 0) {
      overdueInvoicesCount = overdueInvoices.length
      overdueInvoicesTotal = overdueInvoices.reduce((sum: number, inv: any) => sum + (inv.balance_due || 0), 0)
    }
  }

  // Determine which cards to show based on role
  const isStaff = userRole === 'staff' || userRole === 'super_admin'
  const isAdmin = userRole === 'super_admin'
  const isAdminOrAccountManager = isAdmin || (userRole === 'staff' && isAccountManager)
  const showCurrentPlan = !isStaff

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatsCard
          icon={Ticket}
          title="Open Tickets"
          value={String(openTicketsCount)}
          description={openTicketsCount > 0 ? "Awaiting response" : "All caught up"}
        />
        <StatsCard
          icon={FolderKanban}
          title="Active Projects"
          value="—"
          description="On track"
        />
        
        {/* Show Current Plan card only for clients and partners */}
        {showCurrentPlan && (
          <StatsCard
            icon={CreditCard}
            title="Current Plan"
            value={planName ?? "—"}
            description={supportHoursRemaining ?? "No active plan"}
          />
        )}
        
        {/* Show Assigned Clients card for staff */}
        {isStaff && (
          <StatsCard
            icon={Users}
            title="Assigned Clients"
            value={String(assignedClientsCount)}
            description={assignedClientsCount > 0 ? `${assignedClientsCount} organization${assignedClientsCount !== 1 ? 's' : ''}` : "No assignments"}
            link="/dashboard/clients"
          />
        )}
        
        {/* Show Financial Snapshot for admin and account managers */}
        {isAdminOrAccountManager && (
          <StatsCard
            icon={DollarSign}
            title="Financial Snapshot"
            value={`$${(paidInvoicesTotal / 100).toFixed(0)}`}
            description={`${paidInvoicesCount} paid, ${overdueInvoicesCount} overdue ($${(overdueInvoicesTotal / 100).toFixed(0)})`}
            link="/dashboard/admin/invoices"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TicketCalendar tickets={calendarTickets} />

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest support ticket updates</CardDescription>
            </CardHeader>
            <CardContent>
              {recentTickets.length === 0 ? (
                <p className="text-muted-foreground italic py-8 text-center">
                  No recent activity to display.
                </p>
              ) : (
                <ul className="space-y-2">
                  {recentTickets.map((ticket) => (
                    <li key={ticket.id}>
                      <Link
                        href={`/dashboard/tickets/${ticket.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <Ticket className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {ticket.subject}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            #{ticket.ticket_number} ·{" "}
                            {format(new Date(ticket.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize shrink-0">
                          {ticket.status.replace("_", " ")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {recentTickets.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <Link
                    href="/dashboard/tickets"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View all support tickets
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <InboxWrapper>
            <DashboardInbox />
          </InboxWrapper>
          
          <Card className="shadow-sm h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Shortcuts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link
                href="/dashboard/tickets/new"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm font-medium"
              >
                <Ticket className="h-4 w-4 text-primary shrink-0" />
                New support ticket
              </Link>
              <Link
                href="/dashboard/service/new"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm font-medium"
              >
                <Wrench className="h-4 w-4 text-primary shrink-0" />
                New service request
              </Link>
              <Link
                href="/dashboard/kb"
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm font-medium"
              >
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                Knowledge Base
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  icon: Icon,
  title,
  value,
  description,
  link,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  description: string;
  link?: string;
}) {
  const cardContent = (
    <>
      <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardDescription className="text-xs uppercase tracking-wide">
            {title}
          </CardDescription>
          <CardTitle className="text-2xl mt-1">{value}</CardTitle>
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </>
  );

  if (link) {
    return (
      <Link href={link} className="block">
        <Card className="shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      {cardContent}
    </Card>
  );
}

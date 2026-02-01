import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building2, ChevronLeft, Ticket, Settings, Users, CreditCard } from 'lucide-react'
import { OrganizationSettingsForm } from '@/components/organizations/organization-settings-form'
import { OrganizationUsersList } from '@/components/organizations/organization-users-list'
import { OrganizationPlanInfo } from '@/components/organizations/organization-plan-info'

export default async function ClientOrgPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: orgId } = await params
  const supabase = (await createServerSupabaseClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, type, status, parent_org_id, custom_domain, branding_config, settings, created_at, updated_at')
    .eq('id', orgId)
    .single()

  if (!org) notFound()

  type ProfileRow = { organization_id: string | null; role: string }
  const prof = profile as ProfileRow | null
  const isOwnOrg = prof?.organization_id === org.id
  const isChildOrg = org.parent_org_id === prof?.organization_id
  const isSuperAdmin = prof?.role === "super_admin"
  const isStaff = prof?.role === "staff"
  const isPartner = prof?.role === "partner" || prof?.role === "partner_staff"
  const canView = isOwnOrg || isChildOrg || isSuperAdmin || isStaff

  if (!canView) notFound()

  // Determine edit permissions
  const canEdit = isSuperAdmin || isStaff || (isPartner && (isOwnOrg || isChildOrg))

  // Fetch additional data
  const [
    { count: ticketCount },
    { data: usersData },
    { data: profilesData },
    { data: planAssignment },
  ] = await Promise.all([
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id),
    supabase
      .from('users')
      .select('id, email, role, status, created_at')
      .eq('organization_id', org.id)
      .order('email', { ascending: true }),
    supabase
      .from('profiles')
      .select('user_id, name, avatar_url'),
    supabase
      .from('plan_assignments')
      .select(`
        id,
        status,
        start_date,
        next_billing_date,
        support_hours_used,
        dev_hours_used,
        plan:plans(id, name, monthly_fee, support_hours_included, dev_hours_included)
      `)
      .eq('organization_id', org.id)
      .in('status', ['active', 'grace_period'])
      .single(),
  ])

  type UserRow = { id: string; email: string; role: string; status: string | null; created_at: string | null }
  type ProfileRecord = { user_id: string; name: string | null; avatar_url: string | null }

  const usersList = (usersData ?? []) as UserRow[]
  const profilesList = (profilesData ?? []) as ProfileRecord[]

  const users = usersList.map((u) => {
    const p = profilesList.find((x) => x.user_id === u.id)
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      created_at: u.created_at,
      name: p?.name ?? null,
      avatar_url: p?.avatar_url ?? null,
    }
  })

  // Format plan assignment for component
  type PlanRow = { id: string; name: string; monthly_fee: number; support_hours_included?: number; dev_hours_included?: number }
  type PlanAssignmentRow = {
    id: string;
    status: string;
    start_date: string;
    next_billing_date: string;
    support_hours_used: number | null;
    dev_hours_used: number | null;
    plan: PlanRow | null;
  }

  const planAssignmentData = planAssignment as PlanAssignmentRow | null

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/clients"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{org.name}</h1>
            <p className="text-slate-500 font-mono text-sm">{org.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {org.type}
          </Badge>
          <Badge
            variant={org.status === 'active' ? 'default' : 'secondary'}
            className={org.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
          >
            {org.status}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketCount ?? 0}</div>
            <p className="text-xs text-slate-500">Total tickets</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-slate-500">Team members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plan</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {planAssignmentData?.plan?.name ?? 'None'}
            </div>
            <p className="text-xs text-slate-500">
              {planAssignmentData?.status ?? 'No active plan'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Access</CardTitle>
            <Settings className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{canEdit ? 'Edit' : 'View'}</div>
            <p className="text-xs text-slate-500">
              {isOwnOrg ? 'Your organization' : isChildOrg ? 'Client organization' : 'Admin access'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Building2 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="plan" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Plan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>Basic information about this organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Name</span>
                    <span className="font-medium">{org.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Slug</span>
                    <span className="font-mono text-slate-700">{org.slug}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Type</span>
                    <span className="capitalize">{org.type}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Status</span>
                    <span className="capitalize">{org.status}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  {org.settings?.contact_email && (
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Contact Email</span>
                      <span className="font-medium">{org.settings.contact_email}</span>
                    </div>
                  )}
                  {org.settings?.contact_phone && (
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Contact Phone</span>
                      <span className="font-medium">{org.settings.contact_phone}</span>
                    </div>
                  )}
                  {org.custom_domain && (
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Custom Domain</span>
                      <span className="font-mono text-slate-700">{org.custom_domain}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Created</span>
                    <span>{org.created_at ? new Date(org.created_at).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <Link href="/dashboard/tickets">View Tickets</Link>
            </Button>
            {canEdit && (
              <Button asChild>
                <Link href={`/dashboard/clients/${org.id}?tab=settings`}>Edit Settings</Link>
              </Button>
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <OrganizationSettingsForm organization={org} canEdit={canEdit} userRole={prof?.role} />
        </TabsContent>

        <TabsContent value="users">
          <OrganizationUsersList users={users} organizationName={org.name} />
        </TabsContent>

        <TabsContent value="plan">
          <OrganizationPlanInfo planAssignment={planAssignmentData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Users, Building2, Globe, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type Organization = {
  id: string
  name: string
  slug: string
  type: string
  status: string
  parent_org_id: string | null
  custom_domain: string | null
}

export default async function ClientsPage() {
  const supabase = (await createServerSupabaseClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id ?? null
  const role = profile?.role ?? 'client'

  const isSuperAdminOrStaff = role === 'super_admin' || role === 'staff'
  const isPartner = role === 'partner' || role === 'partner_staff'
  const canManageOrgs = isSuperAdminOrStaff || isPartner

  let ownOrg: Organization | null = null
  let directClients: Organization[] = []
  let tenantPartners: (Organization & { clients: Organization[] })[] = []

  // Stats
  let totalDirectClients = 0
  let totalTenantPartners = 0
  let totalTenantClients = 0

  if (isSuperAdminOrStaff) {
    // Super admin/staff can see all organizations
    const { data: allOrgs } = await supabase
      .from('organizations')
      .select('id, name, slug, type, status, parent_org_id, custom_domain')
      .order('name', { ascending: true })

    const orgs = (allOrgs ?? []) as Organization[]

    // Get user's own organization
    if (organizationId) {
      ownOrg = orgs.find((o) => o.id === organizationId) ?? null
    }

    // Direct clients: type='client' with no parent_org_id (direct Kre8ivTech clients)
    directClients = orgs.filter((o) => o.type === 'client' && !o.parent_org_id)
    totalDirectClients = directClients.length

    // Tenant partners: type='partner'
    const partners = orgs.filter((o) => o.type === 'partner')
    totalTenantPartners = partners.length

    // Map each partner to include their child clients
    tenantPartners = partners.map((partner) => {
      const clients = orgs.filter((o) => o.parent_org_id === partner.id)
      totalTenantClients += clients.length
      return { ...partner, clients }
    })
  } else if (isPartner && organizationId) {
    // Partner can see their org and their child clients
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug, type, status, parent_org_id, custom_domain')
      .eq('id', organizationId)
      .single()
    ownOrg = org ?? null

    const { data: children } = await supabase
      .from('organizations')
      .select('id, name, slug, type, status, parent_org_id, custom_domain')
      .eq('parent_org_id', organizationId)
      .order('name', { ascending: true })

    const childOrgs = (children ?? []) as Organization[]

    if (ownOrg) {
      tenantPartners = [{ ...ownOrg, clients: childOrgs }]
      totalTenantPartners = 1
      totalTenantClients = childOrgs.length
    }
  } else if (organizationId) {
    // Regular client can only see their own org
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug, type, status, parent_org_id, custom_domain')
      .eq('id', organizationId)
      .single()
    ownOrg = org ?? null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Clients
          </h2>
          <p className="text-slate-500">
            {isSuperAdminOrStaff
              ? 'Manage all client organizations and white-label tenant partners.'
              : isPartner
              ? 'Manage your client organizations.'
              : 'Your organization details.'}
          </p>
        </div>
        {canManageOrgs && (
          <Button className="gap-2" asChild>
            <Link href="/dashboard/clients/new">
              <Plus size={18} />
              Add Organization
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {isSuperAdminOrStaff && (
          <>
            <StatsCard
              title="Direct Clients"
              value={String(totalDirectClients)}
              description="Kre8ivTech clients"
              icon={<Users className="text-slate-400" size={20} />}
            />
            <StatsCard
              title="Tenant Partners"
              value={String(totalTenantPartners)}
              description="White-label partners"
              icon={<Globe className="text-slate-400" size={20} />}
            />
            <StatsCard
              title="Tenant Clients"
              value={String(totalTenantClients)}
              description="Under tenant partners"
              icon={<Building2 className="text-slate-400" size={20} />}
            />
            <StatsCard
              title="Total Organizations"
              value={String(totalDirectClients + totalTenantPartners + totalTenantClients)}
              description="All organizations"
              icon={<Building2 className="text-slate-400" size={20} />}
            />
          </>
        )}
        {isPartner && !isSuperAdminOrStaff && (
          <>
            <StatsCard
              title="Your Clients"
              value={String(totalTenantClients)}
              description="Client organizations"
              icon={<Users className="text-slate-400" size={20} />}
            />
            <StatsCard
              title="Your Organization"
              value={ownOrg?.name ?? '—'}
              description={ownOrg?.slug ?? ''}
              icon={<Building2 className="text-slate-400" size={20} />}
            />
          </>
        )}
        {!canManageOrgs && ownOrg && (
          <StatsCard
            title="Your Organization"
            value={ownOrg.name}
            description={ownOrg.slug}
            icon={<Building2 className="text-slate-400" size={20} />}
          />
        )}
      </div>

      {/* Direct Clients Section - Only for super_admin/staff */}
      {isSuperAdminOrStaff && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Direct Clients
            </CardTitle>
            <CardDescription>
              Client organizations directly managed by Kre8ivTech (no white-label partner).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {directClients.length > 0 ? (
              <ul className="space-y-2">
                {directClients.map((org) => (
                  <li key={org.id}>
                    <Link
                      href={`/dashboard/clients/${org.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                          <Users className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{org.name}</p>
                          <p className="text-xs text-slate-500">{org.slug}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={org.status === 'active' ? 'default' : 'secondary'}
                          className={org.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                        >
                          {org.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-slate-400 border-2 border-dashed rounded-lg">
                No direct client organizations yet.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tenant Partners Section */}
      {canManageOrgs && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {isSuperAdminOrStaff ? 'Tenant Partners (White-label)' : 'Your Organization'}
            </CardTitle>
            <CardDescription>
              {isSuperAdminOrStaff
                ? 'White-label partner organizations and their client organizations.'
                : 'Your organization and client organizations under your management.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tenantPartners.length > 0 ? (
              <div className="space-y-6">
                {tenantPartners.map((partner) => (
                  <div key={partner.id} className="space-y-3">
                    {/* Partner Organization */}
                    <Link
                      href={`/dashboard/clients/${partner.id}`}
                      className="flex items-center justify-between p-4 rounded-lg border-2 border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-slate-900">{partner.name}</p>
                            <Badge variant="outline" className="text-xs">Partner</Badge>
                          </div>
                          <p className="text-sm text-slate-500">{partner.slug}</p>
                          {partner.custom_domain && (
                            <p className="text-xs text-slate-400 font-mono">{partner.custom_domain}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={partner.status === 'active' ? 'default' : 'secondary'}
                          className={partner.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                        >
                          {partner.status}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {partner.clients.length} client{partner.clients.length !== 1 ? 's' : ''}
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </div>
                    </Link>

                    {/* Partner's Client Organizations */}
                    {partner.clients.length > 0 && (
                      <ul className="ml-6 space-y-2 border-l-2 border-slate-200 pl-4">
                        {partner.clients.map((client) => (
                          <li key={client.id}>
                            <Link
                              href={`/dashboard/clients/${client.id}`}
                              className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                  <Users className="h-4 w-4 text-slate-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-slate-900">{client.name}</p>
                                  <p className="text-xs text-slate-500">{client.slug}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={client.status === 'active' ? 'default' : 'secondary'}
                                  className={client.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                                >
                                  {client.status}
                                </Badge>
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              </div>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                    {partner.clients.length === 0 && (
                      <p className="ml-6 text-sm text-slate-400 italic">No client organizations yet.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-slate-400 border-2 border-dashed rounded-lg">
                {isSuperAdminOrStaff ? 'No tenant partner organizations yet.' : 'No organization found.'}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Non-partner user view (client role) */}
      {!canManageOrgs && ownOrg && (
        <Card>
          <CardHeader>
            <CardTitle>Your Organization</CardTitle>
            <CardDescription>
              Organization details and settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/dashboard/clients/${ownOrg.id}`}
              className="flex items-center justify-between p-4 rounded-lg border bg-slate-50/50 hover:bg-slate-100/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{ownOrg.name}</p>
                  <p className="text-sm text-slate-500">{ownOrg.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant={ownOrg.status === 'active' ? 'default' : 'secondary'}
                  className={ownOrg.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-100' : ''}
                >
                  {ownOrg.status}
                </Badge>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </div>
            </Link>
          </CardContent>
        </Card>
      )}

      {!canManageOrgs && !ownOrg && (
        <Card>
          <CardContent className="pt-6">
            <div className="h-[200px] flex items-center justify-center text-slate-400 border-2 border-dashed rounded-lg">
              No organization associated with your account.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StatsCard({
  title,
  value,
  description,
  icon,
}: {
  title: string
  value: string
  description?: string
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold truncate">{value}</div>
        {description && (
          <p className="text-xs text-slate-500 truncate">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

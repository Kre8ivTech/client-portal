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
import { Plus, Users, Building2 } from 'lucide-react'
import Link from 'next/link'

export default async function ClientsPage() {
  const supabase = (await createServerSupabaseClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const organizationId = profile?.organization_id ?? null
  const role = profile?.role ?? 'client'

  let ownOrg: { id: string; name: string; slug: string; type: string; status: string } | null = null
  let clientOrgs: { id: string; name: string; slug: string; type: string; status: string }[] = []
  let totalClients = 0
  let activePartners = 0

  if (organizationId) {
    const { data: org } = await supabase
      .from('organizations')
      .select('id, name, slug, type, status')
      .eq('id', organizationId)
      .single()
    ownOrg = org ?? null

    const { data: children } = await supabase
      .from('organizations')
      .select('id, name, slug, type, status')
      .eq('parent_org_id', organizationId)
      .order('name', { ascending: true })
    clientOrgs = (children ?? []).map((o: { id: string; name: string; slug: string; type: string; status: string }) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      type: o.type,
      status: o.status,
    }))
    totalClients = clientOrgs.length
    activePartners = clientOrgs.filter((o) => o.status === 'active').length
  }

  const isPartner = role === 'partner' || role === 'partner_staff' || role === 'super_admin' || role === 'staff'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Clients
          </h2>
          <p className="text-slate-500">
            Manage your agency partners and direct client organizations.
          </p>
        </div>
        {isPartner && (
          <Button className="gap-2" asChild>
            <Link href="/dashboard/settings">
              <Plus size={18} />
              Add Organization
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Total Clients"
          value={String(totalClients)}
          icon={<Users className="text-slate-400" size={20} />}
        />
        <StatsCard
          title="Active"
          value={String(activePartners)}
          icon={<Building2 className="text-slate-400" size={20} />}
        />
        <StatsCard
          title="Your organization"
          value={ownOrg?.name ?? '—'}
          icon={<Building2 className="text-slate-400" size={20} />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Directory</CardTitle>
          <CardDescription>
            {isPartner
              ? 'Client organizations under your management.'
              : 'Your organization. Client directory is available to partners.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ownOrg && (
            <div className="space-y-4">
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
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-200 text-slate-700 capitalize">
                  {ownOrg.type}
                </span>
              </Link>
              {isPartner && clientOrgs.length > 0 && (
                <>
                  <h4 className="text-sm font-semibold text-slate-700 mt-6">Client organizations</h4>
                  <ul className="space-y-2">
                    {clientOrgs.map((org) => (
                      <li key={org.id}>
                        <Link
                          href={`/dashboard/clients/${org.id}`}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                              <Users className="h-4 w-4 text-slate-500" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{org.name}</p>
                              <p className="text-xs text-slate-500">{org.slug}</p>
                            </div>
                          </div>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                            {org.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {isPartner && clientOrgs.length === 0 && (
                <p className="text-slate-500 text-sm py-4">
                  No client organizations yet. Add organizations in Settings.
                </p>
              )}
            </div>
          )}
          {!ownOrg && (
            <div className="h-[200px] flex items-center justify-center text-slate-400 border-2 border-dashed rounded-lg">
              No organization associated with your account.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatsCard({
  title,
  value,
  icon,
}: {
  title: string
  value: string
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  )
}

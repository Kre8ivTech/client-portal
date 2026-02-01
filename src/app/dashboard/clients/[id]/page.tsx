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
import { Building2, ChevronLeft, Ticket, Users } from 'lucide-react'

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
    .select('id, name, slug, type, status, parent_org_id')
    .eq('id', orgId)
    .single()

  if (!org) notFound()

  type ProfileRow = { organization_id: string | null; role: string }
  const prof = profile as ProfileRow | null
  const isOwnOrg = prof?.organization_id === org.id
  const isChildOrg = org.parent_org_id === prof?.organization_id
  const isSuperAdmin = prof?.role === "super_admin"
  const canView = isOwnOrg || isChildOrg || isSuperAdmin

  if (!canView) notFound()

  const { count: ticketCount } = await supabase
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)

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
            <p className="text-slate-500">{org.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
            {org.type}
          </span>
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
            {org.status}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ticketCount ?? 0}</div>
            <p className="text-xs text-slate-500 mt-1">Total tickets for this organization</p>
            <Button variant="outline" size="sm" className="mt-3" asChild>
              <Link href="/dashboard/tickets">View tickets</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organization</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              {isOwnOrg ? 'Your organization' : 'Client organization under your management'}
            </p>
            {!isOwnOrg && (
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/dashboard/settings">Settings</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          <CardDescription>Organization information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
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
        </CardContent>
      </Card>
    </div>
  )
}

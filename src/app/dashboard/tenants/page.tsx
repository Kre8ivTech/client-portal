import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  Plus,
  Users,
  Calendar,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function TenantsPage() {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'super_admin') {
    redirect('/dashboard')
  }

  const { data: tenants } = await (supabase as any)
    .from('organizations')
    .select('id, name, slug, created_at, parent_org_id')
    .order('created_at', { ascending: false })

  const { data: userCounts } = await (supabase as any)
    .from('users')
    .select('organization_id')

  const userCountMap = new Map()
  userCounts?.forEach((u: any) => {
    const count = userCountMap.get(u.organization_id) || 0
    userCountMap.set(u.organization_id, count + 1)
  })

  const tenantsList = (tenants || []).map((t: any) => ({
    ...t,
    user_count: userCountMap.get(t.id) || 0
  }))

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Tenant Organizations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage multi-tenant organizations
          </p>
        </div>
        <Link href="/dashboard/tenants/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Tenant
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Tenants</CardDescription>
            <CardTitle className="text-3xl">{tenantsList.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Parent Orgs</CardDescription>
            <CardTitle className="text-3xl">
              {tenantsList.filter((t: any) => !t.parent_org_id).length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Users</CardDescription>
            <CardTitle className="text-3xl">
              {tenantsList.reduce((sum: number, t: any) => sum + t.user_count, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {tenantsList.length === 0 ? (
            <div className="text-center py-12">
              <p className="mb-4">No tenants yet</p>
              <Link href="/dashboard/tenants/new">
                <Button><Plus className="mr-2 h-4 w-4" />Add First Tenant</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {tenantsList.map((tenant: any) => (
                <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-start gap-4">
                    <Building2 className="h-5 w-5 mt-1" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{tenant.name}</h3>
                        {!tenant.parent_org_id && <Badge>Parent</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <Users className="h-3 w-3 inline mr-1" />
                        {tenant.user_count} users · Created {format(new Date(tenant.created_at), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <Link href={`/dashboard/tenants/${tenant.id}`}>
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

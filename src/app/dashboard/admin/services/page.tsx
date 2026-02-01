import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ServiceList } from '@/components/services/service-list'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function AdminServicesPage() {
  const supabase = await createServerSupabaseClient()

  // Check auth and role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Unauthorized</div>
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return <div>Profile not found</div>
  }

  const p = profile as { organization_id: string | null; role: string }
  if (!['super_admin', 'staff'].includes(p.role)) {
    return <div>Forbidden - Admin access required</div>
  }

  // Fetch services
  const servicesQuery = (supabase as any)
    .from('services')
    .select('*, created_by_user:users!created_by(id, profiles(name))')
  
  if (p.organization_id) {
    servicesQuery.eq('organization_id', p.organization_id)
  }
  
  const { data: services } = await servicesQuery
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Services</h1>
          <p className="text-slate-500 mt-1">
            Manage your service catalog and pricing
          </p>
        </div>
        <Link href="/dashboard/admin/services/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Service
          </Button>
        </Link>
      </div>

      {/* Service List */}
      <ServiceList initialServices={services || []} />
    </div>
  )
}

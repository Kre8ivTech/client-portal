import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ServiceRequestCard } from '@/components/services/ServiceRequestCard'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function ServicePage() {
  const supabase = await createServerSupabaseClient()

  // Check auth
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

  // Fetch service requests
  let query = (supabase as any)
    .from('service_requests')
    .select(`
      *,
      service:services(id, name, base_rate, rate_type)
    `)
  
  if (p.organization_id) {
    query = query.eq('organization_id', p.organization_id)
  }
  
  query = query.order('created_at', { ascending: false })

  // Clients only see their own requests
  if (p.role === 'client') {
    query = query.eq('requested_by', user.id)
  }

  const { data: serviceRequests } = await query

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Service Requests</h1>
          <p className="text-muted-foreground mt-1">
            Request services from our catalog and track their progress
          </p>
        </div>
        <Link href="/dashboard/service/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </Link>
      </div>

      {/* Service Requests List */}
      {serviceRequests && serviceRequests.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceRequests.map((request: any) => (
            <ServiceRequestCard key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No service requests yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first service request to get started
          </p>
          <Link href="/dashboard/service/new">
            <Button className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              New Service Request
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

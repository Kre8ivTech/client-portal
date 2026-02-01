import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ServiceRequestsList } from '@/components/services/ServiceRequestsList'

export default async function AdminServiceRequestsPage() {
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
  if (!['super_admin', 'staff', 'partner'].includes(p.role)) {
    return <div>Forbidden - Admin access required</div>
  }

  // Fetch all service requests for the organization
  const serviceRequestsQuery = (supabase as any)
    .from('service_requests')
    .select(`
      *,
      service:services(id, name, description, category, base_rate, rate_type),
      requester:users!requested_by(id, email, profiles(name, avatar_url))
    `)
  
  if (p.organization_id) {
    serviceRequestsQuery.eq('organization_id', p.organization_id)
  }
  
  const { data: serviceRequests } = await serviceRequestsQuery
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Service Requests</h1>
        <p className="text-muted-foreground mt-1">
          Review and manage client service requests
        </p>
      </div>

      {/* Service Requests List */}
      <ServiceRequestsList initialRequests={serviceRequests || []} />
    </div>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ServiceRequestForm } from '@/components/services/ServiceRequestForm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NewServiceRequestPage() {
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
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return <div>Profile not found</div>
  }

  const p = profile as { organization_id: string | null }
  if (!p.organization_id) {
    return <div>No organization associated with your account</div>
  }

  // Fetch parent org (if any) so clients can request parent-provided services
  const { data: orgRow } = await (supabase as any)
    .from('organizations')
    .select('parent_org_id')
    .eq('id', p.organization_id)
    .single()

  const parentOrgId = (orgRow as { parent_org_id: string | null } | null)?.parent_org_id ?? null
  const serviceOrgIds = [p.organization_id, parentOrgId].filter(Boolean) as string[]

  // Fetch active services for this organization
  const servicesQuery = (supabase as any)
    .from('services')
    .select('*')
    .eq('is_active', true)

  if (serviceOrgIds.length === 1) {
    servicesQuery.eq('organization_id', serviceOrgIds[0])
  } else {
    servicesQuery.in('organization_id', serviceOrgIds)
  }

  const { data: services } = await servicesQuery
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/service"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Service Requests
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">New Service Request</h1>
        <p className="text-muted-foreground mt-1">
          Request a service from our catalog. Your request will be reviewed and we&apos;ll follow up.
        </p>
      </div>

      {/* Form */}
      <ServiceRequestForm services={services || []} />
    </div>
  )
}

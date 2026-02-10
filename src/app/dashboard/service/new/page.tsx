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
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return <div>Profile not found</div>
  }

  const p = profile as { organization_id: string | null; role: string }
  const isStaffOrAdmin = ['super_admin', 'staff'].includes(p.role)

  // For regular clients, require organization
  if (!isStaffOrAdmin && !p.organization_id) {
    return <div>No organization associated with your account</div>
  }

  // Fetch active services - include global services and organization-specific services
  let { data: services, error: servicesError } = await (supabase as any)
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  // If the query succeeded, filter to include:
  // 1. Services from user's organization
  // 2. Global services (is_global = true)
  // 3. Parent org services (for white-label clients)
  // Note: For clients, RLS may already filter, but we ensure global services are included
  if (services && p.organization_id) {
    // If is_global column doesn't exist yet, all services are treated as org-specific
    services = services.filter((s: any) => {
      // Include if it's a global service
      if (s.is_global === true) return true
      // Include if it belongs to the user's organization
      if (s.organization_id === p.organization_id) return true
      // For staff/admin, include all services
      if (isStaffOrAdmin) return true
      return false
    })
  }

  // Fetch organizations for staff/admin to assign
  let organizations: { id: string; name: string }[] = []
  if (isStaffOrAdmin) {
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name')
      .order('name', { ascending: true })
    organizations = orgs || []
  }

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
          {isStaffOrAdmin
            ? 'Create a service request for a client organization.'
            : "Request a service from our catalog. Your request will be reviewed and we'll follow up."}
        </p>
      </div>

      {/* Form */}
      <ServiceRequestForm 
        services={services || []} 
        organizations={organizations}
        isStaffOrAdmin={isStaffOrAdmin}
        defaultOrganizationId={p.organization_id}
      />
    </div>
  )
}

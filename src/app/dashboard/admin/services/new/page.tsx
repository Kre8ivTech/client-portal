import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ServiceForm } from '@/components/services/service-form'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NewServicePage() {
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/admin/services"
          className="inline-flex items-center text-sm text-slate-500 hover:text-primary mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Services
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Service</h1>
        <p className="text-slate-500 mt-1">Add a new service to your catalog</p>
      </div>

      {/* Form */}
      <ServiceForm />
    </div>
  )
}

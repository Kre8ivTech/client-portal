import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreateTenantForm } from '@/components/tenants/create-tenant-form'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NewTenantPage() {
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

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <Link
        href="/dashboard/tenants"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Tenants
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Add New Tenant</h1>
        <p className="text-muted-foreground mt-1">
          Create a new tenant organization
        </p>
      </div>

      <CreateTenantForm />
    </div>
  )
}

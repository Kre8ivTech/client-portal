import { createServerSupabaseClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function TenantManagePage({
  params,
}: {
  params: Promise<{ tenantId: string }>
}) {
  const { tenantId } = await params

  if (!UUID_REGEX.test(tenantId)) {
    notFound()
  }

  const supabase = (await createServerSupabaseClient()) as any
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

  // Ensure tenant exists before redirecting to shared org management page.
  const { data: tenant } = await supabase
    .from('organizations')
    .select('id')
    .eq('id', tenantId)
    .single()

  if (!tenant) {
    notFound()
  }

  redirect(`/dashboard/clients/${tenantId}`)
}


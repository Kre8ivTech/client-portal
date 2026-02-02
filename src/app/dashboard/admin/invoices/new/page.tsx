import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NewInvoicePage() {
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
    .select('organization_id, role, is_account_manager')
    .eq('id', user.id)
    .single()

  const p = profile as { organization_id: string | null; role: string; is_account_manager: boolean } | null
  const isAuthorized =
    p &&
    (p.role === 'super_admin' ||
      (p.role === 'staff' && p.is_account_manager))

  if (!isAuthorized) {
    return <div>Forbidden - Account manager access required</div>
  }

  // Fetch clients for the organization
  const { data: clients } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('organization_id', p.organization_id)
    .eq('role', 'client')
    .order('full_name')

  // We need the InvoiceForm component here
  const { InvoiceForm } = await import('@/components/admin/invoices/invoice-form')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/admin/invoices"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Invoices
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create New Invoice</h1>
        <p className="text-muted-foreground mt-1">
          Generate an invoice for client billing
        </p>
      </div>

      <InvoiceForm 
        organizationId={p.organization_id || ''} 
        clients={clients || []} 
      />
    </div>
  )
}

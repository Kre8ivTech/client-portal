import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default async function AdminInvoicesPage() {
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

  const isAuthorized =
    profile &&
    (profile.role === 'super_admin' ||
      (profile.role === 'staff' && profile.is_account_manager) ||
      profile.role === 'partner')

  if (!isAuthorized) {
    return <div>Forbidden - Account manager access required</div>
  }

  // Fetch invoices with line items
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*, created_by_user:users!created_by(id, email, profiles(name))')
    .eq('organization_id', profile!.organization_id)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">
            Manage invoices and track payments
          </p>
        </div>
        <Link href="/dashboard/admin/invoices/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Invoices Grid */}
      {invoices && invoices.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="border rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-lg">{invoice.invoice_number}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : invoice.status === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : invoice.status === 'sent'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {invoice.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Due: {new Date(invoice.due_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    ${(invoice.total / 100).toFixed(2)}
                  </p>
                  {invoice.balance_due > 0 && (
                    <p className="text-sm text-muted-foreground">
                      Balance: ${(invoice.balance_due / 100).toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No invoices yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first invoice to get started
          </p>
          <Link href="/dashboard/admin/invoices/new">
            <Button className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}

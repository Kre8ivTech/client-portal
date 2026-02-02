import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Plus, Search, Filter, FileText } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default async function AdminContractsPage() {
  const supabase = await createServerSupabaseClient()

  // Check auth and role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div className="p-8 text-center">Unauthorized</div>
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const p = profile as { organization_id: string | null; role: string } | null
  const isAuthorized = p && (p.role === 'super_admin' || p.role === 'staff')

  if (!isAuthorized) {
    return <div className="p-8 text-center text-destructive">Forbidden - Admin access required</div>
  }

  // Fetch contracts
  const contractsQuery = (supabase as any)
    .from('contracts')
    .select(`
      *,
      client:users!contracts_client_id_fkey(
        id,
        email
      ),
      template:contract_templates(
        id,
        name
      )
    `)
  
  if (p?.organization_id) {
    contractsQuery.eq('organization_id', p.organization_id)
  }
  
  const { data: contracts, error } = await contractsQuery
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching contracts:', error)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            Manage Contracts
          </h1>
          <p className="text-slate-500 mt-1">
            Create, track and manage client agreements with DocuSign integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/admin/contracts/templates">
            <Button variant="outline" className="hidden md:flex">
              Manage Templates
            </Button>
          </Link>
          <Link href="/dashboard/admin/contracts/new">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              New Contract
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search contracts by title or client..." 
            className="pl-10 w-full"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" className="gap-2 shrink-0">
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      {/* Contracts Table/List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {contracts && contracts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Contract</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Client</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Created</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {contracts.map((contract: any) => (
                  <tr key={contract.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                          {contract.title}
                        </span>
                        <span className="text-xs text-slate-500 line-clamp-1">
                          {contract.template?.name || 'Manual Contract'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm">
                        <span className="text-slate-700">{contract.client?.email || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={contract.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {new Date(contract.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/dashboard/admin/contracts/${contract.id}`}>
                        <Button variant="ghost" size="sm" className="h-8">
                          View Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-20 px-4">
            <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No contracts found</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-2">
              Start by creating a new contract or setting up a contract template.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Link href="/dashboard/admin/contracts/templates">
                <Button variant="outline">Setup Templates</Button>
              </Link>
              <Link href="/dashboard/admin/contracts/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Contract
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600 border-slate-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    sent: 'bg-blue-100 text-blue-700 border-blue-200',
    viewed: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    signed: 'bg-green-100 text-green-700 border-green-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    expired: 'bg-red-100 text-red-700 border-red-200',
    cancelled: 'bg-slate-200 text-slate-700 border-slate-300',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  }

  return (
    <Badge variant="outline" className={`${styles[status] || styles.draft} capitalize font-bold px-2 py-0.5 rounded-full text-[10px]`}>
      {status}
    </Badge>
  )
}

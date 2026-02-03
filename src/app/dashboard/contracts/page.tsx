import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from '@/components/ui/badge'
import { FileText, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default async function ContractsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  // Fetch client's contracts
  const { data: contracts, error } = await (supabase as any)
    .from('contracts')
    .select(`
      *,
      template:contract_templates(name)
    `)
    .eq('client_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="w-full space-y-8 py-8 px-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Your Contracts</h1>
        <p className="text-slate-500 mt-2">
          View and manage your service agreements, NDAs, and other legal documents.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard 
          title="Active" 
          count={contracts?.filter((c: any) => c.status === 'signed' || c.status === 'completed').length || 0} 
          icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
          color="bg-emerald-50"
        />
        <StatsCard 
          title="Pending" 
          count={contracts?.filter((c: any) => ['pending', 'sent', 'viewed'].includes(c.status)).length || 0} 
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          color="bg-amber-50"
        />
        <StatsCard 
          title="Total" 
          count={contracts?.length || 0} 
          icon={<FileText className="h-5 w-5 text-blue-500" />}
          color="bg-blue-50"
        />
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-200 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Agreement History</CardTitle>
            <CardDescription>A complete list of your contracts with us</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {contracts && contracts.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {contracts.map((contract: any) => (
                <Link 
                  key={contract.id} 
                  href={`/dashboard/contracts/${contract.id}`}
                  className="block hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{contract.title}</h4>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-0.5">
                          <span>{contract.template?.name || 'Standard Agreement'}</span>
                          <span>•</span>
                          <span>{new Date(contract.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={contract.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-6 w-6 text-slate-300" />
              </div>
              <h3 className="font-bold text-slate-900">No contracts yet</h3>
              <p className="text-slate-500 text-sm mt-1">When we share an agreement with you, it will appear here.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StatsCard({ title, count, icon, color }: { title: string; count: number; icon: React.ReactNode; color: string }) {
  return (
    <div className={`p-6 rounded-xl border border-slate-200 flex items-center gap-4 ${color}`}>
      <div className="bg-white p-2.5 rounded-lg shadow-sm border border-slate-100">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black text-slate-900">{count}</p>
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
    <Badge variant="outline" className={`${styles[status] || styles.draft} capitalize font-bold px-3 py-1 rounded-full text-[11px]`}>
      {status}
    </Badge>
  )
}

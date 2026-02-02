import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ChevronLeft, FileText, Send, User, Calendar, Clock, Download, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import { ContractSigners } from '@/components/admin/contracts/contract-signers'

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Check auth and role
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  const p = profile as { organization_id: string | null; role: string } | null
  const isAuthorized = p && (p.role === 'super_admin' || p.role === 'staff')

  if (!isAuthorized) {
    return <div className="p-8 text-center text-destructive">Forbidden</div>
  }

  // Fetch contract details
  const { data: contract, error } = await (supabase as any)
    .from('contracts')
    .select(`
      *,
      client:users!contracts_client_id_fkey(
        id,
        email,
        full_name,
        profiles(name)
      ),
      creator:users!contracts_created_by_fkey(
        id,
        email,
        full_name,
        profiles(name)
      ),
      template:contract_templates(
        id,
        name,
        contract_type
      ),
      signers:contract_signers(*)
    `)
    .eq('id', id)
    .single()

  if (error || !contract) {
    return <div className="p-8 text-center">Contract not found</div>
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 py-8">
      <Link 
        href="/dashboard/admin/contracts" 
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Contracts
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
              ID: {id.slice(0, 8)}
            </span>
            <StatusBadge status={contract.status} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{contract.title}</h1>
          <p className="text-slate-500 max-w-2xl">{contract.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          {contract.status === 'signed' || contract.status === 'completed' ? (
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle className="h-4 w-4 mr-2" />
              Certificate of Completion
            </Button>
          ) : contract.status === 'draft' ? (
            <Button className="bg-primary hover:bg-primary/90">
              <Send className="h-4 w-4 mr-2" />
              Prepare for Signature
            </Button>
          ) : (
            <Button variant="outline" className="gap-2 border-primary text-primary hover:bg-primary/5">
              <ExternalLink className="h-4 w-4" />
              View in DocuSign
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Contract Document Content
                </CardTitle>
                <Badge variant="secondary" className="bg-white border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-tighter">
                  {contract.template?.name || 'Manual Upload'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 pt-10 prose prose-slate max-w-none">
              {contract.content_html ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: contract.content_html }} 
                  className="min-h-[400px] border p-8 rounded shadow-inner bg-white font-serif text-slate-800 leading-relaxed"
                />
              ) : (
                <div className="text-center py-20 bg-slate-50 rounded-lg border border-dashed text-slate-400 italic">
                  No content available for this contract draft.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Recipients & Signers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ContractSigners 
                contractId={contract.id} 
                initialSigners={contract.signers || []} 
                status={contract.status}
                client={{
                  name: contract.client?.profiles?.name || contract.client?.full_name || 'Client',
                  email: contract.client?.email
                }}
              />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-500">Metadata & Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <DetailItem 
                icon={<User className="h-4 w-4 text-slate-400" />} 
                label="Contract Owner" 
                value={contract.creator?.profiles?.name || contract.creator?.email || 'N/A'} 
              />
              <DetailItem 
                icon={<Calendar className="h-4 w-4 text-slate-400" />} 
                label="Created At" 
                value={format(new Date(contract.created_at), 'PPP')} 
              />
              <DetailItem 
                icon={<Clock className="h-4 w-4 text-slate-400" />} 
                label="Expires At" 
                value={contract.expires_at ? format(new Date(contract.expires_at), 'PPP') : 'No Expiry'} 
              />
              {contract.docusign_envelope_id && (
                <div className="pt-2 border-t mt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DocuSign Envelope ID</p>
                  <p className="text-xs font-mono mt-1 text-slate-600 break-all">{contract.docusign_envelope_id}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold text-slate-700">{value}</span>
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

function CheckCircle(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}

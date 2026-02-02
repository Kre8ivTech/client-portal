import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChevronLeft, FileText, Calendar, Clock, Download, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

export default async function ClientContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Check auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch contract details (RLS should limit to user's contracts)
  const { data: contract, error } = await (supabase as any)
    .from('contracts')
    .select(`
      *,
      creator:users!contracts_created_by_fkey(
        profiles(name)
      ),
      template:contract_templates(
        name
      )
    `)
    .eq('id', id)
    .single()

  if (error || !contract) {
    return <div className="p-8 text-center mt-20">
      <h3 className="text-xl font-bold">Contract not found</h3>
      <p className="text-slate-500 mt-2">The contract may have been removed or you may not have access to it.</p>
      <Link href="/dashboard/contracts">
        <Button variant="outline" className="mt-4">Back to My Contracts</Button>
      </Link>
    </div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 py-8">
      <Link 
        href="/dashboard/contracts" 
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to My Contracts
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">
              #{id.slice(0, 8)}
            </span>
            <StatusBadge status={contract.status} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">{contract.title}</h1>
          <p className="text-slate-500">{contract.description}</p>
        </div>

        {contract.status === 'signed' || contract.status === 'completed' ? (
          <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
            <Download className="h-4 w-4" />
            Download Signed Copy
          </Button>
        ) : (
          <Button className="bg-primary hover:bg-primary/90 gap-2 shadow-lg shadow-primary/20">
            <ShieldCheck className="h-4 w-4" />
            Sign with DocuSign
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
        <div className="lg:col-span-3">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-8 pt-12">
              <div 
                dangerouslySetInnerHTML={{ __html: contract.content_html }} 
                className="min-h-[600px] border p-12 rounded bg-white font-serif text-slate-800 leading-relaxed shadow-inner overflow-auto"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Document Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2 text-sm">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Agreement Date</p>
                <p className="font-semibold text-slate-900">{format(new Date(contract.created_at), 'PPP')}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Document Type</p>
                <p className="font-semibold text-slate-900">{contract.template?.name || 'Service Agreement'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase">Prepared By</p>
                <p className="font-semibold text-slate-900">{contract.creator?.profiles?.name || 'Company Representative'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-100 shadow-none">
            <CardContent className="p-4 flex gap-3">
              <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
              </div>
              <div className="space-y-1">
                <h5 className="text-xs font-bold text-blue-900">Secure Signing</h5>
                <p className="text-[11px] text-blue-700 leading-normal">
                  Our contracts are securely managed via DocuSign, conforming to ESIGN and UETA standards.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Button({ children, className, variant = 'primary', ...props }: any) {
  const variants: any = {
    primary: 'bg-primary text-white hover:bg-primary/90',
    outline: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
  }
  return (
    <button className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
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
    cancelled: 'bg-slate-200 text-slate-700 border-slate-300',
  }

  return (
    <Badge variant="outline" className={`${styles[status] || styles.draft} capitalize font-bold px-2 py-0.5 rounded-full text-[10px]`}>
      {status}
    </Badge>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { ChevronLeft, FileText, Send, User, Settings } from 'lucide-react'
import Link from 'next/link'
import { ContractForm } from '@/components/admin/contracts/contract-form'

export default async function NewContractPage() {
  const supabase = await createServerSupabaseClient()

  // Check auth and role
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  // Fetch clients (users in the same org or all if super_admin)
  type ClientResult = { id: string; email: string; full_name: string | null; profiles: { name: string | null } | null }
  let clientsQuery = supabase.from('users').select('id, email, full_name, profiles(name)')
  if (p.role !== 'super_admin' && p.organization_id) {
    clientsQuery = clientsQuery.eq('organization_id', p.organization_id)
  }
  const { data: clients } = await clientsQuery.order('email') as { data: ClientResult[] | null }

  // Fetch templates
  let templatesQuery = supabase.from('contract_templates').select('*').eq('is_active', true)
  if (p.role !== 'super_admin' && p.organization_id) {
    templatesQuery = templatesQuery.or(`organization_id.eq.${p.organization_id},organization_id.is.null`)
  }
  const { data: templates } = await templatesQuery.order('name')

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-8">
      <Link 
        href="/dashboard/admin/contracts" 
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Contracts
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Create New Contract</h1>
          <p className="text-slate-500 mt-1">
            Specify a client and choose a template to generate a new agreement.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mt-8">
        <div className="md:col-span-1 space-y-6">
          <div className="space-y-4">
            <StepItem 
              icon={<User className="h-4 w-4" />} 
              title="Select Client" 
              description="Choose the recipient" 
              active 
            />
            <StepItem 
              icon={<FileText className="h-4 w-4" />} 
              title="Choose Template" 
              description="Select the legal terms" 
              active
            />
            <StepItem 
              icon={<Settings className="h-4 w-4" />} 
              title="Variables" 
              description="Fill in the details" 
            />
            <StepItem 
              icon={<Send className="h-4 w-4" />} 
              title="Send & Sign" 
              description="Submit to DocuSign" 
            />
          </div>
        </div>

        <div className="md:col-span-3">
          <ContractForm
            clients={clients?.map(c => ({
              id: c.id,
              name: c.profiles?.name || c.full_name || c.email
            })) || []}
            templates={templates || []}
          />
        </div>
      </div>
    </div>
  )
}

function StepItem({ icon, title, description, active }: { icon: React.ReactNode; title: string; description: string; active?: boolean }) {
  return (
    <div className={`flex gap-3 p-3 rounded-lg border transition-all ${active ? 'bg-white border-primary/20 shadow-sm ring-1 ring-primary/5' : 'bg-slate-50 border-transparent opacity-60'}`}>
      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
        {icon}
      </div>
      <div>
        <p className={`text-xs font-bold leading-none ${active ? 'text-slate-900' : 'text-slate-500'}`}>{title}</p>
        <p className="text-[10px] text-slate-500 mt-1">{description}</p>
      </div>
    </div>
  )
}

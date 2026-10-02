import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AlertCircle, ChevronLeft, FileText, Send, Settings, User } from 'lucide-react'
import Link from 'next/link'
import { ContractForm } from '@/components/admin/contracts/contract-form'
import { normalizeDashboardRole } from '@/lib/require-role'
import { loadContractRecipients } from '@/lib/contracts/recipients'
import { decideContractSubmit } from '@/lib/contracts/docusign-config'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

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
  const role = normalizeDashboardRole(p?.role)
  const isAuthorized = role === 'super_admin' || role === 'staff'

  if (!p || !isAuthorized) {
    return <div className="p-8 text-center text-destructive">Forbidden</div>
  }

  let clients: { id: string; name: string; email: string }[] = []
  let clientsError: string | null = null
  try {
    clients = await loadContractRecipients(supabase, p, user.id)
  } catch (error) {
    clientsError = error instanceof Error ? error.message : 'Failed to load clients'
  }

  let templatesQuery = supabase
    .from('contract_templates')
    .select('id, name, description, contract_type, variables, is_active')
    .eq('is_active', true)
  if (role !== 'super_admin' && p.organization_id) {
    templatesQuery = templatesQuery.or(`organization_id.eq.${p.organization_id},organization_id.is.null`)
  }
  const { data: templates, error: templatesError } = await templatesQuery.order('name')
  const docusignConfigured = decideContractSubmit(process.env).outcome === 'send'

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

        <div className="md:col-span-3 space-y-4">
          {clientsError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Clients could not be loaded</AlertTitle>
              <AlertDescription>{clientsError}</AlertDescription>
            </Alert>
          )}
          {templatesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Templates could not be loaded</AlertTitle>
              <AlertDescription>{templatesError.message}</AlertDescription>
            </Alert>
          )}
          <ContractForm
            clients={clients}
            templates={templates || []}
            docusignConfigured={docusignConfigured}
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

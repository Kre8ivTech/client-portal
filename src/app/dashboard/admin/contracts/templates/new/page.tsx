import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { TemplateForm } from '@/components/admin/contracts/template-form'

export default async function NewContractTemplatePage() {
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 py-8">
      <Link 
        href="/dashboard/admin/contracts/templates" 
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Templates
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Create New Template</h1>
          <p className="text-slate-500 mt-1">
            Build a reusable contract template with dynamic variables.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <TemplateForm />
      </div>
    </div>
  )
}

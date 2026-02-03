import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Plus, ChevronLeft, FileCode, Edit, Trash2, Copy } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

export default async function ContractTemplatesPage() {
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

  // Fetch templates (with error handling for missing table)
  let templates = []
  try {
    let query = (supabase as any).from('contract_templates').select('*')
    if (p.role !== 'super_admin' && p.organization_id) {
      query = query.or(`organization_id.eq.${p.organization_id},organization_id.is.null`)
    }
    const { data, error } = await query.order('name')

    if (error && error.code === 'PGRST205') {
      // Table doesn't exist yet - migrations need to run
      console.warn('contract_templates table not found - migrations pending')
    } else if (error) {
      throw error
    } else {
      templates = data || []
    }
  } catch (err) {
    console.error('Error fetching templates:', err)
  }

  return (
    <div className="w-full space-y-6 px-4 py-8">
      <Link 
        href="/dashboard/admin/contracts" 
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Contracts
      </Link>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Contract Templates</h1>
          <p className="text-slate-500 mt-1">
            Standardize your legal documents with reusable templates and variables.
          </p>
        </div>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
        {templates?.map((template: any) => (
          <div key={template.id} className="group relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary/20 transition-all p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <FileCode className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 uppercase text-[9px] font-black">
                {template.contract_type}
              </Badge>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-primary transition-colors">
              {template.name}
            </h3>
            <p className="text-sm text-slate-500 line-clamp-2 mb-6 h-10">
              {template.description || 'No description provided.'}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-slate-400 mb-6">
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-600">{template.variables?.length || 0}</span>
                <span>Variables</span>
              </div>
              <span>•</span>
              <div>
                {template.organization_id ? 'Organization' : 'Global'}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
              <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold uppercase tracking-wider">
                <Edit className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-[11px] font-bold uppercase tracking-wider">
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Duplicate
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        <Link href="/dashboard/admin/contracts/templates/new" className="group">
          <div className="h-full min-h-[220px] rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-6 hover:border-primary/40 hover:bg-primary/5 transition-all text-slate-400 hover:text-primary">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <Plus className="h-6 w-6" />
            </div>
            <p className="font-bold">Add New Template</p>
            <p className="text-xs text-center mt-1 opacity-60">Create a reusable legal document with placeholders.</p>
          </div>
        </Link>
      </div>
    </div>
  )
}

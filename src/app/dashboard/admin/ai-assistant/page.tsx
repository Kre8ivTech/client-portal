import { createServerSupabaseClient } from '@/lib/supabase/server'
import { AIConfigForm } from '@/components/admin/ai-config-form'
import { requireRole } from '@/lib/require-role'

export default async function AIAdminPage() {
  await requireRole(['super_admin', 'staff'])
  
  const supabase = await createServerSupabaseClient()
  const { data: configs } = await supabase
    .from('ai_configs')
    .select('*')
    .is('organization_id', null)
    
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">AI Assistant Settings</h2>
        <p className="text-muted-foreground mt-2">
          Manage prompts and behavior for the portal&apos;s AI assistant.
        </p>
      </div>
      
      <AIConfigForm configs={configs || []} />
    </div>
  )
}

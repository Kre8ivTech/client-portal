import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CategoryForm } from '@/components/kb/category-form'
import { redirect } from 'next/navigation'

export default async function NewCategoryPage() {
  const supabase = await createServerSupabaseClient()

  // Check auth and role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  const p = profile as { organization_id: string | null; role: string }
  if (!['super_admin', 'staff'].includes(p.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Category</h1>
        <p className="text-slate-500 mt-1">
          Create a new knowledge base category
        </p>
      </div>

      <CategoryForm />
    </div>
  )
}

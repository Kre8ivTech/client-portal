import { createServerSupabaseClient } from '@/lib/supabase/server'
import { CategoryForm } from '@/components/kb/category-form'
import { redirect, notFound } from 'next/navigation'

interface EditCategoryPageProps {
  params: Promise<{ id: string }>
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const { id } = await params
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

  // Fetch category
  const { data: category, error } = await (supabase as any)
    .from('kb_categories')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !category) {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Category</h1>
        <p className="text-slate-500 mt-1">
          Update category details
        </p>
      </div>

      <CategoryForm category={category} />
    </div>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ArticleForm } from '@/components/kb/article-form'
import { redirect } from 'next/navigation'

export default async function NewArticlePage() {
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

  // Fetch categories for dropdown
  const { data: categories } = await (supabase as any)
    .from('kb_categories')
    .select('id, name, slug')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Article</h1>
        <p className="text-slate-500 mt-1">
          Create a new help article or guide
        </p>
      </div>

      <ArticleForm categories={categories || []} userId={user.id} />
    </div>
  )
}

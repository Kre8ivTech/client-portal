import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, FolderOpen, FileText, Edit, Trash2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default async function AdminKBPage() {
  const supabase = await createServerSupabaseClient()

  // Check auth and role
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <div>Unauthorized</div>
  }

  const { data: profile } = await supabase
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return <div>Profile not found</div>
  }

  const p = profile as { organization_id: string | null; role: string }
  if (!['super_admin', 'staff'].includes(p.role)) {
    return <div>Forbidden - Admin access required</div>
  }

  // Fetch categories
  const { data: categories } = await (supabase as any)
    .from('kb_categories')
    .select('*')
    .order('sort_order', { ascending: true })

  // Fetch articles
  const { data: articles } = await (supabase as any)
    .from('kb_articles')
    .select(`
      *,
      category:kb_categories(name, slug)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Base Management</h1>
        <p className="text-slate-500 mt-1">
          Manage help articles, guides, and documentation
        </p>
      </div>

      {/* Categories Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Categories
              </CardTitle>
              <CardDescription>
                Organize your help articles into categories
              </CardDescription>
            </div>
            <Link href="/dashboard/admin/kb/categories/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Category
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categories?.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No categories yet. Create your first category to get started.
              </p>
            ) : (
              categories?.map((category: any) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{category.name}</h3>
                        {!category.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Hidden
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {category.access_level}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-1">
                        {category.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/admin/kb/categories/${category.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Articles Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Articles
              </CardTitle>
              <CardDescription>
                Create and edit help articles and guides
              </CardDescription>
            </div>
            <Link href="/dashboard/admin/kb/articles/new">
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Article
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {articles?.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                No articles yet. Create your first article to get started.
              </p>
            ) : (
              articles?.map((article: any) => (
                <div
                  key={article.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{article.title}</h3>
                      <Badge
                        variant={
                          article.status === 'published'
                            ? 'default'
                            : article.status === 'draft'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-xs"
                      >
                        {article.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {article.access_level}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span>{article.category?.name || 'Uncategorized'}</span>
                      <span>{article.view_count} views</span>
                      <span>{article.helpful_count} helpful</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/kb/article/${article.slug}`} target="_blank">
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Link href={`/dashboard/admin/kb/articles/${article.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

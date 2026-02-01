import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, FileText, ChevronRight, HelpCircle } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface CategoryPageProps {
  params: Promise<{ slug: string }>
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params
  const supabase = (await createServerSupabaseClient()) as any

  // Fetch category
  const { data: category } = await supabase
    .from('kb_categories')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!category) {
    notFound()
  }

  // Fetch articles in this category
  const { data: articles } = await supabase
    .from('kb_articles')
    .select('id, title, excerpt, slug, helpful_count, updated_at')
    .eq('category_id', category.id)
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="space-y-6">
        <Button variant="ghost" asChild className="gap-2 font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl px-4 transition-all -ml-4">
          <Link href="/dashboard/kb">
            <ArrowLeft size={18} />
            Back to Knowledge Base
          </Link>
        </Button>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">{category.name}</h1>
            <p className="text-lg text-slate-500 font-medium max-w-2xl">{category.description}</p>
          </div>
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 px-4 py-1.5 rounded-full font-bold">
            {articles?.length || 0} Articles
          </Badge>
        </div>
      </div>

      {/* Articles List */}
      <div className="grid grid-cols-1 gap-4">
        {articles?.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-[40px] border border-slate-100 shadow-sm">
            <HelpCircle className="mx-auto h-16 w-16 text-slate-200 mb-6" />
            <h3 className="text-xl font-bold text-slate-400">No articles in this category yet.</h3>
            <p className="text-slate-400 mt-2">Check back later for updates and guides.</p>
          </div>
        ) : (
          articles?.map((article: any) => (
            <Card key={article.id} className="border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-[32px] overflow-hidden group">
              <Link href={`/dashboard/kb/article/${article.slug}`}>
                <CardHeader className="p-8 pb-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <FileText size={18} />
                        </div>
                        <CardTitle className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {article.title}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-base text-slate-500 line-clamp-2 mt-2 font-medium">
                        {article.excerpt}
                      </CardDescription>
                    </div>
                    <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 pt-0">
                  <div className="flex items-center gap-6 text-xs text-slate-400 font-bold uppercase tracking-wider">
                    <span>Last updated {new Date(article.updated_at).toLocaleDateString()}</span>
                    {article.helpful_count > 0 && (
                      <span className="flex items-center gap-1.5 bg-green-50 text-green-600 px-3 py-1 rounded-full">
                        <Badge variant="outline" className="h-2 w-2 p-0 rounded-full bg-green-500 border-none" />
                        {article.helpful_count} people found this helpful
                      </span>
                    )}
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Book, FileText, ChevronRight, HelpCircle, LifeBuoy, Zap } from 'lucide-react'
import Link from 'next/link'

export default async function KnowledgeBasePage() {
  const supabase = (await createServerSupabaseClient()) as any
  
  // Fetch categories
  const { data: categories } = await supabase
    .from('kb_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  // Fetch featured articles
  const { data: featuredArticles } = await supabase
    .from('kb_articles')
    .select('id, title, excerpt, slug, category_id')
    .eq('status', 'published')
    .limit(5)

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Hero Section */}
      <div className="text-center space-y-6 py-8">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">How can we help?</h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto font-medium">
          Search our knowledge base for answers to common questions, platform guides, and technical documentation.
        </p>
        <div className="max-w-2xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <Input 
              placeholder="Search for articles, guides, and more..." 
              className="h-16 pl-12 pr-32 rounded-2xl border-slate-200 bg-white shadow-xl text-lg focus:ring-blue-600"
            />
            <Button className="absolute right-2 top-2 h-12 px-8 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all active:scale-95">
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Zap size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Quick Start</h3>
          <p className="text-sm text-slate-500 mt-1">Get up and running with KT-Portal in minutes.</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Book size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">API Documentation</h3>
          <p className="text-sm text-slate-500 mt-1">Detailed technical guides for our developer tools.</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
          <div className="h-12 w-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <LifeBuoy size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Support Policies</h3>
          <p className="text-sm text-slate-500 mt-1">Learn about our SLAs, standards, and process.</p>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Browse by Category</h2>
            <p className="text-slate-500 font-medium">Find exactly what you're looking for by browsing our categories.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories?.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
              <HelpCircle className="mx-auto h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">No categories found. Check back soon!</p>
            </div>
          ) : (
            categories?.map((category: any) => (
              <Card key={category.id} className="border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden group rounded-3xl">
                <CardHeader className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 bg-slate-50 text-slate-900 rounded-2xl flex items-center justify-center shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <FileText size={28} />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">{category.name}</CardTitle>
                      <CardDescription className="line-clamp-1">{category.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-0">
                  <Link 
                    href={`/dashboard/kb/category/${category.slug}`}
                    className="flex items-center justify-between w-full p-4 bg-slate-50 rounded-2xl text-sm font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors group/link"
                  >
                    View Articles
                    <ChevronRight className="h-4 w-4 transform group-hover/link:translate-x-1 transition-transform" />
                  </Link>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Featured Articles */}
      <div className="bg-slate-900 rounded-[40px] p-8 md:p-12 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full"></div>
        <div className="relative z-10 space-y-8">
          <div>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 mb-4">Featured Content</Badge>
            <h2 className="text-3xl font-black tracking-tight">Essential Reading</h2>
            <p className="text-slate-400 mt-2 font-medium">Most read articles from our documentation team.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredArticles?.map((article: any) => (
              <Link 
                key={article.id} 
                href={`/dashboard/kb/article/${article.slug}`}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
              >
                <div className="h-10 w-10 shrink-0 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-blue-600 transition-colors">
                  <FileText size={20} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold truncate text-slate-100">{article.title}</p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{article.excerpt}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-600 ml-auto" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

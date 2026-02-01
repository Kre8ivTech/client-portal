import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Clock, User, Share2, ThumbsUp, ThumbsDown, MessageSquare, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const supabase = (await createServerSupabaseClient()) as any

  const { data: article } = await supabase
    .from('kb_articles')
    .select(`
      *,
      category:kb_categories (
        name,
        slug
      ),
      author:profiles (
        name,
        avatar_url
      )
    `)
    .eq('slug', slug)
    .single()

  if (!article) {
    notFound()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-slate-500 font-medium">
        <Link href="/dashboard/kb" className="hover:text-blue-600 transition-colors">Knowledge Base</Link>
        <ChevronRight size={14} />
        <Link href={`/dashboard/kb/category/${article.category?.slug}`} className="hover:text-blue-600 transition-colors">
          {article.category?.name}
        </Link>
      </nav>

      {/* Article Header */}
      <div className="space-y-6">
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
          {article.title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500 font-medium pb-8 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden relative">
              {article.author?.avatar_url ? (
                <Image src={article.author.avatar_url} alt={article.author.name ?? 'Author'} fill className="object-cover" sizes="32px" />
              ) : (
                <User size={16} />
              )}
            </div>
            <span>{article.author?.name || 'Technical Team'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} />
            <span>Updated {format(new Date(article.updated_at), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-center gap-2">
            <MessageSquare size={16} />
            <span>{article.category?.name}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-full text-slate-500 gap-2">
              <Share2 size={14} />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <article className="prose prose-slate prose-lg max-w-none prose-headings:font-black prose-headings:tracking-tight prose-a:text-blue-600 hover:prose-a:text-blue-700 prose-img:rounded-3xl prose-img:shadow-xl">
        <div dangerouslySetInnerHTML={{ __html: article.content }} />
      </article>

      {/* Helpful Feedback */}
      <Separator className="my-12" />
      
      <div className="bg-slate-50 rounded-[32px] p-8 md:p-12 text-center space-y-6 border border-slate-100 shadow-inner">
        <h3 className="text-xl font-bold text-slate-900">Was this article helpful?</h3>
        <div className="flex justify-center gap-4">
          <Button variant="outline" className="h-14 px-8 rounded-2xl bg-white border-slate-200 hover:border-blue-600 hover:bg-blue-50 transition-all gap-2 group">
            <ThumbsUp size={20} className="group-hover:text-blue-600" />
            <span className="font-bold">Yes, it helped!</span>
          </Button>
          <Button variant="outline" className="h-14 px-8 rounded-2xl bg-white border-slate-200 hover:border-red-600 hover:bg-red-50 transition-all gap-2 group">
            <ThumbsDown size={20} className="group-hover:text-red-600" />
            <span className="font-bold">Not really</span>
          </Button>
        </div>
        <p className="text-sm text-slate-500 font-medium">
          {article.helpful_count} people found this helpful
        </p>
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-between items-center py-12">
        <Button variant="ghost" asChild className="gap-2 font-bold text-slate-900 hover:bg-slate-100 rounded-xl px-6">
          <Link href="/dashboard/kb">
            <ArrowLeft size={18} />
            Back to Knowledge Base
          </Link>
        </Button>
      </div>
    </div>
  )
}

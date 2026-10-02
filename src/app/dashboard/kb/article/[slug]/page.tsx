import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Clock, User, Share2, MessageSquare, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { format } from 'date-fns'
import { generatePageMetadata, truncateDescription, stripHtml } from '@/lib/seo'
import { SafeHtml } from '@/components/ui/safe-html'
import { ArticleFeedback } from '@/components/kb/article-feedback'
import {
  KB_ARTICLE_DETAIL_SELECT,
  KB_ARTICLE_METADATA_SELECT,
  fetchKbArticle,
  type KbArticleView,
} from '@/lib/kb/article'

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

async function loadArticle(slug: string, columns: string) {
  const supabase = await createServerSupabaseClient()
  const { article, error } = await fetchKbArticle<KbArticleView>(supabase, slug, columns)
  if (error) {
    throw new Error('Failed to load knowledge base article')
  }
  return article
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await loadArticle(slug, KB_ARTICLE_METADATA_SELECT)

  if (!article) {
    return generatePageMetadata({ title: 'Article Not Found' })
  }

  const description = article.excerpt
    ? truncateDescription(article.excerpt)
    : truncateDescription(stripHtml(article.content || ''))

  return generatePageMetadata({
    title: article.title,
    description,
    openGraph: {
      type: 'article',
      title: article.title,
      description,
      publishedTime: article.created_at ?? undefined,
      modifiedTime: article.updated_at ?? undefined,
      authors: article.author?.name ? [article.author.name] : undefined,
    },
  })
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = await loadArticle(slug, KB_ARTICLE_DETAIL_SELECT)

  if (!article?.id) {
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
            <span>Updated {format(new Date(article.updated_at ?? article.created_at ?? Date.now()), 'MMM d, yyyy')}</span>
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
        <SafeHtml html={article.content} />
      </article>

      {/* Helpful Feedback */}
      <Separator className="my-12" />
      
      <ArticleFeedback articleId={article.id} initialCount={article.helpful_count || 0} />

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

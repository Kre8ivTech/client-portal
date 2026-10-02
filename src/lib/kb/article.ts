/**
 * Knowledge base article links and slug lookup.
 *
 * kb_articles.author_id references public.users. PostgREST exposes that
 * relationship as user_profiles, not profiles. Selecting author:profiles
 * fails the request, and the article page treated that failure as a 404.
 */

export function kbArticleHref(slug: string): string {
  return `/dashboard/kb/article/${slug}`
}

export const KB_ARTICLE_METADATA_SELECT =
  'title, content, excerpt, created_at, updated_at, organization_id, access_level, author:user_profiles(name)'

export const KB_ARTICLE_DETAIL_SELECT = `
      *,
      category:kb_categories (
        name,
        slug
      ),
      author:user_profiles (
        name,
        avatar_url
      )
    `

export type KbArticleScope = {
  organization_id: string | null
  access_level: string | null
}

export type KbArticleView = KbArticleScope & {
  id?: string
  title: string
  slug?: string
  content?: string | null
  excerpt?: string | null
  created_at?: string | null
  updated_at?: string | null
  helpful_count?: number | null
  author?: { name?: string | null; avatar_url?: string | null } | null
  category?: { name?: string | null; slug?: string | null } | null
}

type QueryError = { message?: string } | null

type EqResult<T> = PromiseLike<{ data: T; error: QueryError }> & {
  maybeSingle: () => PromiseLike<{ data: T; error: QueryError }>
}

export type KbArticleReader = {
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } | null } }>
  }
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => EqResult<unknown>
    }
  }
}

/**
 * Choose the article a viewer should open when a slug matches more than one
 * row RLS already returned. Prefer the viewer's organization, then a platform
 * article (organization_id is null). Never query past RLS.
 */
export function pickKbArticle<T extends KbArticleScope>(
  articles: readonly T[],
  viewerOrganizationId: string | null,
): T | null {
  if (articles.length === 0) return null

  if (viewerOrganizationId) {
    const own = articles.find((article) => article.organization_id === viewerOrganizationId)
    if (own) return own
  }

  const platform = articles.find((article) => article.organization_id == null)
  if (platform) return platform

  return articles[0] ?? null
}

function asArticleRows<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') return [data as T]
  return []
}

export async function fetchKbArticle<T extends KbArticleScope>(
  supabase: KbArticleReader,
  slug: string,
  columns: string,
): Promise<{ article: T | null; error: string | null }> {
  const { data: authData } = await supabase.auth.getUser()
  let viewerOrganizationId: string | null = null

  if (authData.user) {
    const { data: viewer, error: viewerError } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', authData.user.id)
      .maybeSingle()

    if (viewerError) {
      return { article: null, error: viewerError.message ?? 'Failed to load viewer organization' }
    }

    const organizationId = (viewer as { organization_id?: string | null } | null)?.organization_id
    viewerOrganizationId = organizationId ?? null
  }

  const { data, error } = await supabase.from('kb_articles').select(columns).eq('slug', slug)

  if (error) {
    return { article: null, error: error.message ?? 'Failed to load knowledge base article' }
  }

  return {
    article: pickKbArticle(asArticleRows<T>(data), viewerOrganizationId),
    error: null,
  }
}

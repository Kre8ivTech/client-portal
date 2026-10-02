import { describe, expect, it } from 'vitest'
import {
  KB_ARTICLE_DETAIL_SELECT,
  KB_ARTICLE_METADATA_SELECT,
  fetchKbArticle,
  kbArticleHref,
  pickKbArticle,
  type KbArticleReader,
  type KbArticleScope,
} from '@/lib/kb/article'

const partnerOrg = 'org-embark'
const otherOrg = 'org-other'

function article(overrides: Partial<KbArticleScope> & { slug: string; title: string }): KbArticleScope & {
  slug: string
  title: string
} {
  return {
    organization_id: null,
    access_level: 'public',
    ...overrides,
  }
}

function reader(options: {
  userId: string | null
  organizationId?: string | null
  articles: unknown
  articleError?: { message: string } | null
  viewerError?: { message: string } | null
}): KbArticleReader & { filters: { table: string; column: string; value: string; columns: string }[] } {
  const filters: { table: string; column: string; value: string; columns: string }[] = []

  return {
    filters,
    auth: {
      getUser: async () => ({ data: { user: options.userId ? { id: options.userId } : null } }),
    },
    from(table: string) {
      return {
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              filters.push({ table, column, value, columns })
              const result = {
                data: table === 'users' ? { organization_id: options.organizationId ?? null } : options.articles,
                error: table === 'users' ? options.viewerError ?? null : options.articleError ?? null,
              }
              const query = Promise.resolve(result) as Promise<typeof result> & {
                maybeSingle: () => Promise<typeof result>
              }
              query.maybeSingle = () => Promise.resolve(result)
              return query
            },
          }
        },
      }
    },
  }
}

describe('kbArticleHref', () => {
  it('matches the App Router article page', () => {
    expect(kbArticleHref('getting-started-cpanel-hosting')).toBe(
      '/dashboard/kb/article/getting-started-cpanel-hosting',
    )
  })
})

describe('knowledge base article select', () => {
  it('embeds the author through user_profiles, the relationship author_id actually has', () => {
    for (const select of [KB_ARTICLE_DETAIL_SELECT, KB_ARTICLE_METADATA_SELECT]) {
      expect(select).toContain('author:user_profiles')
      expect(select).not.toMatch(/author:profiles\b/)
    }
    expect(KB_ARTICLE_DETAIL_SELECT).toContain('category:kb_categories')
  })
})

describe('pickKbArticle', () => {
  const platform = article({ slug: 'dns', title: 'Platform DNS', organization_id: null, access_level: 'public' })
  const own = article({
    slug: 'dns',
    title: 'Embark DNS',
    organization_id: partnerOrg,
    access_level: 'client_specific',
  })
  const foreign = article({
    slug: 'dns',
    title: 'Other tenant DNS',
    organization_id: otherOrg,
    access_level: 'client_specific',
  })

  it('prefers the viewer organization over a platform article with the same slug', () => {
    expect(pickKbArticle([platform, foreign, own], partnerOrg)).toEqual(own)
  })

  it('opens a platform article when the viewer has no copy of that slug', () => {
    expect(pickKbArticle([foreign, platform], partnerOrg)).toEqual(platform)
  })

  it('returns null when the slug is missing', () => {
    expect(pickKbArticle([], partnerOrg)).toBeNull()
  })
})

describe('fetchKbArticle', () => {
  it('loads the slug the list links to and keeps a single platform article', async () => {
    const slug = 'getting-started-cpanel-hosting'
    const row = article({ slug, title: 'Getting Started', organization_id: null, access_level: 'public' })
    const supabase = reader({ userId: 'user-1', organizationId: partnerOrg, articles: [row] })

    const { article: loaded, error } = await fetchKbArticle(supabase, slug, KB_ARTICLE_DETAIL_SELECT)

    expect(error).toBeNull()
    expect(loaded).toEqual(row)
    expect(kbArticleHref(slug)).toBe(`/dashboard/kb/article/${slug}`)
    expect(supabase.filters).toContainEqual({
      table: 'kb_articles',
      column: 'slug',
      value: slug,
      columns: KB_ARTICLE_DETAIL_SELECT,
    })
  })

  it('does not treat a relationship error as an empty article', async () => {
    const supabase = reader({
      userId: 'user-1',
      organizationId: partnerOrg,
      articles: null,
      articleError: {
        message:
          "Could not find a relationship between 'kb_articles' and 'profiles' in the schema cache",
      },
    })

    const { article: loaded, error } = await fetchKbArticle(
      supabase,
      'getting-started-cpanel-hosting',
      'author:profiles(name)',
    )

    expect(loaded).toBeNull()
    expect(error).toMatch(/relationship/i)
  })
})

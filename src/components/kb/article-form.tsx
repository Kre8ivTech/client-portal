'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2, Eye } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

interface ArticleFormProps {
  article?: any
  categories: any[]
  userId: string
}

export function ArticleForm({ article, categories, userId }: ArticleFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: article?.title || '',
    slug: article?.slug || '',
    excerpt: article?.excerpt || '',
    content: article?.content || '',
    category_id: article?.category_id || (categories[0]?.id || ''),
    status: article?.status || 'draft',
    access_level: article?.access_level || 'public',
    featured_image: article?.featured_image || '',
    meta_title: article?.meta_title || '',
    meta_description: article?.meta_description || '',
    tags: article?.tags || [],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const dataToSave = {
        ...formData,
        author_id: userId,
        published_at: formData.status === 'published' ? new Date().toISOString() : article?.published_at,
        updated_at: new Date().toISOString(),
      }

      if (article) {
        // Update existing article
        const { error } = await (supabase as any)
          .from('kb_articles')
          .update(dataToSave)
          .eq('id', article.id)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Article updated successfully',
        })
      } else {
        // Create new article
        const { error } = await (supabase as any)
          .from('kb_articles')
          .insert([dataToSave])

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Article created successfully',
        })
      }

      router.push('/dashboard/admin/kb')
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!article) return
    
    if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
      return
    }

    setLoading(true)

    try {
      const { error } = await (supabase as any)
        .from('kb_articles')
        .delete()
        .eq('id', article.id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Article deleted successfully',
      })

      router.push('/dashboard/admin/kb')
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete article',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate slug from title
  const handleTitleChange = (title: string) => {
    setFormData({ ...formData, title })
    if (!article) {
      // Only auto-generate slug for new articles
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="content" className="w-full">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Article Content</CardTitle>
              <CardDescription>
                Write your help article content using HTML
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g., How to Access Your cPanel Account"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="e.g., how-to-access-cpanel"
                  required
                />
                <p className="text-xs text-slate-500">
                  URL-friendly version of the title. Will be used in the article URL.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={formData.excerpt}
                  onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                  placeholder="Brief summary that appears in article listings"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content (HTML) *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="<h2>Getting Started</h2><p>Your article content here...</p>"
                  rows={20}
                  className="font-mono text-sm"
                  required
                />
                <p className="text-xs text-slate-500">
                  Write HTML content. Use &lt;h2&gt;, &lt;h3&gt; for headings, &lt;p&gt; for paragraphs, &lt;ul&gt;/&lt;ol&gt; for lists, etc.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Article Settings</CardTitle>
              <CardDescription>
                Configure category, status, and access level
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category_id">Category *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft - Not visible to users</SelectItem>
                    <SelectItem value="published">Published - Visible to users</SelectItem>
                    <SelectItem value="archived">Archived - Hidden from users</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="access_level">Access Level</Label>
                <Select
                  value={formData.access_level}
                  onValueChange={(value) => setFormData({ ...formData, access_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public - Everyone can see</SelectItem>
                    <SelectItem value="partner">Partner - Partners and Staff only</SelectItem>
                    <SelectItem value="internal">Internal - Staff only</SelectItem>
                    <SelectItem value="client_specific">Client Specific - Organization only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="featured_image">Featured Image URL</Label>
                <Input
                  id="featured_image"
                  value={formData.featured_image}
                  onChange={(e) => setFormData({ ...formData, featured_image: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seo" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>SEO Settings</CardTitle>
              <CardDescription>
                Optimize your article for search engines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta Title</Label>
                <Input
                  id="meta_title"
                  value={formData.meta_title}
                  onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                  placeholder="Leave blank to use article title"
                />
                <p className="text-xs text-slate-500">
                  Recommended: 50-60 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta_description">Meta Description</Label>
                <Textarea
                  id="meta_description"
                  value={formData.meta_description}
                  onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                  placeholder="Brief description for search engine results"
                  rows={3}
                />
                <p className="text-xs text-slate-500">
                  Recommended: 150-160 characters
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Article Preview</CardTitle>
              <CardDescription>
                Preview how your article will look to users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-slate prose-lg max-w-none">
                <h1>{formData.title || 'Untitled Article'}</h1>
                {formData.excerpt && (
                  <p className="lead text-slate-600">{formData.excerpt}</p>
                )}
                <div dangerouslySetInnerHTML={{ __html: formData.content || '<p>No content yet...</p>' }} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between sticky bottom-0 bg-white p-4 border-t shadow-lg">
        <Link href="/dashboard/admin/kb">
          <Button type="button" variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {article && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete Article
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {article ? 'Update Article' : 'Create Article'}
          </Button>
        </div>
      </div>
    </form>
  )
}

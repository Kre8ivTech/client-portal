'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/hooks/use-toast'

interface CategoryFormProps {
  category?: any
}

export function CategoryForm({ category }: CategoryFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    icon: category?.icon || 'FolderOpen',
    sort_order: category?.sort_order || 0,
    is_active: category?.is_active ?? true,
    access_level: category?.access_level || 'public',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (category) {
        // Update existing category
        const { error } = await supabase
          .from('kb_categories')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', category.id)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Category updated successfully',
        })
      } else {
        // Create new category
        const { error } = await supabase
          .from('kb_categories')
          .insert([formData])

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Category created successfully',
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
    if (!category) return
    
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('kb_categories')
        .delete()
        .eq('id', category.id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Category deleted successfully',
      })

      router.push('/dashboard/admin/kb')
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete category',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    setFormData({ ...formData, name })
    if (!category) {
      // Only auto-generate slug for new categories
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Category Details</CardTitle>
          <CardDescription>
            Basic information about the category
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Category Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g., Getting Started"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="e.g., getting-started"
              required
            />
            <p className="text-xs text-slate-500">
              URL-friendly version of the name. Will be used in the article URL.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what this category covers"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="e.g., FolderOpen"
              />
              <p className="text-xs text-slate-500">
                Lucide icon name (optional)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-slate-500">
                Lower numbers appear first
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access & Visibility</CardTitle>
          <CardDescription>
            Control who can see this category
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_active">Active</Label>
              <p className="text-sm text-slate-500">
                Show this category on the knowledge base
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Link href="/dashboard/admin/kb">
          <Button type="button" variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          {category && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              Delete Category
            </Button>
          )}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {category ? 'Update Category' : 'Create Category'}
          </Button>
        </div>
      </div>
    </form>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, Edit, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

interface AIDocument {
  id: string
  organization_id: string | null
  title: string
  content: string
  document_type: string
  created_at: string
  updated_at: string
}

interface Organization {
  id: string
  name: string
  slug: string
}

interface AIDocumentsManagerProps {
  documents: AIDocument[]
  organizations: Organization[]
}

const DOCUMENT_TYPES = [
  { value: 'faq', label: 'FAQ' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'policy', label: 'Policy' },
  { value: 'custom', label: 'Custom' },
]

export function AIDocumentsManager({ documents: initialDocuments, organizations }: AIDocumentsManagerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [documents, setDocuments] = useState(initialDocuments)
  const [isOpen, setIsOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<AIDocument | null>(null)
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    document_type: 'documentation',
    organization_id: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const data = {
        title: formData.title,
        content: formData.content,
        document_type: formData.document_type,
        organization_id: formData.organization_id || null,
        updated_at: new Date().toISOString()
      }

      if (editingDoc) {
        const { error } = await supabase
          .from('ai_documents')
          .update(data)
          .eq('id', editingDoc.id)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Document updated successfully'
        })
      } else {
        const { error } = await supabase
          .from('ai_documents')
          .insert(data)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Document created successfully'
        })
      }

      setIsOpen(false)
      resetForm()
      router.refresh()
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save document',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      const { error } = await supabase
        .from('ai_documents')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Document deleted successfully'
      })

      setDocuments(documents.filter(d => d.id !== id))
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete document',
        variant: 'destructive'
      })
    }
  }

  const handleEdit = (doc: AIDocument) => {
    setEditingDoc(doc)
    setFormData({
      title: doc.title,
      content: doc.content,
      document_type: doc.document_type,
      organization_id: doc.organization_id || ''
    })
    setIsOpen(true)
  }

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      document_type: 'documentation',
      organization_id: ''
    })
    setEditingDoc(null)
  }

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      resetForm()
    }
  }

  return (
    <div className="space-y-4">
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDoc ? 'Edit Document' : 'Add New Document'}</DialogTitle>
            <DialogDescription>
              Add documentation, FAQs, or policies for the AI to reference
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Document title"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document_type">Type *</Label>
                <Select
                  value={formData.document_type}
                  onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                >
                  <SelectTrigger id="document_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="organization_id">Organization</Label>
                <Select
                  value={formData.organization_id}
                  onValueChange={(value) => setFormData({ ...formData, organization_id: value })}
                >
                  <SelectTrigger id="organization_id">
                    <SelectValue placeholder="Global (all orgs)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Global (all organizations)</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Document content that the AI will reference..."
                rows={12}
                className="font-mono text-sm"
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : editingDoc ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {documents.length === 0 ? (
        <div className="text-center py-12 border rounded-lg">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">No documents yet</p>
          <p className="text-sm text-muted-foreground">
            Add documentation for the AI assistant to reference
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => {
                const org = organizations.find(o => o.id === doc.organization_id)
                return (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {DOCUMENT_TYPES.find(t => t.value === doc.document_type)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {org ? org.name : <span className="text-muted-foreground">Global</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(doc.updated_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(doc)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(doc.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

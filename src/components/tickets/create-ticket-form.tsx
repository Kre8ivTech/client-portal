import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createTicketSchema, type CreateTicketInput } from '@/lib/validators/ticket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Loader2, X, FileIcon } from 'lucide-react'
import { FileUpload } from '@/components/ui/file-upload'

interface Attachment {
  key: string
  name: string
  type: string
  size: number
}

export function CreateTicketForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      priority: 'medium',
      category: 'general_inquiry',
    },
  })

  const onSubmit = async (data: CreateTicketInput) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // First create the ticket
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to create ticket')
      }

      const { data: ticket } = await response.json()

      // If we have attachments, we need to link them
      // We haven't built the attachment linking API yet, but let's assume we send them 
      // to a separate endpoint or include them in the create ticket call.
      // For now, I'll update the create ticket endpoint to accept attachments or handle them separately.
      
      if (attachments.length > 0) {
        // Parallel uploads for linking
        await Promise.all(attachments.map(file => 
           fetch(`/api/tickets/${ticket.id}/attachments`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               storage_path: file.key,
               file_name: file.name,
               file_type: file.type,
               file_size: file.size
             })
           })
        ))
      }

      router.push(`/dashboard/tickets/${ticket.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Brief summary of the issue"
              {...register('subject')}
            />
            {errors.subject && (
              <p className="text-sm text-red-500">{errors.subject.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register('category')}
              >
                <option value="general_inquiry">General Inquiry</option>
                <option value="technical_support">Technical Support</option>
                <option value="billing">Billing</option>
                <option value="bug_report">Bug Report</option>
                <option value="feature_request">Feature Request</option>
              </select>
              {errors.category && (
                <p className="text-sm text-red-500">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...register('priority')}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              {errors.priority && (
                <p className="text-sm text-red-500">{errors.priority.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Please provide detailed information..."
              className="min-h-[150px]"
              {...register('description')}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="space-y-3">
              {attachments.map((file, index) => (
                <div key={file.key} className="flex items-center justify-between p-2 border rounded-md bg-slate-50">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <FileIcon className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-slate-400 hover:text-red-500"
                    onClick={() => removeAttachment(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <FileUpload onUploadComplete={(file) => setAttachments(prev => [...prev, file])} />
            </div>
          </div>

        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Ticket
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

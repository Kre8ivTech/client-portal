'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Paperclip, UploadCloud, Download, Loader2 } from 'lucide-react'

type Attachment = {
  id: string
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_at: string
}

const MAX_FILE_SIZE = 10 * 1024 * 1024

interface TicketAttachmentsProps {
  ticketId: string
  organizationId: string
  userId: string
}

export function TicketAttachments({
  ticketId,
  organizationId,
  userId,
}: TicketAttachmentsProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: attachments, isLoading } = useQuery({
    queryKey: ['ticket-attachments', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_attachments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as Attachment[]
    },
  })

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    setError(null)

    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setError('Each file must be under 10 MB.')
        continue
      }

      const safeName = sanitizeFileName(file.name)
      const filePath = `${organizationId}/${ticketId}/${createId()}-${safeName}`

      const { error: uploadError } = await supabase.storage
        .from('ticket-attachments')
        .upload(filePath, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        })

      if (uploadError) {
        setError(uploadError.message)
        continue
      }

      const { error: insertError } = await supabase.from('ticket_attachments').insert({
        organization_id: organizationId,
        ticket_id: ticketId,
        uploaded_by: userId,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      })

      if (insertError) {
        setError(insertError.message)
      }
    }

    queryClient.invalidateQueries({ queryKey: ['ticket-attachments', ticketId] })
    setIsUploading(false)
    event.target.value = ''
  }

  const handleDownload = async (attachment: Attachment) => {
    setError(null)

    const { data, error } = await supabase.storage
      .from('ticket-attachments')
      .createSignedUrl(attachment.file_path, 60)

    if (error || !data?.signedUrl) {
      setError(error?.message || 'Unable to generate download link.')
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Paperclip className="h-4 w-4" />
          Attachments
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={isUploading}
          asChild
        >
          <label>
            <UploadCloud className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload'}
            <input
              type="file"
              className="hidden"
              multiple
              onChange={handleUpload}
            />
          </label>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Attachment error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading attachments...
        </div>
      ) : attachments && attachments.length > 0 ? (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-medium text-slate-700">{attachment.file_name}</span>
                <span className="text-xs text-slate-400">
                  {formatFileSize(attachment.file_size)}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleDownload(attachment)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 italic">No attachments uploaded.</p>
      )}
    </div>
  )
}

function sanitizeFileName(name: string) {
  const sanitized = name.replace(/[^a-zA-Z0-9._-]/g, '-')
  return sanitized.length > 120 ? sanitized.slice(0, 120) : sanitized
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function formatFileSize(size: number | null) {
  if (!size) return 'Unknown size'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

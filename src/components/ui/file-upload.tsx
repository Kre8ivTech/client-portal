'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Paperclip, X, Loader2, FileIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileUploadProps {
  onUploadComplete: (fileData: { key: string; name: string; type: string; size: number }) => void
  className?: string
}

export function FileUpload({ onUploadComplete, className }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
    setError(null)

    // Basic validation
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return
    }

    setIsUploading(true)

    try {
      // 1. Get presigned URL
      const response = await fetch('/api/storage/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      })

      if (!response.ok) throw new Error('Failed to get upload URL')
      const { uploadUrl, key } = await response.json()

      // 2. Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadResponse.ok) throw new Error('Failed to upload file to storage')

      // 3. Notify parent
      onUploadComplete({
        key,
        name: file.name,
        type: file.type,
        size: file.size,
      })

    } catch (err) {
      console.error(err)
      setError('Failed to upload file. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="gap-2"
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          Attach File
        </Button>
        <span className="text-xs text-muted-foreground">Max 5MB</span>
      </div>
      
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

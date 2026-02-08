'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, FileIcon, Loader2, AlertCircle, CheckCircle2, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import {
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from '@/lib/validators/file'

const MAX_FILES = 10

export interface UploadedFile {
  id: string
  name: string
  size: number
  mimeType: string
}

interface PendingFile {
  localId: string
  file: File
  status: 'uploading' | 'done' | 'error'
  uploadedId?: string
  error?: string
}

interface TicketFileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void
  disabled?: boolean
}

export function TicketFileUpload({ onFilesChange, disabled }: TicketFileUploadProps) {
  const [files, setFiles] = useState<PendingFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const acceptTypes = (ALLOWED_MIME_TYPES as readonly string[]).join(',')

  const notifyParent = useCallback((updatedFiles: PendingFile[]) => {
    const uploaded = updatedFiles
      .filter((f) => f.status === 'done' && f.uploadedId)
      .map((f) => ({
        id: f.uploadedId!,
        name: f.file.name,
        size: f.file.size,
        mimeType: f.file.type,
      }))
    onFilesChange(uploaded)
  }, [onFilesChange])

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `${file.name}: File must be 50 MB or smaller`
    }
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return `${file.name}: File type not allowed`
    }
    return null
  }

  const uploadFile = useCallback(async (pendingFile: PendingFile, allFiles: PendingFile[]): Promise<PendingFile[]> => {
    const formData = new FormData()
    formData.append('file', pendingFile.file)
    formData.append('folder', 'tickets')

    try {
      const res = await fetch('/api/files', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Upload failed')
      }

      const updated = allFiles.map((f) =>
        f.localId === pendingFile.localId
          ? { ...f, status: 'done' as const, uploadedId: json.data.id }
          : f
      )
      return updated
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed'
      const updated = allFiles.map((f) =>
        f.localId === pendingFile.localId
          ? { ...f, status: 'error' as const, error: errorMsg }
          : f
      )
      return updated
    }
  }, [])

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles)

    setFiles((prev) => {
      const currentCount = prev.length
      const remaining = MAX_FILES - currentCount
      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_FILES} files allowed`)
        return prev
      }

      const toAdd = fileArray.slice(0, remaining)
      if (fileArray.length > remaining) {
        toast.error(`Only ${remaining} more file${remaining === 1 ? '' : 's'} can be added (max ${MAX_FILES})`)
      }

      const validFiles: PendingFile[] = []
      for (const file of toAdd) {
        const error = validateFile(file)
        if (error) {
          toast.error(error)
          continue
        }
        // Skip duplicates by name+size
        const isDuplicate = prev.some(
          (existing) => existing.file.name === file.name && existing.file.size === file.size
        )
        if (isDuplicate) {
          toast.error(`${file.name} already added`)
          continue
        }
        validFiles.push({
          localId: crypto.randomUUID(),
          file,
          status: 'uploading',
        })
      }

      if (validFiles.length === 0) return prev

      const updated = [...prev, ...validFiles]

      // Start uploads for new files
      ;(async () => {
        let current = updated
        for (const pf of validFiles) {
          current = await uploadFile(pf, current)
          setFiles(current)
          notifyParent(current)
        }
      })()

      return updated
    })
  }, [uploadFile, notifyParent])

  const retryFile = useCallback(async (localId: string) => {
    setFiles((prev) => {
      const updated = prev.map((f) =>
        f.localId === localId ? { ...f, status: 'uploading' as const, error: undefined } : f
      )

      const toRetry = updated.find((f) => f.localId === localId)
      if (toRetry) {
        ;(async () => {
          const result = await uploadFile(toRetry, updated)
          setFiles(result)
          notifyParent(result)
        })()
      }

      return updated
    })
  }, [uploadFile, notifyParent])

  const removeFile = useCallback((localId: string) => {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.localId !== localId)
      notifyParent(updated)
      return updated
    })
  }, [notifyParent])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isDisabled = disabled || false

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-700">
          Attachments
        </span>
        <span className="text-xs text-slate-400">
          (optional, max {MAX_FILES} files, 50 MB each)
        </span>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => !isDisabled && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isDisabled) {
            e.preventDefault()
            fileInputRef.current?.click()
          }
        }}
        className={`
          flex flex-col items-center justify-center gap-1.5 p-6 border-2 border-dashed
          rounded-xl cursor-pointer transition-colors
          ${dragOver ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'}
          ${isDisabled ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <Upload className="h-6 w-6 text-slate-400" />
        <p className="text-sm text-slate-500">
          Drag and drop files here, or <span className="text-primary font-medium">browse</span>
        </p>
        <p className="text-xs text-slate-400">
          Documents, images, and archives up to 50 MB
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={acceptTypes}
        onChange={handleInputChange}
        disabled={isDisabled}
        multiple
        aria-label="Select files to attach"
        title="Select files to attach"
      />

      {/* File list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((pf) => (
            <li
              key={pf.localId}
              className={`
                flex items-center gap-3 p-3 border rounded-lg text-sm
                ${pf.status === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50/50'}
              `}
            >
              {pf.status === 'uploading' && (
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
              )}
              {pf.status === 'done' && (
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              )}
              {pf.status === 'error' && (
                <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
              )}

              <FileIcon className="h-4 w-4 text-slate-400 shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{pf.file.name}</p>
                <p className="text-xs text-slate-400">
                  {formatSize(pf.file.size)}
                  {pf.status === 'uploading' && ' - Uploading...'}
                  {pf.status === 'error' && (
                    <span className="text-red-500"> - {pf.error}</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {pf.status === 'error' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => retryFile(pf.localId)}
                    className="h-7 px-2 text-xs"
                  >
                    Retry
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(pf.localId)}
                  className="h-7 w-7 p-0"
                  aria-label={`Remove ${pf.file.name}`}
                  disabled={pf.status === 'uploading'}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

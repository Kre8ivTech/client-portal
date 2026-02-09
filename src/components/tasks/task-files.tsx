'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Upload,
  Loader2,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileText,
  FileSpreadsheet,
  FileArchive,
  MoreHorizontal,
  Trash2,
  Download,
  Paperclip,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

type TaskFile = {
  id: string
  task_id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  description: string | null
  created_at: string
  updated_at: string
  uploaded_by: {
    id: string
    name: string | null
    avatar_url: string | null
  }
}

interface TaskFilesProps {
  taskId: string
  files: TaskFile[]
  currentUserId: string
  canEdit: boolean
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/'))
    return <FileImage className="h-6 w-6 text-blue-500" />
  if (mimeType.startsWith('video/'))
    return <FileVideo className="h-6 w-6 text-purple-500" />
  if (mimeType.startsWith('audio/'))
    return <FileAudio className="h-6 w-6 text-pink-500" />
  if (mimeType.includes('pdf'))
    return <FileText className="h-6 w-6 text-red-500" />
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType.includes('csv')
  )
    return <FileSpreadsheet className="h-6 w-6 text-green-500" />
  if (
    mimeType.includes('zip') ||
    mimeType.includes('archive') ||
    mimeType.includes('tar')
  )
    return <FileArchive className="h-6 w-6 text-amber-500" />
  if (
    mimeType.includes('text') ||
    mimeType.includes('document') ||
    mimeType.includes('word')
  )
    return <FileText className="h-6 w-6 text-blue-600" />
  return <File className="h-6 w-6 text-slate-400" />
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function TaskFiles({
  taskId,
  files,
  currentUserId,
  canEdit,
}: TaskFilesProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(fileList)) {
        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
          alert(`File ${file.name} exceeds 50MB limit`)
          continue
        }

        setUploadProgress(`Uploading ${file.name}...`)

        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `tasks/${taskId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('task-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          console.error('Storage upload failed:', uploadError)
          alert(`Failed to upload ${file.name}`)
          continue
        }

        // Save file metadata via API
        const response = await fetch(`/api/tasks/${taskId}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || 'application/octet-stream',
            storage_path: filePath,
          }),
        })

        if (!response.ok) {
          // If metadata save fails, try to clean up the uploaded file
          await supabase.storage.from('task-files').remove([filePath])
          alert(`Failed to save ${file.name}`)
          continue
        }
      }

      setUploadProgress('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDeleteFile(file: TaskFile) {
    if (!confirm(`Delete ${file.file_name}?`)) return

    setDeletingFileId(file.id)
    try {
      // Delete via API (which will also delete from storage)
      const response = await fetch(
        `/api/tasks/${taskId}/files/${file.id}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        throw new Error('Failed to delete file')
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to delete file:', error)
      alert('Failed to delete file. Please try again.')
    } finally {
      setDeletingFileId(null)
    }
  }

  async function handleDownloadFile(file: TaskFile) {
    try {
      // Get download URL via API
      const response = await fetch(`/api/tasks/${taskId}/files/${file.id}`)

      if (!response.ok) {
        throw new Error('Failed to get download URL')
      }

      const { data } = await response.json()

      // Trigger download
      const link = document.createElement('a')
      link.href = data.download_url
      link.download = file.file_name
      link.click()
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download file. Please try again.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Files</CardTitle>
            <CardDescription>
              {files.length} {files.length === 1 ? 'file' : 'files'} attached to
              this task
            </CardDescription>
          </div>
          {canEdit && (
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              size="sm"
              className="gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        {isUploading && uploadProgress && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700">
            {uploadProgress}
          </div>
        )}

        {files.length > 0 ? (
          <div className="space-y-2">
            {files.map((file) => {
              const isDeleting = deletingFileId === file.id
              const uploaderName = file.uploaded_by.name ?? 'Unknown'

              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 transition-colors"
                >
                  {getFileIcon(file.mime_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">
                        {formatFileSize(file.file_size)}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <div className="flex items-center gap-1">
                        <Avatar className="h-4 w-4">
                          <AvatarImage
                            src={file.uploaded_by.avatar_url ?? undefined}
                          />
                          <AvatarFallback className="text-[8px]">
                            {uploaderName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-slate-500">
                          {uploaderName}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">
                        {formatDate(file.created_at)}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MoreHorizontal className="h-4 w-4" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                      {(file.uploaded_by.id === currentUserId || canEdit) && (
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteFile(file)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <Paperclip className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              No files yet
            </h3>
            <p className="text-slate-500 text-sm mb-4">
              Attach files to this task for reference.
            </p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

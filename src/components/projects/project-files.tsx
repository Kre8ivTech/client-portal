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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  Folder,
  FolderPlus,
  MoreHorizontal,
  Trash2,
  Download,
  Search,
  Grid3x3,
  List,
} from 'lucide-react'

type ProjectFile = {
  id: string
  file_name: string
  file_size: number
  mime_type: string | null
  storage_path: string
  folder: string
  description: string | null
  uploaded_by: string
  created_at: string
  uploader?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ProjectFilesProps {
  projectId: string
  files: ProjectFile[]
  currentUserId: string
  canEdit: boolean
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-8 w-8 text-slate-400" />
  if (mimeType.startsWith('image/'))
    return <FileImage className="h-8 w-8 text-blue-500" />
  if (mimeType.startsWith('video/'))
    return <FileVideo className="h-8 w-8 text-purple-500" />
  if (mimeType.startsWith('audio/'))
    return <FileAudio className="h-8 w-8 text-pink-500" />
  if (mimeType.includes('pdf'))
    return <FileText className="h-8 w-8 text-red-500" />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return <FileSpreadsheet className="h-8 w-8 text-green-500" />
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('tar'))
    return <FileArchive className="h-8 w-8 text-amber-500" />
  if (mimeType.includes('text') || mimeType.includes('document') || mimeType.includes('word'))
    return <FileText className="h-8 w-8 text-blue-600" />
  return <File className="h-8 w-8 text-slate-400" />
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${sizes[i]}`
}

const DEFAULT_FOLDERS = ['General', 'Documents', 'Images', 'Media', 'Deliverables']

export function ProjectFiles({
  projectId,
  files,
  currentUserId,
  canEdit,
}: ProjectFilesProps) {
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadFolder, setUploadFolder] = useState('General')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  // Get unique folders from files
  const existingFolders = Array.from(
    new Set([...DEFAULT_FOLDERS, ...files.map((f) => f.folder)])
  ).sort()

  // Filter files
  const filteredFiles = files.filter((f) => {
    const matchesFolder =
      selectedFolder === 'all' || f.folder === selectedFolder
    const matchesSearch =
      !searchQuery ||
      f.file_name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFolder && matchesSearch
  })

  // Group by folder for summary
  const folderCounts: Record<string, number> = {}
  files.forEach((f) => {
    folderCounts[f.folder] = (folderCounts[f.folder] || 0) + 1
  })

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files
    if (!fileList || fileList.length === 0) return

    setIsUploading(true)
    try {
      const targetFolder = showNewFolderInput && newFolderName.trim()
        ? newFolderName.trim()
        : uploadFolder

      for (const file of Array.from(fileList)) {
        // Validate file size (50MB max)
        if (file.size > 50 * 1024 * 1024) {
          console.error(`File ${file.name} exceeds 50MB limit`)
          continue
        }

        // Upload to S3 via the /api/files endpoint
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', `projects/${projectId}/${targetFolder}`)

        const uploadRes = await fetch('/api/files', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}))
          console.error('Upload failed:', err.error ?? uploadRes.statusText)
          continue
        }

        const { data: orgFile } = await uploadRes.json()

        // Create project_files record linking to the organization file
        const { error: dbError } = await supabase
          .from('project_files')
          .insert({
            project_id: projectId,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type || null,
            storage_path: orgFile.id,
            folder: targetFolder,
            uploaded_by: currentUserId,
          })

        if (dbError) {
          console.error('Failed to save file record:', dbError)
        }
      }

      setIsUploadDialogOpen(false)
      setNewFolderName('')
      setShowNewFolderInput(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDeleteFile(fileId: string, orgFileId: string) {
    if (!confirm('Delete this file permanently?')) return

    setDeletingFileId(fileId)
    try {
      // Delete from S3 + organization_files via API
      if (orgFileId) {
        await fetch(`/api/files/${orgFileId}`, { method: 'DELETE' })
      }

      // Delete project_files record
      const { error } = await supabase
        .from('project_files')
        .delete()
        .eq('id', fileId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to delete file:', error)
    } finally {
      setDeletingFileId(null)
    }
  }

  async function handleDownloadFile(orgFileId: string, fileName: string) {
    try {
      // Get presigned download URL from S3 via API
      const res = await fetch(`/api/files/${orgFileId}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to get download URL')
      }

      const { data } = await res.json()
      window.open(data.downloadUrl, '_blank')
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Files & Media</CardTitle>
            <CardDescription>
              {files.length} files across {Object.keys(folderCounts).length} folders
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[180px] h-9"
              />
            </div>
            <Select value={selectedFolder} onValueChange={setSelectedFolder}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="All Folders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Folders</SelectItem>
                {existingFolders.map((folder) => (
                  <SelectItem key={folder} value={folder}>
                    {folder} {folderCounts[folder] ? `(${folderCounts[folder]})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            {canEdit && (
              <Dialog
                open={isUploadDialogOpen}
                onOpenChange={setIsUploadDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Upload
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Upload Files</DialogTitle>
                    <DialogDescription>
                      Upload files to this project. Max 50MB per file.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Folder</label>
                      {showNewFolderInput ? (
                        <div className="flex gap-2 mt-1">
                          <Input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="New folder name"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setShowNewFolderInput(false)
                              setNewFolderName('')
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-1">
                          <Select
                            value={uploadFolder}
                            onValueChange={setUploadFolder}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {existingFolders.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {f}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowNewFolderInput(true)}
                          >
                            <FolderPlus className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium">Files</label>
                      <div className="mt-1 border-2 border-dashed rounded-lg p-6 text-center">
                        <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 mb-2">
                          Select files to upload
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-primary/90 cursor-pointer"
                          disabled={isUploading}
                        />
                      </div>
                    </div>
                    {isUploading && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading files...
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsUploadDialogOpen(false)}
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg border-dashed">
            <Folder className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">
              {files.length === 0 ? 'No files uploaded' : 'No matching files'}
            </h3>
            <p className="text-slate-500 text-sm">
              {canEdit
                ? 'Upload files to share with your team.'
                : 'No files have been uploaded yet.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filteredFiles.map((file) => {
              const isDeleting = deletingFileId === file.id
              return (
                <div
                  key={file.id}
                  className="group border rounded-lg p-3 hover:shadow-md transition-shadow relative"
                >
                  <div className="flex items-center justify-center h-16 mb-2">
                    {getFileIcon(file.mime_type)}
                  </div>
                  <p className="text-xs font-medium truncate" title={file.file_name}>
                    {file.file_name}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {formatFileSize(file.file_size)}
                  </p>
                  <Badge variant="outline" className="text-[10px] mt-1">
                    {file.folder}
                  </Badge>

                  {/* Actions overlay */}
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6"
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-3 w-3" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            handleDownloadFile(
                              file.storage_path,
                              file.file_name
                            )
                          }
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        {(file.uploaded_by === currentUserId || canEdit) && (
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() =>
                              handleDeleteFile(file.id, file.storage_path)
                            }
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredFiles.map((file) => {
              const isDeleting = deletingFileId === file.id
              const uploaderName =
                file.uploader?.profiles?.name ?? file.uploader?.email ?? 'Unknown'

              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 group"
                >
                  <div className="shrink-0">
                    {getFileIcon(file.mime_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.file_name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>-</span>
                      <span>{uploaderName}</span>
                      <span>-</span>
                      <span>
                        {new Date(file.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {file.folder}
                  </Badge>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        handleDownloadFile(file.storage_path, file.file_name)
                      }
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {(file.uploaded_by === currentUserId || canEdit) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-500"
                        onClick={() =>
                          handleDeleteFile(file.id, file.storage_path)
                        }
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

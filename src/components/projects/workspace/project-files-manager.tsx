'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Upload,
  Loader2,
  MoreHorizontal,
  File,
  FileText,
  FileImage,
  FileVideo,
  FileArchive,
  Folder,
  FolderPlus,
  Search,
  Trash2,
  Download,
  ChevronRight,
  Home,
  Grid3X3,
  List,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react'

type ProjectFile = {
  id: string
  project_id: string
  name: string
  file_path: string
  file_url: string
  file_size: number | null
  mime_type: string | null
  folder: string
  uploaded_by: string | null
  description: string | null
  version: number
  is_deleted: boolean
  created_at: string
  uploader?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ProjectFilesManagerProps {
  projectId: string
  initialFiles: ProjectFile[]
  canEdit: boolean
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.startsWith('video/')) return FileVideo
  if (mimeType.includes('pdf')) return FileText
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return FileArchive
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet
  if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('html') || mimeType.includes('css')) return FileCode
  if (mimeType.includes('document') || mimeType.includes('text')) return FileText
  return File
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function ProjectFilesManager({ projectId, initialFiles, canEdit }: ProjectFilesManagerProps) {
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles)
  const [currentFolder, setCurrentFolder] = useState('/')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [isUploading, setIsUploading] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  const fetchFiles = useCallback(async () => {
    const { data } = await supabase
      .from('project_files')
      .select(`
        *,
        uploader:users!project_files_uploaded_by_fkey(id, email, profiles:profiles(name, avatar_url))
      `)
      .eq('project_id', projectId)
      .eq('is_deleted', false)
      .order('folder', { ascending: true })
      .order('name', { ascending: true })

    if (data) setFiles(data as ProjectFile[])
  }, [supabase, projectId])

  const currentFiles = files.filter(f => {
    if (searchQuery) {
      return f.name.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return f.folder === currentFolder
  })

  // Get unique sub-folders from the current path
  const subFolders = Array.from(new Set(
    files
      .filter(f => {
        if (currentFolder === '/') return f.folder !== '/'
        return f.folder.startsWith(currentFolder) && f.folder !== currentFolder
      })
      .map(f => {
        const remaining = f.folder.slice(currentFolder === '/' ? 1 : currentFolder.length + 1)
        return remaining.split('/')[0]
      })
      .filter(Boolean)
  ))

  const breadcrumbs = currentFolder === '/'
    ? [{ label: 'Files', path: '/' }]
    : [
        { label: 'Files', path: '/' },
        ...currentFolder.split('/').filter(Boolean).map((segment, idx, arr) => ({
          label: segment,
          path: '/' + arr.slice(0, idx + 1).join('/'),
        })),
      ]

  async function handleFileUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setIsUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop()
        const storagePath = `projects/${projectId}/${Date.now()}-${file.name}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(storagePath, file)

        if (uploadError) {
          // If storage bucket doesn't exist, still record the file metadata
          console.error('Upload error:', uploadError)
        }

        const { data: urlData } = supabase.storage
          .from('project-files')
          .getPublicUrl(storagePath)

        await supabase.from('project_files').insert({
          project_id: projectId,
          name: file.name,
          file_path: storagePath,
          file_url: urlData?.publicUrl ?? storagePath,
          file_size: file.size,
          mime_type: file.type,
          folder: currentFolder,
          uploaded_by: user?.id,
        })

        await supabase.from('project_activity').insert({
          project_id: projectId,
          user_id: user?.id,
          action: 'uploaded',
          entity_type: 'file',
          details: { name: file.name, size: file.size },
        })
      }

      fetchFiles()
      router.refresh()
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    setIsCreatingFolder(false)

    const folderPath = currentFolder === '/'
      ? `/${newFolderName.trim()}`
      : `${currentFolder}/${newFolderName.trim()}`

    // Create a placeholder file record for the folder
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('project_files').insert({
      project_id: projectId,
      name: '.folder',
      file_path: folderPath + '/.folder',
      file_url: '',
      file_size: 0,
      mime_type: 'application/x-folder',
      folder: folderPath,
      uploaded_by: user?.id,
    })

    setNewFolderName('')
    fetchFiles()
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm('Delete this file?')) return

    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('project_files')
      .update({ is_deleted: true })
      .eq('id', fileId)

    await supabase.from('project_activity').insert({
      project_id: projectId,
      user_id: user?.id,
      action: 'deleted',
      entity_type: 'file',
      entity_id: fileId,
    })

    fetchFiles()
    router.refresh()
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    handleFileUpload(e.dataTransfer.files)
  }

  const visibleFiles = currentFiles.filter(f => f.name !== '.folder')

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border p-0.5">
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-2.5"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
          </div>
          {canEdit && (
            <>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setIsCreatingFolder(true)}>
                <FolderPlus className="h-4 w-4" /> New Folder
              </Button>
              <Button size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Upload
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => handleFileUpload(e.target.files)}
              />
            </>
          )}
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        {breadcrumbs.map((bc, idx) => (
          <div key={bc.path} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            <button
              className={`hover:text-primary transition-colors ${
                idx === breadcrumbs.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground'
              }`}
              onClick={() => { setCurrentFolder(bc.path); setSearchQuery('') }}
            >
              {idx === 0 ? <Home className="h-3.5 w-3.5 inline mr-1" /> : null}
              {bc.label}
            </button>
          </div>
        ))}
      </div>

      {/* Drop Zone / Content */}
      <div
        className={`relative rounded-lg border-2 transition-colors min-h-[300px] ${
          isDragging ? 'border-primary border-dashed bg-primary/5' : 'border-transparent'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/80 rounded-lg">
            <div className="text-center">
              <Upload className="h-10 w-10 text-primary mx-auto mb-2" />
              <p className="text-sm font-medium">Drop files here to upload</p>
            </div>
          </div>
        )}

        {subFolders.length === 0 && visibleFiles.length === 0 && !searchQuery ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center border rounded-lg border-dashed cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => canEdit && fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <h3 className="text-base font-medium mb-1">No files yet</h3>
            <p className="text-sm text-muted-foreground">
              {canEdit ? 'Drag and drop files here or click to upload.' : 'No files have been uploaded yet.'}
            </p>
          </div>
        ) : viewMode === 'list' ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Size</TableHead>
                    <TableHead className="hidden md:table-cell">Uploaded By</TableHead>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subFolders.map(folder => (
                    <TableRow
                      key={folder}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setCurrentFolder(currentFolder === '/' ? `/${folder}` : `${currentFolder}/${folder}`)
                        setSearchQuery('')
                      }}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Folder className="h-5 w-5 text-amber-500 shrink-0" />
                          <span className="font-medium">{folder}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">--</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">--</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">--</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                  {visibleFiles.map(file => {
                    const FileIcon = getFileIcon(file.mime_type)
                    const uploaderName = file.uploader?.profiles?.name ?? file.uploader?.email ?? 'Unknown'

                    return (
                      <TableRow key={file.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate max-w-[200px] sm:max-w-none">{file.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {formatFileSize(file.file_size)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {uploaderName}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          {new Date(file.created_at).toISOString().split('T')[0]}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-3.5 w-3.5 mr-2" /> Download
                                </a>
                              </DropdownMenuItem>
                              {canEdit && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDeleteFile(file.id)} className="text-red-600">
                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {subFolders.map(folder => (
              <button
                key={folder}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-center"
                onClick={() => {
                  setCurrentFolder(currentFolder === '/' ? `/${folder}` : `${currentFolder}/${folder}`)
                  setSearchQuery('')
                }}
              >
                <Folder className="h-10 w-10 text-amber-500" />
                <span className="text-sm font-medium truncate w-full">{folder}</span>
              </button>
            ))}
            {visibleFiles.map(file => {
              const FileIcon = getFileIcon(file.mime_type)
              return (
                <div key={file.id} className="group relative flex flex-col items-center gap-2 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-center">
                  <FileIcon className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm font-medium truncate w-full">{file.name}</span>
                  <span className="text-xs text-muted-foreground">{formatFileSize(file.file_size)}</span>
                  {canEdit && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <a href={file.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5 mr-2" /> Download
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteFile(file.id)} className="text-red-600">
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreatingFolder} onOpenChange={setIsCreatingFolder}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>Create a new folder in {currentFolder === '/' ? 'the root directory' : currentFolder}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Folder Name</Label>
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Enter folder name..."
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreatingFolder(false)}>Cancel</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

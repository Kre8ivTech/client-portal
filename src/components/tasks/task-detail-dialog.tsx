'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Loader2, MessageSquare, Paperclip, Info } from 'lucide-react'
import { TaskComments } from './task-comments'
import { TaskFiles } from './task-files'

interface TaskDetailDialogProps {
  taskId: string
  taskTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  canEdit: boolean
}

type TaskComment = {
  id: string
  task_id: string
  content: string
  is_internal: boolean
  parent_comment_id: string | null
  created_at: string
  updated_at: string
  created_by: {
    id: string
    name: string | null
    avatar_url: string | null
  }
}

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

export function TaskDetailDialog({
  taskId,
  taskTitle,
  open,
  onOpenChange,
  currentUserId,
  canEdit,
}: TaskDetailDialogProps) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [files, setFiles] = useState<TaskFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open && taskId) {
      loadTaskData()
    }
  }, [open, taskId])

  async function loadTaskData() {
    setIsLoading(true)
    try {
      // Load comments via API
      const commentsResponse = await fetch(`/api/tasks/${taskId}/comments`)
      if (commentsResponse.ok) {
        const commentsData = await commentsResponse.json()
        setComments(commentsData.data || [])
      }

      // Load files via API
      const filesResponse = await fetch(`/api/tasks/${taskId}/files`)
      if (filesResponse.ok) {
        const filesData = await filesResponse.json()
        setFiles(filesData.data || [])
      }
    } catch (error) {
      console.error('Failed to load task data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{taskTitle}</DialogTitle>
          <DialogDescription>Task details, comments, and files</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <Tabs defaultValue="comments" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="comments" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments
                {comments.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {comments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-2">
                <Paperclip className="h-4 w-4" />
                Files
                {files.length > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {files.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="comments" className="mt-6">
              <TaskComments
                taskId={taskId}
                comments={comments}
                currentUserId={currentUserId}
                canEdit={canEdit}
              />
            </TabsContent>

            <TabsContent value="files" className="mt-6">
              <TaskFiles
                taskId={taskId}
                files={files}
                currentUserId={currentUserId}
                canEdit={canEdit}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

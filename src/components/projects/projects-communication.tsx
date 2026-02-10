'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
  MessageSquare,
  Send,
  Filter,
  Search,
  Pin,
  FolderKanban,
  Users,
  Loader2,
  Calendar,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

type Project = {
  id: string
  project_number: string
  name: string
  status: string
  organization_id: string
}

type Comment = {
  id: string
  project_id: string
  content: string
  content_html: string | null
  parent_comment_id: string | null
  is_pinned: boolean
  created_at: string
  updated_at: string
  created_by: string
  author: {
    id: string
    email: string
    profiles: {
      name: string | null
      avatar_url: string | null
    } | null
  }
  project: {
    id: string
    project_number: string
    name: string
    status: string
  }
}

type ProjectMember = {
  project_id: string
  user_id: string
  is_active: boolean
  user: {
    id: string
    email: string
    role: string
    profiles: {
      name: string | null
      avatar_url: string | null
    } | null
  }
}

interface ProjectsCommunicationProps {
  projects: Project[]
  comments: Comment[]
  allMembers: ProjectMember[]
  currentUser: {
    id: string
    email: string
    role: string
    name: string | null
    avatar_url: string | null
  }
}

export function ProjectsCommunication({
  projects: initialProjects,
  comments: initialComments,
  allMembers,
  currentUser,
}: ProjectsCommunicationProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false)
  const [newMessage, setNewMessage] = useState({
    project_id: '',
    content: '',
    message_type: 'all', // 'all' or 'selected'
    recipients: [] as string[],
  })

  // AJAX data fetching
  const { data: comments, isLoading } = useQuery({
    queryKey: ['project_comments', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_comments')
        .select(
          `
          id,
          project_id,
          content,
          content_html,
          parent_comment_id,
          is_pinned,
          created_at,
          updated_at,
          created_by,
          author:users!created_by (
            id,
            email,
            profiles:profiles!user_id (
              name,
              avatar_url
            )
          ),
          project:projects!inner (
            id,
            project_number,
            name,
            status
          )
        `
        )
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data as Comment[]
    },
    initialData: initialComments,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  })

  // Get members for selected project
  const selectedProjectMembers = useMemo(() => {
    if (!newMessage.project_id || newMessage.project_id === 'all') return []

    return allMembers
      .filter((m) => m.project_id === newMessage.project_id)
      .map((m) => m.user)
  }, [newMessage.project_id, allMembers])

  // Filter comments
  const filteredComments = useMemo(() => {
    if (!comments) return []

    let filtered = comments

    // Project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter((c) => c.project_id === projectFilter)
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.content.toLowerCase().includes(query) ||
          c.project.name.toLowerCase().includes(query) ||
          c.author.email.toLowerCase().includes(query) ||
          c.author.profiles?.name?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [comments, projectFilter, searchQuery])

  // Create message mutation
  const createMessageMutation = useMutation({
    mutationFn: async (data: {
      project_id: string
      content: string
      created_by: string
    }) => {
      const { data: newComment, error } = await supabase
        .from('project_comments')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return newComment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project_comments'] })
      setIsNewMessageOpen(false)
      setNewMessage({
        project_id: '',
        content: '',
        message_type: 'all',
        recipients: [],
      })
      router.refresh()
    },
  })

  const handleSendMessage = async () => {
    if (!newMessage.content.trim() || !newMessage.project_id) return

    createMessageMutation.mutate({
      project_id: newMessage.project_id,
      content: newMessage.content.trim(),
      created_by: currentUser.id,
    })
  }

  const handleToggleRecipient = (userId: string) => {
    setNewMessage((prev) => {
      const isSelected = prev.recipients.includes(userId)
      return {
        ...prev,
        recipients: isSelected
          ? prev.recipients.filter((id) => id !== userId)
          : [...prev.recipients, userId],
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Message Board</CardTitle>
            <Dialog open={isNewMessageOpen} onOpenChange={setIsNewMessageOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  New Message
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Post Message</DialogTitle>
                  <DialogDescription>
                    Post a message to a project. All project members will see
                    your message.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Project</label>
                    <Select
                      value={newMessage.project_id}
                      onValueChange={(value) =>
                        setNewMessage((prev) => ({
                          ...prev,
                          project_id: value,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a project" />
                      </SelectTrigger>
                      <SelectContent>
                        {initialProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name} ({project.project_number})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Message</label>
                    <Textarea
                      value={newMessage.content}
                      onChange={(e) =>
                        setNewMessage((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                      placeholder="Write your message..."
                      className="min-h-[120px]"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Visibility
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="message-all"
                          checked={newMessage.message_type === 'all'}
                          onCheckedChange={(checked) =>
                            setNewMessage((prev) => ({
                              ...prev,
                              message_type: checked ? 'all' : 'selected',
                              recipients:
                                checked ? [] : prev.recipients,
                            }))
                          }
                        />
                        <label
                          htmlFor="message-all"
                          className="text-sm cursor-pointer"
                        >
                          Message all project members
                        </label>
                      </div>

                      {newMessage.message_type === 'selected' &&
                        selectedProjectMembers.length > 0 && (
                          <div className="mt-3 p-3 border rounded-lg">
                            <p className="text-sm font-medium mb-2">
                              Select Recipients:
                            </p>
                            <div className="space-y-2">
                              {selectedProjectMembers.map((member) => (
                                <div
                                  key={member.id}
                                  className="flex items-center gap-2"
                                >
                                  <Checkbox
                                    id={`member-${member.id}`}
                                    checked={newMessage.recipients.includes(
                                      member.id
                                    )}
                                    onCheckedChange={() =>
                                      handleToggleRecipient(member.id)
                                    }
                                  />
                                  <label
                                    htmlFor={`member-${member.id}`}
                                    className="text-sm cursor-pointer flex items-center gap-2"
                                  >
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage
                                        src={member.profiles?.avatar_url || ''}
                                      />
                                      <AvatarFallback className="text-xs">
                                        {member.profiles?.name?.[0]?.toUpperCase() ||
                                          member.email[0].toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>
                                      {member.profiles?.name || member.email}
                                    </span>
                                  </label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsNewMessageOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendMessage}
                    disabled={
                      !newMessage.content.trim() ||
                      !newMessage.project_id ||
                      createMessageMutation.isPending
                    }
                  >
                    {createMessageMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    <Send className="mr-2 h-4 w-4" />
                    Post Message
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {initialProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredComments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || projectFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Start a conversation by posting a message'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredComments.map((comment) => {
                const authorName =
                  comment.author.profiles?.name || comment.author.email

                return (
                  <div
                    key={comment.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage
                          src={comment.author.profiles?.avatar_url || ''}
                        />
                        <AvatarFallback>
                          {authorName[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{authorName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(
                              new Date(comment.created_at),
                              {
                                addSuffix: true,
                              }
                            )}
                          </span>
                          {comment.is_pinned && (
                            <Pin className="h-3 w-3 text-primary" />
                          )}
                        </div>

                        <Link
                          href={`/dashboard/projects/${comment.project.id}`}
                          className="inline-flex items-center gap-2 text-xs text-primary hover:underline mb-2"
                        >
                          <FolderKanban className="h-3 w-3" />
                          {comment.project.name}
                        </Link>

                        <div className="text-sm whitespace-pre-wrap">
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Results count */}
          {!isLoading && filteredComments.length > 0 && (
            <div className="mt-6 text-sm text-muted-foreground text-center">
              Showing {filteredComments.length} of {comments?.length || 0}{' '}
              messages
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

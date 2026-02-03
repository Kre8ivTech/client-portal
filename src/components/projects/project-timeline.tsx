'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Flag,
  Plus,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  ChevronRight,
} from 'lucide-react'
import {
  createMilestoneSchema,
  CreateMilestoneInput,
  updateMilestoneSchema,
  UpdateMilestoneInput,
  MILESTONE_STATUS_OPTIONS,
} from '@/lib/validators/project'
import { cn } from '@/lib/utils'

type Milestone = {
  id: string
  name: string
  description: string | null
  due_date: string | null
  completed_date: string | null
  status: string
  sort_order: number
  tasks?: { count: number }[]
  creator?: {
    id: string
    email: string
    profiles: { name: string | null } | null
  }
}

interface ProjectTimelineProps {
  projectId: string
  canEdit: boolean
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    case 'in_progress':
      return <Clock className="h-5 w-5 text-blue-500" />
    case 'missed':
      return <AlertCircle className="h-5 w-5 text-red-500" />
    default:
      return <Circle className="h-5 w-5 text-slate-300" />
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge className="bg-green-100 text-green-700">Completed</Badge>
    case 'in_progress':
      return <Badge className="bg-blue-100 text-blue-700">In Progress</Badge>
    case 'missed':
      return <Badge className="bg-red-100 text-red-700">Missed</Badge>
    default:
      return <Badge variant="outline">Pending</Badge>
  }
}

export function ProjectTimeline({ projectId, canEdit }: ProjectTimelineProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null)
  const router = useRouter()

  const createForm = useForm<CreateMilestoneInput>({
    resolver: zodResolver(createMilestoneSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'pending',
    },
  })

  const editForm = useForm<UpdateMilestoneInput>({
    resolver: zodResolver(updateMilestoneSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'pending',
    },
  })

  useEffect(() => {
    fetchMilestones()
  }, [projectId])

  useEffect(() => {
    if (editingMilestone) {
      editForm.reset({
        name: editingMilestone.name,
        description: editingMilestone.description ?? '',
        due_date: editingMilestone.due_date ?? '',
        status: editingMilestone.status as UpdateMilestoneInput['status'],
      })
    }
  }, [editingMilestone])

  async function fetchMilestones() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones`)
      if (!response.ok) throw new Error('Failed to fetch milestones')
      const { data } = await response.json()
      setMilestones(data ?? [])
    } catch (error) {
      console.error('Failed to fetch milestones:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function onCreateSubmit(data: CreateMilestoneInput) {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to create milestone')

      createForm.reset()
      setIsCreateOpen(false)
      fetchMilestones()
    } catch (error) {
      console.error('Failed to create milestone:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onEditSubmit(data: UpdateMilestoneInput) {
    if (!editingMilestone) return
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones/${editingMilestone.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to update milestone')

      setEditingMilestone(null)
      fetchMilestones()
    } catch (error) {
      console.error('Failed to update milestone:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(milestoneId: string) {
    if (!confirm('Are you sure you want to delete this milestone?')) return

    try {
      const response = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete milestone')

      fetchMilestones()
    } catch (error) {
      console.error('Failed to delete milestone:', error)
    }
  }

  async function handleStatusChange(milestoneId: string, newStatus: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones/${milestoneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) throw new Error('Failed to update status')

      fetchMilestones()
    } catch (error) {
      console.error('Failed to update status:', error)
    }
  }

  // Calculate progress
  const completedCount = milestones.filter((m) => m.status === 'completed').length
  const progressPercent = milestones.length > 0 ? (completedCount / milestones.length) * 100 : 0

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" />
              Project Timeline
            </CardTitle>
            <CardDescription>
              Track milestones and project progress
            </CardDescription>
          </div>
          {canEdit && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Milestone
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Milestone</DialogTitle>
                  <DialogDescription>
                    Add a new milestone to track project progress.
                  </DialogDescription>
                </DialogHeader>

                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Milestone name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe this milestone..."
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="due_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              {...field}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        {milestones.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-500">Overall Progress</span>
              <span className="font-medium">{completedCount} of {milestones.length} completed</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {/* Milestones timeline */}
        {milestones.length === 0 ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <Flag className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No milestones yet</h3>
            <p className="text-slate-500 text-sm">
              {canEdit
                ? 'Add milestones to track project progress.'
                : 'No milestones have been created yet.'}
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[10px] top-0 bottom-0 w-0.5 bg-slate-200" />

            <div className="space-y-6">
              {milestones.map((milestone, index) => {
                const isOverdue =
                  milestone.due_date &&
                  new Date(milestone.due_date) < new Date() &&
                  milestone.status !== 'completed'

                return (
                  <div key={milestone.id} className="relative pl-8">
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-0">
                      {getStatusIcon(milestone.status)}
                    </div>

                    <div
                      className={cn(
                        'p-4 rounded-lg border bg-white',
                        isOverdue && 'border-red-200 bg-red-50/50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{milestone.name}</h4>
                            {getStatusBadge(milestone.status)}
                          </div>
                          {milestone.description && (
                            <p className="text-sm text-slate-600 mb-2">{milestone.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            {milestone.due_date && (
                              <div className={cn('flex items-center gap-1', isOverdue && 'text-red-500')}>
                                <Calendar className="h-3 w-3" />
                                <span>
                                  Due: {new Date(milestone.due_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {milestone.completed_date && (
                              <div className="flex items-center gap-1 text-green-600">
                                <CheckCircle2 className="h-3 w-3" />
                                <span>
                                  Completed: {new Date(milestone.completed_date).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {milestone.tasks && milestone.tasks[0]?.count > 0 && (
                              <div className="flex items-center gap-1">
                                <span>{milestone.tasks[0].count} tasks</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <Select
                              value={milestone.status}
                              onValueChange={(value) => handleStatusChange(milestone.id, value)}
                            >
                              <SelectTrigger className="w-32 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MILESTONE_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingMilestone(milestone)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500"
                              onClick={() => handleDelete(milestone.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Edit milestone dialog */}
      <Dialog open={!!editingMilestone} onOpenChange={(open) => !open && setEditingMilestone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
            <DialogDescription>
              Update milestone details.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Milestone name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe this milestone..."
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MILESTONE_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMilestone(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

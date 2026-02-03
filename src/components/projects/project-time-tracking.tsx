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
  FormDescription,
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
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Clock,
  Plus,
  DollarSign,
  Calendar,
  Loader2,
  Trash2,
  Edit,
  FileSpreadsheet,
} from 'lucide-react'
import {
  createTimeEntrySchema,
  CreateTimeEntryInput,
  updateTimeEntrySchema,
  UpdateTimeEntryInput,
} from '@/lib/validators/project'
import { cn } from '@/lib/utils'

type Task = {
  id: string
  title: string
  task_number: number
}

type TimeEntry = {
  id: string
  hours: number
  entry_date: string
  description: string | null
  billable: boolean
  billed: boolean
  hourly_rate: number | null
  user: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  }
  task: Task | null
}

type Summary = {
  totalHours: number
  billableHours: number
  billedHours: number
  unbilledHours: number
}

interface ProjectTimeTrackingProps {
  projectId: string
  tasks: Task[]
  canEdit: boolean
  canLogTime: boolean
  defaultHourlyRate?: number | null
}

export function ProjectTimeTracking({
  projectId,
  tasks,
  canEdit,
  canLogTime,
  defaultHourlyRate,
}: ProjectTimeTrackingProps) {
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalHours: 0,
    billableHours: 0,
    billedHours: 0,
    unbilledHours: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const router = useRouter()

  const createForm = useForm<CreateTimeEntryInput>({
    resolver: zodResolver(createTimeEntrySchema),
    defaultValues: {
      entry_date: new Date().toISOString().split('T')[0],
      hours: 1,
      billable: true,
    },
  })

  const editForm = useForm<UpdateTimeEntryInput>({
    resolver: zodResolver(updateTimeEntrySchema),
    defaultValues: {
      hours: 1,
      billable: true,
    },
  })

  useEffect(() => {
    fetchTimeEntries()
  }, [projectId])

  useEffect(() => {
    if (editingEntry) {
      editForm.reset({
        task_id: editingEntry.task?.id ?? null,
        description: editingEntry.description ?? '',
        hours: editingEntry.hours,
        entry_date: editingEntry.entry_date,
        billable: editingEntry.billable,
        hourly_rate: editingEntry.hourly_rate ?? null,
      })
    }
  }, [editingEntry])

  async function fetchTimeEntries() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/time-entries`)
      if (!response.ok) throw new Error('Failed to fetch time entries')
      const { data, summary: sum } = await response.json()
      setEntries(data ?? [])
      setSummary(sum)
    } catch (error) {
      console.error('Failed to fetch time entries:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function onCreateSubmit(data: CreateTimeEntryInput) {
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to log time')

      createForm.reset({
        entry_date: new Date().toISOString().split('T')[0],
        hours: 1,
        billable: true,
        task_id: null,
        description: '',
      })
      setIsCreateOpen(false)
      fetchTimeEntries()
    } catch (error) {
      console.error('Failed to log time:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function onEditSubmit(data: UpdateTimeEntryInput) {
    if (!editingEntry) return
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/time-entries/${editingEntry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to update time entry')

      setEditingEntry(null)
      fetchTimeEntries()
    } catch (error) {
      console.error('Failed to update time entry:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleDelete(entryId: string) {
    if (!confirm('Are you sure you want to delete this time entry?')) return

    try {
      const response = await fetch(`/api/projects/${projectId}/time-entries/${entryId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete time entry')

      fetchTimeEntries()
    } catch (error) {
      console.error('Failed to delete time entry:', error)
    }
  }

  // Calculate potential billing
  const unbilledAmount = entries
    .filter((e) => e.billable && !e.billed && e.hourly_rate)
    .reduce((sum, e) => sum + e.hours * (e.hourly_rate! / 100), 0)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
            <Skeleton className="h-64" />
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
              <Clock className="h-5 w-5 text-primary" />
              Time Tracking
            </CardTitle>
            <CardDescription>
              Log and track time spent on project tasks
            </CardDescription>
          </div>
          {canLogTime && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Log Time
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Log Time</DialogTitle>
                  <DialogDescription>
                    Record time spent working on this project.
                  </DialogDescription>
                </DialogHeader>

                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="task_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Task (optional)</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value ?? undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a task" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {tasks.map((task) => (
                                <SelectItem key={task.id} value={task.id}>
                                  #{task.task_number} - {task.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={createForm.control}
                        name="hours"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hours *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.25"
                                min="0.01"
                                max="24"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={createForm.control}
                        name="entry_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date *</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={createForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="What did you work on?"
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
                      name="billable"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Billable</FormLabel>
                            <FormDescription>
                              This time will be included in invoicing.
                            </FormDescription>
                          </div>
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
                        Log Time
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
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
              <Clock className="h-4 w-4" />
              Total Hours
            </div>
            <p className="text-2xl font-bold">{summary.totalHours.toFixed(1)}h</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
              <DollarSign className="h-4 w-4" />
              Billable
            </div>
            <p className="text-2xl font-bold text-blue-700">{summary.billableHours.toFixed(1)}h</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
              <FileSpreadsheet className="h-4 w-4" />
              Billed
            </div>
            <p className="text-2xl font-bold text-green-700">{summary.billedHours.toFixed(1)}h</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
              <Clock className="h-4 w-4" />
              Unbilled
            </div>
            <p className="text-2xl font-bold text-orange-700">{summary.unbilledHours.toFixed(1)}h</p>
            {unbilledAmount > 0 && (
              <p className="text-sm text-orange-600">${unbilledAmount.toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Time entries table */}
        {entries.length === 0 ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <Clock className="h-10 w-10 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No time logged</h3>
            <p className="text-slate-500 text-sm">
              {canLogTime
                ? 'Start logging time to track project progress.'
                : 'No time has been logged on this project yet.'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead className="w-[80px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">
                      {new Date(entry.entry_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={entry.user.profiles?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {(entry.user.profiles?.name ?? entry.user.email).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">
                          {entry.user.profiles?.name ?? entry.user.email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.task ? (
                        <span className="text-sm">
                          <span className="font-mono text-slate-400">#{entry.task.task_number}</span>{' '}
                          {entry.task.title.length > 30
                            ? entry.task.title.slice(0, 30) + '...'
                            : entry.task.title}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">General</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {entry.description || '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {entry.hours}h
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {entry.billable ? (
                          entry.billed ? (
                            <Badge className="bg-green-100 text-green-700">Billed</Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-700">Billable</Badge>
                          )
                        ) : (
                          <Badge variant="outline">Non-billable</Badge>
                        )}
                      </div>
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingEntry(entry)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={() => handleDelete(entry.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Edit entry dialog */}
      <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
            <DialogDescription>
              Update time entry details.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="task_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a task" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            #{task.task_number} - {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.25"
                          min="0.01"
                          max="24"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="entry_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What did you work on?"
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
                name="billable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>Billable</FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingEntry(null)}
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

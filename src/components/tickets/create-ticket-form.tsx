'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  createTicketSchema, 
  type CreateTicketInput,
} from '@/lib/validators/ticket'
import { 
  Loader2, 
  AlertCircle,
  Paperclip,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TicketCategory } from '@/types/tickets'

// Form values type (what the form actually works with)
type FormValues = z.input<typeof createTicketSchema>

interface CreateTicketFormProps {
  categories?: TicketCategory[]
  onSubmit: (data: CreateTicketInput) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  className?: string
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low - General questions' },
  { value: 'medium', label: 'Medium - Standard support' },
  { value: 'high', label: 'High - Urgent issue' },
  { value: 'critical', label: 'Critical - System down' },
]

export function CreateTicketForm({
  categories = [],
  onSubmit,
  onCancel,
  isLoading = false,
  className,
}: CreateTicketFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      subject: '',
      description: '',
      priority: 'medium',
      category: '',
    },
  })

  const handleFormSubmit = async (data: FormValues) => {
    setSubmitError(null)
    try {
      // Parse and validate through Zod
      const validatedData = createTicketSchema.parse(data)
      await onSubmit(validatedData)
      reset()
    } catch (error) {
      setSubmitError(
        error instanceof Error 
          ? error.message 
          : 'An unexpected error occurred. Please try again.'
      )
    }
  }

  const categoryOptions = categories.length > 0
    ? categories.map(c => ({ value: c.slug, label: c.name }))
    : [
        { value: 'technical-support', label: 'Technical Support' },
        { value: 'billing', label: 'Billing' },
        { value: 'general-inquiry', label: 'General Inquiry' },
        { value: 'bug-report', label: 'Bug Report' },
        { value: 'feature-request', label: 'Feature Request' },
      ]

  return (
    <Card className={cn('w-full max-w-2xl', className)}>
      <CardHeader>
        <CardTitle>Create Support Ticket</CardTitle>
      </CardHeader>
      
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <CardContent className="space-y-6">
          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subject"
              placeholder="Brief summary of your issue"
              {...register('subject')}
              disabled={isSubmitting || isLoading}
              className={cn(errors.subject && 'border-red-500')}
            />
            {errors.subject && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.subject.message}
              </p>
            )}
          </div>

          {/* Category and Priority row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                options={categoryOptions}
                placeholder="Select a category"
                {...register('category')}
                disabled={isSubmitting || isLoading}
              />
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                id="priority"
                options={PRIORITY_OPTIONS}
                {...register('priority')}
                disabled={isSubmitting || isLoading}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce, and what you expected to happen."
              rows={6}
              {...register('description')}
              disabled={isSubmitting || isLoading}
              className={cn(errors.description && 'border-red-500')}
            />
            {errors.description && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle size={14} />
                {errors.description.message}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Minimum 10 characters. Be as detailed as possible.
            </p>
          </div>

          {/* File attachments placeholder */}
          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-slate-300 transition-colors cursor-pointer">
              <Paperclip className="h-8 w-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm text-slate-500">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Max 50MB per file. Images, PDFs, and documents supported.
              </p>
            </div>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">
                  Failed to create ticket
                </p>
                <p className="text-sm text-red-600 mt-1">{submitError}</p>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-end gap-3 border-t pt-6">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting || isLoading}
            >
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={isSubmitting || isLoading}
          >
            {(isSubmitting || isLoading) ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Ticket'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

// Inline version for modals/sheets
export function CreateTicketFormInline({
  categories = [],
  onSubmit,
  onCancel,
  isLoading = false,
}: Omit<CreateTicketFormProps, 'className'>) {
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      subject: '',
      description: '',
      priority: 'medium',
      category: '',
    },
  })

  const handleFormSubmit = async (data: FormValues) => {
    setSubmitError(null)
    try {
      const validatedData = createTicketSchema.parse(data)
      await onSubmit(validatedData)
      reset()
    } catch (error) {
      setSubmitError(
        error instanceof Error 
          ? error.message 
          : 'An unexpected error occurred. Please try again.'
      )
    }
  }

  const categoryOptions = categories.length > 0
    ? categories.map(c => ({ value: c.slug, label: c.name }))
    : [
        { value: 'technical-support', label: 'Technical Support' },
        { value: 'billing', label: 'Billing' },
        { value: 'general-inquiry', label: 'General Inquiry' },
        { value: 'bug-report', label: 'Bug Report' },
        { value: 'feature-request', label: 'Feature Request' },
      ]

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Subject */}
      <div className="space-y-2">
        <Label htmlFor="subject-inline">Subject</Label>
        <Input
          id="subject-inline"
          placeholder="Brief summary"
          {...register('subject')}
          disabled={isSubmitting || isLoading}
        />
        {errors.subject && (
          <p className="text-sm text-red-500">{errors.subject.message}</p>
        )}
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category-inline">Category</Label>
        <Select
          id="category-inline"
          options={categoryOptions}
          placeholder="Select category"
          {...register('category')}
          disabled={isSubmitting || isLoading}
        />
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor="priority-inline">Priority</Label>
        <Select
          id="priority-inline"
          options={PRIORITY_OPTIONS}
          {...register('priority')}
          disabled={isSubmitting || isLoading}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description-inline">Description</Label>
        <Textarea
          id="description-inline"
          placeholder="Describe your issue..."
          rows={4}
          {...register('description')}
          disabled={isSubmitting || isLoading}
        />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      {submitError && (
        <p className="text-sm text-red-500">{submitError}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting || isLoading}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

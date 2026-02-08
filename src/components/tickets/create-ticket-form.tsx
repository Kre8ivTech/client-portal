'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { createClient } from '@/lib/supabase/client'
import { createTicketSchema, TICKET_CATEGORIES } from '@/lib/validators/ticket'
import type { CreateTicketInput } from '@/lib/validators/ticket'
import { Button } from '@/components/ui/button'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2, AlertCircle, CheckCircle2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { TicketFileUpload, type UploadedFile } from './ticket-file-upload'

type FormValues = CreateTicketInput

interface CreateTicketFormProps {
  organizationId: string
  userId: string
}

export function CreateTicketForm({ organizationId, userId }: CreateTicketFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const supabase = createClient() as any

  const form = useForm<FormValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      subject: '',
      description: '',
      priority: 'medium',
      category: 'technical_support',
    },
  })

  const { isSubmitting } = form.formState

  const handleFilesChange = useCallback((files: UploadedFile[]) => {
    setUploadedFiles(files)
  }, [])

  async function onSubmit(values: FormValues) {
    setError(null)
    setIsSuccess(false)

    try {
      // Create the ticket
      const { data, error: submitError } = await supabase
        .from('tickets')
        .insert({
          organization_id: organizationId,
          created_by: userId,
          subject: values.subject,
          description: values.description,
          priority: values.priority,
          category: values.category,
          status: 'new',
          tags: [],
        })
        .select()
        .single()

      if (submitError) throw submitError

      // Link uploaded files to the ticket
      if (uploadedFiles.length > 0) {
        const attachments = uploadedFiles.map((f) => ({
          ticket_id: data.id,
          file_id: f.id,
        }))

        const { error: attachError } = await supabase
          .from('ticket_attachments')
          .insert(attachments)

        if (attachError) {
          // Ticket was created but attachments failed - log but don't block
          console.error('Failed to link attachments:', attachError)
        }
      }

      setIsSuccess(true)
      form.reset()

      // Navigate to the new ticket after a brief delay
      setTimeout(() => {
        router.push(`/dashboard/tickets/${data.id}`)
      }, 1500)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.')
    }
  }

  if (isSuccess) {
    return (
      <div className="space-y-6">
        <Alert className="bg-green-50 border-green-200 text-green-800 p-6 flex items-start gap-4">
          <CheckCircle2 className="h-6 w-6 text-green-500 mt-0.5" />
          <div className="space-y-1">
            <AlertTitle className="text-lg font-bold">Ticket Created Successfully!</AlertTitle>
            <AlertDescription>
              Your support request has been submitted{uploadedFiles.length > 0 ? ` with ${uploadedFiles.length} attachment${uploadedFiles.length !== 1 ? 's' : ''}` : ''}.
              We&apos;ll be in touch shortly. Redirecting you to the ticket details...
            </AlertDescription>
          </div>
        </Alert>
      </div>
    )
  }

  return (
    <div className="w-full space-y-8">
      <Link
        href="/dashboard/tickets"
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Support Tickets
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">New Support Ticket</h1>
        <p className="text-slate-500">Describe your issue or question and we&apos;ll help get it resolved.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-white p-8 border rounded-2xl shadow-sm">
          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold">Subject</FormLabel>
                <FormControl>
                  <Input placeholder="Brief title of the issue" className="h-12" {...field} />
                </FormControl>
                <FormDescription>A clear and concise summary of the problem.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-semibold">Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TICKET_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-700 font-semibold">Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Select priority level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low - General inquiry</SelectItem>
                      <SelectItem value="medium">Medium - Normal issue</SelectItem>
                      <SelectItem value="high">High - Urgent problem</SelectItem>
                      <SelectItem value="critical">Critical - System down</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold">Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Provide as much detail as possible..."
                    className="min-h-[150px] resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Include steps to reproduce, error messages, and what you have tried.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <TicketFileUpload
            onFilesChange={handleFilesChange}
            disabled={isSubmitting}
          />

          <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Ticket...
              </>
            ) : (
              'Submit Request'
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}

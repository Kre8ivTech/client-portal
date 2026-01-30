'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { AlertCircle, CheckCircle2, ChevronLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const formSchema = z.object({
  type: z.enum(['time_logged', 'invoice_amount', 'coverage', 'other']),
  subject: z.string().min(5, {
    message: 'Subject must be at least 5 characters.',
  }),
  description: z.string().min(20, {
    message: 'Please provide more detail about your dispute.',
  }),
})

export default function BillingDisputePage() {
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: 'time_logged',
      subject: '',
      description: '',
    },
  })

  useEffect(() => {
    let isActive = true

    async function loadProfile() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!isActive) return

      if (authError || !user) {
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!isActive) return

      if (profileError || !profile?.organization_id) {
        setError('Organization not found for your account.')
        setIsLoadingProfile(false)
        return
      }

      setUserId(user.id)
      setOrganizationId(profile.organization_id)
      setIsLoadingProfile(false)
    }

    loadProfile()

    return () => {
      isActive = false
    }
  }, [router, supabase])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setError(null)
    setIsSubmitting(true)

    if (!userId || !organizationId) {
      setError('Unable to submit dispute. Please refresh and try again.')
      setIsSubmitting(false)
      return
    }

    const description = `${values.subject}\n\n${values.description}`

    const { error: submitError } = await supabase
      .from('billing_disputes')
      .insert({
        organization_id: organizationId,
        submitted_by: userId,
        dispute_type: values.type,
        description,
      })

    if (submitError) {
      setError(submitError.message)
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    setIsSuccess(true)
  }

  if (isLoadingProfile) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex items-center justify-center text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading billing profile...
      </div>
    )
  }

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="space-y-2">
              <CardTitle className="text-xl font-bold text-green-800">Dispute Submitted</CardTitle>
              <CardDescription className="text-green-700">
                Your billing dispute has been received. Our team will review it and get back to you within 2-3 business days.
              </CardDescription>
            </div>
            <Button asChild className="mt-4">
              <Link href="/dashboard/billing">Back to Billing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link 
        href="/dashboard/billing" 
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-primary transition-colors mb-4 w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Billing
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Billing Dispute</h1>
        <p className="text-slate-500">Submit a dispute regarding hours logged, invoice amounts, or plan coverage.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to submit dispute</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-white p-8 border rounded-2xl shadow-sm">
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold">Dispute Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="time_logged">Time Logged (Hours)</SelectItem>
                    <SelectItem value="invoice_amount">Invoice Amount</SelectItem>
                    <SelectItem value="coverage">Plan Coverage</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold">Subject</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Discrepancy in Jan Support Hours" className="h-12" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-slate-700 font-semibold">Description</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Provide details about the discrepancy..." 
                    className="min-h-[150px] resize-none"
                    {...field} 
                  />
                </FormControl>
                <FormDescription>Please include specific dates, invoice numbers, or hours in question.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-amber-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              Submitting a dispute does not automatically pause your subscription. If you need to stop payment, please contact your account manager directly.
            </p>
          </div>

          <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting Dispute...
              </>
            ) : (
              'Submit Dispute'
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}

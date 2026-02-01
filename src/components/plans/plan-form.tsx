'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Plus, Loader2, DollarSign, Clock, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

// Form schema - accepts dollars and converts to cents
const planFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(5000).optional(),
  billing_interval: z.enum(['monthly', 'yearly', 'one_time']),
  monthly_fee_dollars: z.coerce.number().min(0, 'Fee must be 0 or greater'),
  support_hours_included: z.coerce.number().int().min(0),
  dev_hours_included: z.coerce.number().int().min(0),
  support_hourly_rate_dollars: z.coerce.number().min(0),
  dev_hourly_rate_dollars: z.coerce.number().min(0),
  payment_terms_days: z.coerce.number().int().min(1).max(365),
  rush_support_included: z.boolean(),
  rush_support_fee_dollars: z.coerce.number().min(0),
  is_template: z.boolean(),
  features: z.array(z.string()),
  sync_to_stripe: z.boolean(),
})

type PlanFormValues = z.infer<typeof planFormSchema>

interface Plan {
  id: string
  name: string
  description: string | null
  billing_interval: 'monthly' | 'yearly' | 'one_time'
  monthly_fee: number
  support_hours_included: number
  dev_hours_included: number
  support_hourly_rate: number
  dev_hourly_rate: number
  payment_terms_days: number | null
  rush_support_included: boolean | null
  rush_support_fee: number | null
  is_template: boolean | null
  features: string[] | null
  stripe_product_id: string | null
  stripe_price_id: string | null
  is_active: boolean | null
}

interface PlanFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan?: Plan | null
  onSuccess: () => void
}

export function PlanForm({ open, onOpenChange, plan, onSuccess }: PlanFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [newFeature, setNewFeature] = useState('')

  const isEditing = !!plan

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    defaultValues: plan
      ? {
          name: plan.name,
          description: plan.description ?? '',
          billing_interval: plan.billing_interval,
          monthly_fee_dollars: plan.monthly_fee / 100,
          support_hours_included: plan.support_hours_included,
          dev_hours_included: plan.dev_hours_included,
          support_hourly_rate_dollars: plan.support_hourly_rate / 100,
          dev_hourly_rate_dollars: plan.dev_hourly_rate / 100,
          payment_terms_days: plan.payment_terms_days ?? 30,
          rush_support_included: plan.rush_support_included ?? false,
          rush_support_fee_dollars: (plan.rush_support_fee ?? 0) / 100,
          is_template: plan.is_template ?? true,
          features: plan.features ?? [],
          sync_to_stripe: true,
        }
      : {
          name: '',
          description: '',
          billing_interval: 'monthly',
          monthly_fee_dollars: 0,
          support_hours_included: 0,
          dev_hours_included: 0,
          support_hourly_rate_dollars: 125,
          dev_hourly_rate_dollars: 150,
          payment_terms_days: 30,
          rush_support_included: false,
          rush_support_fee_dollars: 0,
          is_template: true,
          features: [],
          sync_to_stripe: true,
        },
  })

  const features = form.watch('features')

  const addFeature = () => {
    if (newFeature.trim() && features.length < 20) {
      form.setValue('features', [...features, newFeature.trim()])
      setNewFeature('')
    }
  }

  const removeFeature = (index: number) => {
    form.setValue(
      'features',
      features.filter((_, i) => i !== index)
    )
  }

  const onSubmit = async (values: PlanFormValues) => {
    setIsLoading(true)
    try {
      // Convert dollars to cents for API
      const apiData = {
        name: values.name,
        description: values.description,
        billing_interval: values.billing_interval,
        monthly_fee: Math.round(values.monthly_fee_dollars * 100),
        support_hours_included: values.support_hours_included,
        dev_hours_included: values.dev_hours_included,
        support_hourly_rate: Math.round(values.support_hourly_rate_dollars * 100),
        dev_hourly_rate: Math.round(values.dev_hourly_rate_dollars * 100),
        payment_terms_days: values.payment_terms_days,
        rush_support_included: values.rush_support_included,
        rush_support_fee: Math.round(values.rush_support_fee_dollars * 100),
        is_template: values.is_template,
        features: values.features,
        sync_to_stripe: values.sync_to_stripe,
      }

      const url = isEditing ? `/api/plans/${plan.id}` : '/api/plans'
      const method = isEditing ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save plan')
      }

      onSuccess()
      onOpenChange(false)
      form.reset()
    } catch (error) {
      console.error('Error saving plan:', error)
      alert(error instanceof Error ? error.message : 'Failed to save plan')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the plan details. Changes will be synced to Stripe if connected.'
              : 'Create a new plan template. This will create a corresponding Product and Price in Stripe.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Basic Information
              </h3>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Basic Support, Pro Dev Package" {...field} />
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
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what this plan includes..."
                        className="resize-none"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Pricing
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="billing_interval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Billing Interval</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select interval" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                          <SelectItem value="one_time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monthly_fee_dollars"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Plan Fee ($)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="payment_terms_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms (days)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" max="365" {...field} />
                    </FormControl>
                    <FormDescription>Number of days client has to pay invoice</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Hours Included */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Hours Included
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="support_hours_included"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Support Hours</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dev_hours_included"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dev Hours</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="support_hourly_rate_dollars"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Support Overage Rate ($/hr)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dev_hourly_rate_dollars"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dev Overage Rate ($/hr)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Rush Support */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Rush Support
              </h3>

              <FormField
                control={form.control}
                name="rush_support_included"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Rush Support Included</FormLabel>
                      <FormDescription>
                        Allow clients to request priority handling at no extra cost
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {!form.watch('rush_support_included') && (
                <FormField
                  control={form.control}
                  name="rush_support_fee_dollars"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rush Support Fee ($)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" {...field} />
                      </FormControl>
                      <FormDescription>One-time fee for rush requests</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Features */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Features
              </h3>

              <div className="flex gap-2">
                <Input
                  placeholder="Add a feature..."
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addFeature()
                    }
                  }}
                />
                <Button type="button" variant="outline" size="icon" onClick={addFeature}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {features.map((feature, index) => (
                  <Badge key={index} variant="secondary" className="pl-2 pr-1 py-1 gap-1">
                    {feature}
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="ml-1 rounded-full hover:bg-slate-300 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                Settings
              </h3>

              <FormField
                control={form.control}
                name="is_template"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Reusable Template</FormLabel>
                      <FormDescription>
                        Allow this plan to be assigned to multiple clients
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sync_to_stripe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Sync to Stripe</FormLabel>
                      <FormDescription>
                        Create or update the corresponding Stripe Product and Price
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isEditing ? 'Update Plan' : 'Create Plan'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

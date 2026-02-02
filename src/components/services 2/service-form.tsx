'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { serviceSchema, type ServiceInput } from '@/lib/validators/service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface ServiceFormProps {
  initialData?: Partial<ServiceInput> & { id?: string }
}

export function ServiceForm({ initialData }: ServiceFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: initialData || {
      requires_approval: true,
      is_active: true,
      display_order: 0,
      rate_type: 'fixed',
    },
  })

  const rateType = watch('rate_type')
  const isActive = watch('is_active')
  const requiresApproval = watch('requires_approval')

  const onSubmit = async (data: ServiceInput) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = initialData?.id
        ? `/api/admin/services/${initialData.id}`
        : '/api/admin/services'

      const method = initialData?.id ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to save service')
      }

      router.push('/dashboard/admin/services')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Essential details about the service</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Service Name *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g., Custom WordPress Plugin Development"
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Describe what this service includes..."
              rows={4}
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="category">Category *</Label>
            <Select
              defaultValue={initialData?.category}
              onValueChange={(value) => setValue('category', value as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom_code">Custom Code</SelectItem>
                <SelectItem value="custom_software">Custom Software</SelectItem>
                <SelectItem value="custom_plugin">Custom Plugin</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="consulting">Consulting</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-red-600 mt-1">{errors.category.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Configure service pricing and rates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="rate_type">Rate Type *</Label>
            <Select
              defaultValue={initialData?.rate_type || 'fixed'}
              onValueChange={(value) => setValue('rate_type', value as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="fixed">Fixed Price</SelectItem>
                <SelectItem value="tiered">Tiered Pricing</SelectItem>
                <SelectItem value="custom">Custom Quote</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="base_rate">Base Rate (USD) *</Label>
            <Input
              id="base_rate"
              type="number"
              step="0.01"
              {...register('base_rate', { valueAsNumber: true })}
              placeholder="e.g., 150.00"
            />
            <p className="text-xs text-slate-500 mt-1">
              Enter the amount in dollars (e.g., 150.00)
            </p>
            {errors.base_rate && (
              <p className="text-sm text-red-600 mt-1">{errors.base_rate.message}</p>
            )}
          </div>

          {(rateType === 'fixed' || rateType === 'hourly') && (
            <div>
              <Label htmlFor="estimated_hours">Estimated Hours</Label>
              <Input
                id="estimated_hours"
                type="number"
                step="0.5"
                {...register('estimated_hours', { valueAsNumber: true })}
                placeholder="e.g., 20"
              />
              <p className="text-xs text-slate-500 mt-1">
                {rateType === 'fixed'
                  ? 'How many hours this service typically takes'
                  : 'Estimated hours for client planning'}
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="display_order">Display Order</Label>
            <Input
              id="display_order"
              type="number"
              {...register('display_order', { valueAsNumber: true })}
              placeholder="0"
            />
            <p className="text-xs text-slate-500 mt-1">
              Lower numbers appear first (0 = top)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>Service configuration options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Requires Approval</Label>
              <p className="text-sm text-slate-500">
                Service requests must be approved by admin
              </p>
            </div>
            <Switch
              checked={requiresApproval}
              onCheckedChange={(checked) => setValue('requires_approval', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Active</Label>
              <p className="text-sm text-slate-500">
                Service is visible to clients
              </p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue('is_active', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {initialData?.id ? 'Update Service' : 'Create Service'}
        </Button>
      </div>
    </form>
  )
}

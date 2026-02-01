'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { serviceRequestSchema, type ServiceRequestInput } from '@/lib/validators/service'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, DollarSign, Clock, CheckCircle2 } from 'lucide-react'
import type { Database } from '@/types/database'

type Service = Database['public']['Tables']['services']['Row']

interface ServiceRequestFormProps {
  services: Service[]
}

export function ServiceRequestForm({ services }: ServiceRequestFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)

  const selectedService = services.find((s) => s.id === selectedServiceId)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ServiceRequestInput>({
    resolver: zodResolver(serviceRequestSchema) as any,
    defaultValues: {
      priority: 'medium',
    },
  })

  const priority = watch('priority')

  const onSubmit = async (data: ServiceRequestInput) => {
    if (!selectedServiceId) {
      setError('Please select a service')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          service_id: selectedServiceId,
        }),
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to submit service request')
      }

      router.push('/dashboard/service')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatRate = (rate: number | null, rateType: string | null) => {
    if (!rate) return 'Contact for quote'
    const formatted = `$${(rate / 100).toFixed(2)}`
    if (!rateType) return formatted
    const labels: Record<string, string> = {
      hourly: 'per hour',
      fixed: 'fixed price',
      tiered: 'tiered pricing',
      custom: 'custom quote',
    }
    return `${formatted} ${labels[rateType] || ''}`
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      custom_code: 'bg-blue-100 text-blue-700 border-blue-200',
      custom_software: 'bg-purple-100 text-purple-700 border-purple-200',
      custom_plugin: 'bg-green-100 text-green-700 border-green-200',
      maintenance: 'bg-orange-100 text-orange-700 border-orange-200',
      support: 'bg-pink-100 text-pink-700 border-pink-200',
      consulting: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      other: 'bg-slate-100 text-slate-700 border-slate-200',
    }
    return colors[category] || colors.other
  }

  if (services.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No services are currently available.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please contact support for assistance.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Service Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select a Service</CardTitle>
          <CardDescription>Choose the service you need from our catalog</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {services.map((service) => (
              <Card
                key={service.id}
                className={`cursor-pointer transition-all ${
                  selectedServiceId === service.id
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:shadow-md'
                }`}
                onClick={() => setSelectedServiceId(service.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{service.name}</h3>
                      {service.category && (
                        <Badge
                          variant="outline"
                          className={`mt-1.5 text-xs ${getCategoryColor(service.category)}`}
                        >
                          {service.category.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                    {selectedServiceId === service.id && (
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-4">
                  {service.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {service.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {formatRate(service.base_rate, service.rate_type)}
                      </span>
                    </div>
                    {service.estimated_hours && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs">{service.estimated_hours}h</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Request Details */}
      {selectedService && (
        <Card>
          <CardHeader>
            <CardTitle>Request Details</CardTitle>
            <CardDescription>
              Provide additional information about your {selectedService.name} request
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="details">Additional Details</Label>
              <Textarea
                id="details"
                placeholder="Describe your specific requirements, goals, or any questions you have..."
                rows={6}
                onChange={(e) => {
                  try {
                    setValue('details', { notes: e.target.value })
                  } catch (err) {
                    // Handle parsing errors gracefully
                  }
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                The more details you provide, the better we can help you
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="requested_start_date">Preferred Start Date</Label>
                <Input
                  id="requested_start_date"
                  type="date"
                  {...register('requested_start_date')}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Optional - When would you like to begin?
                </p>
              </div>

              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  defaultValue="medium"
                  onValueChange={(value) => setValue('priority', value as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - No rush</SelectItem>
                    <SelectItem value="medium">Medium - Normal</SelectItem>
                    <SelectItem value="high">High - Important</SelectItem>
                    <SelectItem value="urgent">Urgent - ASAP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
        <Button type="submit" disabled={!selectedServiceId || isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Submit Request
        </Button>
      </div>
    </form>
  )
}

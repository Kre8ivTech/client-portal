'use client'

import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Calendar, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import type { Database } from '@/types/database'

type ServiceRequest = Database['public']['Tables']['service_requests']['Row'] & {
  service?: {
    id: string
    name: string
    base_rate: number | null
    rate_type: string
  } | null
}

interface ServiceRequestCardProps {
  request: ServiceRequest
}

export function ServiceRequestCard({ request }: ServiceRequestCardProps) {
  const getStatusColor = (status: string | null) => {
    if (!status) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      approved: 'bg-green-100 text-green-700 border-green-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
      converted: 'bg-blue-100 text-blue-700 border-blue-200',
      cancelled: 'bg-slate-100 text-slate-700 border-slate-200',
    }
    return colors[status] || colors.pending
  }

  const getPriorityColor = (priority: string | null) => {
    if (!priority) return 'text-muted-foreground'
    const colors: Record<string, string> = {
      low: 'text-slate-500',
      medium: 'text-blue-600',
      high: 'text-orange-600',
      urgent: 'text-red-600',
    }
    return colors[priority] || 'text-muted-foreground'
  }

  const formatRate = (rate: number | null, rateType: string) => {
    if (!rate) return 'Contact for quote'
    return `$${(rate / 100).toFixed(2)}`
  }

  const formatDate = (date: string | null) => {
    if (!date) return null
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Link href={`/dashboard/service/${request.id}`}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow active:bg-muted md:hover:bg-accent/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-base truncate">
                {request.service?.name || 'Service Request'}
              </h3>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge variant="outline" className={getStatusColor(request.status)}>
                  {request.status}
                </Badge>
                {request.priority && (
                  <div className={`flex items-center gap-1 text-xs ${getPriorityColor(request.priority)}`}>
                    <AlertCircle className="h-3 w-3" />
                    <span className="capitalize">{request.priority}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          {request.details && typeof request.details === 'object' && 'notes' in request.details && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {String(request.details.notes)}
            </p>
          )}
        </CardContent>

        <CardFooter className="border-t pt-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            {request.service?.base_rate && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {formatRate(request.service.base_rate, request.service.rate_type)}
                </span>
              </div>
            )}
            {request.requested_start_date && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">{formatDate(request.requested_start_date)}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDate(request.created_at)}
          </p>
        </CardFooter>
      </Card>
    </Link>
  )
}

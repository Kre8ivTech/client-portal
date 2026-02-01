'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MoreVertical, CheckCircle2, XCircle, DollarSign, Calendar, User, AlertCircle } from 'lucide-react'
import type { Database } from '@/types/database'

type ServiceRequest = Database['public']['Tables']['service_requests']['Row'] & {
  service?: {
    id: string
    name: string
    base_rate: number | null
    rate_type: string
  } | null
  requester?: {
    id: string
    email: string
    profiles: { name: string | null; avatar_url: string | null } | null
  } | null
}

interface ServiceRequestAdminCardProps {
  request: ServiceRequest
}

export function ServiceRequestAdminCard({ request }: ServiceRequestAdminCardProps) {
  const [showApprovalDialog, setShowApprovalDialog] = useState(false)
  const [approvalType, setApprovalType] = useState<'approve' | 'reject'>('approve')
  const [rejectionReason, setRejectionReason] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const queryClient = useQueryClient()

  const approvalMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/service-requests/${request.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: approvalType === 'approve' ? 'approved' : 'rejected',
          rejection_reason: approvalType === 'reject' ? rejectionReason : undefined,
          internal_notes: internalNotes || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process request')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-service-requests'] })
      setShowApprovalDialog(false)
      setRejectionReason('')
      setInternalNotes('')
    },
  })

  const handleApproval = (type: 'approve' | 'reject') => {
    setApprovalType(type)
    setShowApprovalDialog(true)
  }

  const getStatusColor = (status: string) => {
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

  const formatRate = (rate: number | null) => {
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
    <>
      <Card>
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

            {request.status === 'pending' && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleApproval('approve')}>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                    Approve
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleApproval('reject')}
                    className="text-red-600"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-4 space-y-3">
          {/* Requester Info */}
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {request.requester?.profiles?.name || request.requester?.email || 'Unknown'}
            </span>
          </div>

          {/* Request Details */}
          {request.details && typeof request.details === 'object' && 'notes' in request.details && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {String(request.details.notes)}
            </p>
          )}
        </CardContent>

        <CardFooter className="border-t pt-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            {request.service?.base_rate && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatRate(request.service.base_rate)}</span>
              </div>
            )}
            {request.requested_start_date && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">{formatDate(request.requested_start_date)}</span>
              </div>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalType === 'approve' ? 'Approve' : 'Reject'} Service Request
            </DialogTitle>
            <DialogDescription>
              {approvalType === 'approve'
                ? 'Approve this service request from '
                : 'Reject this service request from '}
              {request.requester?.profiles?.name || request.requester?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {approvalType === 'reject' && (
              <div>
                <Label htmlFor="rejection_reason">Rejection Reason *</Label>
                <Textarea
                  id="rejection_reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this request is being rejected..."
                  rows={4}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This will be visible to the client
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="internal_notes">Internal Notes (Optional)</Label>
              <Textarea
                id="internal_notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Add any internal notes..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">Staff-only notes</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowApprovalDialog(false)}
              disabled={approvalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => approvalMutation.mutate()}
              disabled={
                approvalMutation.isPending ||
                (approvalType === 'reject' && !rejectionReason.trim())
              }
              variant={approvalType === 'approve' ? 'default' : 'destructive'}
            >
              {approvalMutation.isPending
                ? 'Processing...'
                : approvalType === 'approve'
                  ? 'Approve Request'
                  : 'Reject Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

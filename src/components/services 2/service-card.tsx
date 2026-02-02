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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MoreVertical, Edit, Trash2, Power, PowerOff, DollarSign, Clock } from 'lucide-react'
import Link from 'next/link'
import type { Database } from '@/types/database'

type Service = Database['public']['Tables']['services']['Row']

interface ServiceCardProps {
  service: Service
}

export function ServiceCard({ service }: ServiceCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const queryClient = useQueryClient()

  // Toggle active status
  const toggleActive = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/services/${service.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !service.is_active }),
      })
      if (!response.ok) throw new Error('Failed to update service')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] })
    },
  })

  // Delete service
  const deleteService = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/admin/services/${service.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete service')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-services'] })
      setShowDeleteDialog(false)
    },
  })

  const formatRate = (rate: number | string | null) => {
    if (rate === null || rate === undefined) return 'Contact for quote'
    const numericRate = typeof rate === 'number' ? rate : Number.parseFloat(rate)
    if (!Number.isFinite(numericRate)) return 'Contact for quote'
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numericRate)
  }

  const getRateTypeLabel = (type: string | null) => {
    if (!type) return ''
    const labels: Record<string, string> = {
      hourly: 'per hour',
      fixed: 'fixed price',
      tiered: 'tiered pricing',
      custom: 'custom quote',
    }
    return labels[type] || type
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

  return (
    <>
      <Card className={!service.is_active ? 'opacity-60' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate">{service.name}</h3>
              {service.category && (
                <Badge
                  variant="outline"
                  className={`mt-2 text-xs ${getCategoryColor(service.category)}`}
                >
                  {service.category.replace('_', ' ')}
                </Badge>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href={`/dashboard/admin/services/${service.id}/edit`}>
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onClick={() => toggleActive.mutate()}>
                  {service.is_active ? (
                    <>
                      <PowerOff className="h-4 w-4 mr-2" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Power className="h-4 w-4 mr-2" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pb-4">
          <p className="text-sm text-slate-600 line-clamp-3">
            {service.description || 'No description provided'}
          </p>
        </CardContent>

        <CardFooter className="border-t pt-4 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-slate-400" />
              <span className="font-semibold">{formatRate(service.base_rate)}</span>
              <span className="text-slate-400 text-xs">
                {getRateTypeLabel(service.rate_type)}
              </span>
            </div>

            {service.estimated_hours && (
              <div className="flex items-center gap-1.5 text-slate-500">
                <Clock className="h-4 w-4" />
                <span className="text-xs">{service.estimated_hours}h</span>
              </div>
            )}
          </div>

          {!service.is_active && (
            <Badge variant="secondary" className="text-xs">
              Inactive
            </Badge>
          )}
        </CardFooter>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{service.name}"? This action cannot be undone.
              {service.requires_approval && ' Services with pending requests cannot be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteService.mutate()}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteService.isPending}
            >
              {deleteService.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Archive,
  Check,
  X,
  Clock,
  DollarSign,
  Zap,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PlanForm } from './plan-form'

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
  created_at: string
  updated_at: string
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

function getBillingLabel(interval: string): string {
  switch (interval) {
    case 'monthly':
      return '/mo'
    case 'yearly':
      return '/yr'
    case 'one_time':
      return 'one-time'
    default:
      return ''
  }
}

export function PlanList() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)

  const fetchPlans = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter === 'active') params.set('is_active', 'true')
      if (statusFilter === 'archived') params.set('is_active', 'false')

      const response = await fetch(`/api/plans?${params.toString()}`)
      if (!response.ok) throw new Error('Failed to fetch plans')

      const result = await response.json()
      setPlans(result.data || [])
    } catch (error) {
      console.error('Error fetching plans:', error)
    } finally {
      setIsLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan)
    setFormOpen(true)
  }

  const handleArchive = async (plan: Plan) => {
    if (!confirm(`Are you sure you want to archive "${plan.name}"?`)) return

    try {
      const response = await fetch(`/api/plans/${plan.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to archive plan')
      }
      fetchPlans()
    } catch (error) {
      console.error('Error archiving plan:', error)
      alert(error instanceof Error ? error.message : 'Failed to archive plan')
    }
  }

  const handleFormSuccess = () => {
    setEditingPlan(null)
    fetchPlans()
  }

  const handleFormClose = (open: boolean) => {
    setFormOpen(open)
    if (!open) setEditingPlan(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search plans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'archived')}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Plan
        </Button>
      </div>

      {/* Plans Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
        </div>
      ) : plans.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No plans found</h3>
            <p className="text-sm text-slate-500 mb-4">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first plan to get started'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Plan
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${!plan.is_active ? 'opacity-60 bg-slate-50' : ''}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">
                        {formatCurrency(plan.monthly_fee)}
                      </span>
                      <span className="text-sm text-slate-500">
                        {getBillingLabel(plan.billing_interval)}
                      </span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(plan)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {plan.stripe_product_id && (
                        <DropdownMenuItem asChild>
                          <a
                            href={`https://dashboard.stripe.com/products/${plan.stripe_product_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View in Stripe
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {plan.is_active && (
                        <DropdownMenuItem
                          onClick={() => handleArchive(plan)}
                          className="text-red-600"
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {plan.description && (
                  <CardDescription className="line-clamp-2">{plan.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Hours */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>
                      <strong>{plan.support_hours_included}</strong> support hrs
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>
                      <strong>{plan.dev_hours_included}</strong> dev hrs
                    </span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {plan.is_active ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      <Check className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-500">
                      <X className="w-3 h-3 mr-1" />
                      Archived
                    </Badge>
                  )}
                  {plan.rush_support_included && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      <Zap className="w-3 h-3 mr-1" />
                      Rush
                    </Badge>
                  )}
                  {plan.stripe_product_id && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                      Stripe Synced
                    </Badge>
                  )}
                  {plan.is_template && (
                    <Badge variant="outline" className="text-slate-500">
                      Template
                    </Badge>
                  )}
                </div>

                {/* Features preview */}
                {plan.features && plan.features.length > 0 && (
                  <div className="text-xs text-slate-500">
                    {plan.features.slice(0, 3).join(' - ')}
                    {plan.features.length > 3 && ` +${plan.features.length - 3} more`}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <PlanForm
        open={formOpen}
        onOpenChange={handleFormClose}
        plan={editingPlan}
        onSuccess={handleFormSuccess}
      />
    </div>
  )
}

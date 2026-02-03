'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Shield, AlertCircle, CheckCircle2, Clock, TrendingDown } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

interface SLAStats {
  total_tickets: number
  compliant: number
  at_risk: number
  breached: number
  compliance_percentage: number
  avg_response_time_hours: number
  avg_resolution_time_hours: number
}

interface SLAComplianceWidgetProps {
  stats: SLAStats
}

export function SLAComplianceWidget({ stats }: SLAComplianceWidgetProps) {
  const getComplianceColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getComplianceBgColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-50'
    if (percentage >= 75) return 'bg-yellow-50'
    return 'bg-red-50'
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Shield className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle className="text-lg">SLA Compliance</CardTitle>
              <CardDescription className="text-xs">Service level performance</CardDescription>
            </div>
          </div>
          <div className={cn('text-right', getComplianceBgColor(stats.compliance_percentage), 'rounded-lg px-3 py-2')}>
            <div className={cn('text-2xl font-bold', getComplianceColor(stats.compliance_percentage))}>
              {stats.compliance_percentage.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Overall</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Compliance Rate</span>
            <span className="font-medium">
              {stats.compliant} of {stats.total_tickets} tickets
            </span>
          </div>
          <Progress
            value={stats.compliance_percentage}
            className={cn('h-2', getProgressColor(stats.compliance_percentage))}
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-green-600" />
            <div className="text-xl font-bold text-green-600">{stats.compliant}</div>
            <div className="text-xs text-muted-foreground">Compliant</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <Clock className="h-4 w-4 mx-auto mb-1 text-amber-600" />
            <div className="text-xl font-bold text-amber-600">{stats.at_risk}</div>
            <div className="text-xs text-muted-foreground">At Risk</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <AlertCircle className="h-4 w-4 mx-auto mb-1 text-red-600" />
            <div className="text-xl font-bold text-red-600">{stats.breached}</div>
            <div className="text-xs text-muted-foreground">Breached</div>
          </div>
        </div>

        {/* Response Times */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-sm text-muted-foreground">Avg Response Time</span>
            </div>
            <span className="text-sm font-semibold">
              {stats.avg_response_time_hours.toFixed(1)}h
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-purple-500" />
              <span className="text-sm text-muted-foreground">Avg Resolution Time</span>
            </div>
            <span className="text-sm font-semibold">
              {stats.avg_resolution_time_hours.toFixed(1)}h
            </span>
          </div>
        </div>

        {/* Alerts */}
        {stats.breached > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <TrendingDown className="h-4 w-4 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">
                  {stats.breached} ticket{stats.breached !== 1 ? 's' : ''} breached SLA
                </p>
                <Link
                  href="/dashboard/tickets?sla=breached"
                  className="text-xs text-red-600 hover:underline"
                >
                  Review breached tickets →
                </Link>
              </div>
            </div>
          </div>
        )}

        {stats.at_risk > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">
                  {stats.at_risk} ticket{stats.at_risk !== 1 ? 's' : ''} at risk
                </p>
                <Link
                  href="/dashboard/tickets?sla=at-risk"
                  className="text-xs text-amber-600 hover:underline"
                >
                  Take action now →
                </Link>
              </div>
            </div>
          </div>
        )}

        <Link
          href="/dashboard/admin/settings/sla"
          className="block text-center text-sm text-primary hover:underline"
        >
          Configure SLA settings →
        </Link>
      </CardContent>
    </Card>
  )
}

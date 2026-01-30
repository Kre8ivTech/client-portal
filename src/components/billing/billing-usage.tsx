'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Clock, Code, TrendingUp, AlertCircle } from 'lucide-react'

interface BillingUsageProps {
  planAssignment: any
  planDetails: any
}

export function BillingUsage({ planAssignment, planDetails }: BillingUsageProps) {
  const supportUsed = planAssignment?.support_hours_used || 0
  const supportLimit = planDetails?.support_hours_included || 0
  const supportPercentage = Math.min((supportUsed / (supportLimit || 1)) * 100, 100)

  const devUsed = planAssignment?.dev_hours_used || 0
  const devLimit = planDetails?.dev_hours_included || 0
  const devPercentage = Math.min((devUsed / (devLimit || 1)) * 100, 100)

  const isOverSupport = supportUsed > supportLimit && supportLimit > 0
  const isOverDev = devUsed > devLimit && devLimit > 0

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Clock size={80} />
        </div>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="text-blue-500 w-5 h-5" />
                Support Pool
              </CardTitle>
              <CardDescription>Monthly support hours allocation</CardDescription>
            </div>
            {isOverSupport && (
              <Badge variant="destructive" className="animate-pulse">Over Limit</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-3xl font-extrabold text-slate-900">{supportUsed} / {supportLimit}</p>
              <p className="text-xs text-slate-500 font-medium">HOURS CONSUMED</p>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-lg font-bold",
                supportPercentage > 90 ? "text-red-500" : "text-slate-900"
              )}>
                {Math.round(supportPercentage)}%
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Progress value={supportPercentage} className={cn(
               "h-3",
               supportPercentage > 90 ? "bg-red-100" : "bg-blue-100"
            )} />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Start of Month</span>
              <span>100% Capacity</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-slate-400 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Additional support hours are billed at <span className="font-bold text-slate-900">${planDetails?.support_hourly_rate || 0}/hr</span>.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Code size={80} />
        </div>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Code className="text-indigo-500 w-5 h-5" />
                Development Pool
              </CardTitle>
              <CardDescription>Dedicated dev hours allocation</CardDescription>
            </div>
            {isOverDev && (
              <Badge variant="destructive" className="animate-pulse">Over Limit</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-3xl font-extrabold text-slate-900">{devUsed} / {devLimit}</p>
              <p className="text-xs text-slate-500 font-medium">HOURS CONSUMED</p>
            </div>
            <div className="text-right">
              <p className={cn(
                "text-lg font-bold",
                devPercentage > 90 ? "text-red-500" : "text-slate-900"
              )}>
                {Math.round(devPercentage)}%
              </p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Progress value={devPercentage} className={cn(
               "h-3",
               devPercentage > 90 ? "bg-red-100" : "bg-indigo-100"
            )} />
            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Start of Month</span>
              <span>100% Capacity</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-slate-400 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              Additional dev hours are billed at <span className="font-bold text-slate-900">${planDetails?.dev_hourly_rate || 0}/hr</span>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ')
}

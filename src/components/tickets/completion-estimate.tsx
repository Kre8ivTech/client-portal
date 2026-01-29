'use client'

import { Clock, Calendar, AlertCircle, CheckCircle, Info, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'
import type { CompletionEstimate } from '@/types/ai'

interface CompletionEstimateProps {
  estimate: CompletionEstimate
  showDetails?: boolean
  className?: string
}

const CONFIDENCE_CONFIG = {
  high: {
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle,
    label: 'High confidence',
  },
  medium: {
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Info,
    label: 'Moderate confidence',
  },
  low: {
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: AlertCircle,
    label: 'Subject to change',
  },
}

export function CompletionEstimateCard({
  estimate,
  showDetails = false,
  className,
}: CompletionEstimateProps) {
  const confidenceConfig = CONFIDENCE_CONFIG[estimate.confidence_level]
  const ConfidenceIcon = confidenceConfig.icon
  
  const completionDate = new Date(estimate.estimated_completion_date)
  const startDate = estimate.estimated_start_date 
    ? new Date(estimate.estimated_start_date)
    : null
  
  const today = new Date()
  const daysUntilCompletion = Math.ceil(
    (completionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  return (
    <Card className={cn('border-l-4 border-l-blue-500', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Estimated Completion
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn('text-xs', confidenceConfig.color)}
          >
            <ConfidenceIcon className="h-3 w-3 mr-1" />
            {confidenceConfig.label}
          </Badge>
        </div>
        {estimate.client_message && (
          <CardDescription className="mt-2">
            {estimate.client_message}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Main completion date */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-slate-500" />
            <div>
              <div className="font-semibold text-lg">
                {formatDate(estimate.estimated_completion_date)}
              </div>
              <div className="text-sm text-slate-500">
                {daysUntilCompletion === 0 && 'Target: Today'}
                {daysUntilCompletion === 1 && 'Target: Tomorrow'}
                {daysUntilCompletion > 1 && `In ${daysUntilCompletion} days`}
                {daysUntilCompletion < 0 && 'Overdue'}
              </div>
            </div>
          </div>
          
          {estimate.confidence_percent && (
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {estimate.confidence_percent}%
              </div>
              <div className="text-xs text-slate-500">confidence</div>
            </div>
          )}
        </div>

        {/* Queue position */}
        {estimate.queue_position > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <TrendingUp className="h-4 w-4" />
            <span>
              Queue position: <strong>#{estimate.queue_position}</strong>
              {estimate.tickets_ahead > 0 && (
                <span className="text-slate-400">
                  {' '}({estimate.tickets_ahead} ticket{estimate.tickets_ahead !== 1 ? 's' : ''} ahead)
                </span>
              )}
            </span>
          </div>
        )}

        {/* Estimated hours (if showing details) */}
        {showDetails && (
          <>
            <div className="border-t pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Estimated work time</span>
                <span className="font-medium">{estimate.estimated_hours} hours</span>
              </div>
              
              {startDate && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Expected start</span>
                  <span className="font-medium">{formatDate(estimate.estimated_start_date)}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Complexity</span>
                <ComplexityIndicator score={estimate.complexity_score} />
              </div>
            </div>

            {/* Factors */}
            {estimate.factors.length > 0 && (
              <div className="border-t pt-3">
                <div className="text-xs font-medium text-slate-500 mb-2">Factors considered</div>
                <div className="space-y-1">
                  {estimate.factors.map((factor, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        'text-xs flex items-center gap-2 p-1.5 rounded',
                        factor.impact === 'increases' 
                          ? 'bg-red-50 text-red-700'
                          : factor.impact === 'decreases'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-slate-50 text-slate-600'
                      )}
                    >
                      <span className="font-medium">{factor.factor}:</span>
                      <span>{factor.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact inline estimate for ticket cards
 */
export function CompletionEstimateBadge({
  estimate,
  className,
}: {
  estimate: Pick<CompletionEstimate, 'estimated_completion_date' | 'confidence_level'>
  className?: string
}) {
  const completionDate = new Date(estimate.estimated_completion_date)
  const today = new Date()
  const daysUntil = Math.ceil(
    (completionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  const confidenceConfig = CONFIDENCE_CONFIG[estimate.confidence_level]

  return (
    <Badge 
      variant="outline" 
      className={cn('text-xs', confidenceConfig.color, className)}
    >
      <Clock className="h-3 w-3 mr-1" />
      {daysUntil === 0 && 'Today'}
      {daysUntil === 1 && 'Tomorrow'}
      {daysUntil > 1 && daysUntil <= 7 && `${daysUntil} days`}
      {daysUntil > 7 && formatDate(estimate.estimated_completion_date)}
      {daysUntil < 0 && 'Overdue'}
    </Badge>
  )
}

/**
 * Simple complexity indicator dots
 */
function ComplexityIndicator({ score }: { score: number }) {
  const dots = Math.ceil(score * 5) // 0-1 -> 0-5 dots
  
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={cn(
            'w-2 h-2 rounded-full',
            i <= dots ? 'bg-blue-500' : 'bg-slate-200'
          )}
        />
      ))}
      <span className="ml-1 text-slate-500">
        {score < 0.3 ? 'Low' : score < 0.7 ? 'Medium' : 'High'}
      </span>
    </div>
  )
}

/**
 * Mini timeline showing work progress
 */
export function EstimateTimeline({
  estimate,
  className,
}: {
  estimate: Pick<CompletionEstimate, 'estimated_start_date' | 'estimated_completion_date' | 'queue_position'>
  className?: string
}) {
  const now = new Date()
  const start = estimate.estimated_start_date 
    ? new Date(estimate.estimated_start_date) 
    : now
  const end = new Date(estimate.estimated_completion_date)
  
  const totalDuration = end.getTime() - start.getTime()
  const elapsed = now.getTime() - start.getTime()
  const progress = totalDuration > 0 
    ? Math.max(0, Math.min(100, (elapsed / totalDuration) * 100))
    : 0

  const hasStarted = now >= start

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          {hasStarted ? 'Started' : `Starts ${formatDate(estimate.estimated_start_date)}`}
        </span>
        <span>Due {formatDate(estimate.estimated_completion_date)}</span>
      </div>
      
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={cn(
            'h-full rounded-full transition-all',
            hasStarted ? 'bg-blue-500' : 'bg-slate-300'
          )}
          style={{ width: `${hasStarted ? Math.max(5, progress) : 0}%` }}
        />
      </div>
      
      {estimate.queue_position > 1 && !hasStarted && (
        <div className="text-xs text-center text-slate-500">
          Waiting in queue (position #{estimate.queue_position})
        </div>
      )}
    </div>
  )
}

'use client'

import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  getPriorityConfig,
  formatResponseTime,
  type TicketPriority,
} from '@/lib/ticket-priority'
import { cn } from '@/lib/utils'
import { AlertCircle, Clock } from 'lucide-react'

interface PriorityIndicatorProps {
  priority: string | null
  /** Show compact badge without tooltip */
  compact?: boolean
  /** Show response time in badge */
  showResponseTime?: boolean
  /** Additional class names */
  className?: string
}

/**
 * Color-coded priority indicator with optional response time display
 */
export function PriorityIndicator({
  priority,
  compact = false,
  showResponseTime = false,
  className,
}: PriorityIndicatorProps) {
  const config = getPriorityConfig(priority)

  if (compact) {
    return (
      <Badge
        variant="outline"
        className={cn(
          config.colors.bg,
          config.colors.text,
          config.colors.border,
          'font-medium capitalize py-0.5',
          className
        )}
      >
        {config.label}
      </Badge>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              config.colors.bg,
              config.colors.text,
              config.colors.border,
              'font-medium py-0.5 gap-1.5 cursor-help',
              className
            )}
          >
            <span
              className={cn('w-2 h-2 rounded-full', config.colors.dot)}
              aria-hidden="true"
            />
            {config.label}
            {showResponseTime && (
              <span className="text-xs opacity-75 ml-1">
                ({formatResponseTime(config.firstResponseHours)})
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{config.label} Priority</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <div className="flex flex-col gap-1 text-xs pt-1 border-t">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>First Response: {formatResponseTime(config.firstResponseHours)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" />
                <span>Resolution: {formatResponseTime(config.resolutionHours)}</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface PriorityDotProps {
  priority: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Minimal priority dot indicator for compact displays
 */
export function PriorityDot({ priority, size = 'md', className }: PriorityDotProps) {
  const config = getPriorityConfig(priority)

  const sizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'rounded-full inline-block cursor-help',
              sizes[size],
              config.colors.dot,
              className
            )}
            aria-label={`${config.label} priority`}
          />
        </TooltipTrigger>
        <TooltipContent side="top">
          <span>{config.label} Priority</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface PrioritySelectItemProps {
  priority: TicketPriority
  showDetails?: boolean
}

/**
 * Priority display for select dropdowns with optional details
 */
export function PrioritySelectItem({
  priority,
  showDetails = false,
}: PrioritySelectItemProps) {
  const config = getPriorityConfig(priority)

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn('w-2 h-2 rounded-full', config.colors.dot)}
        aria-hidden="true"
      />
      <span>{config.label}</span>
      {showDetails && (
        <span className="text-xs text-muted-foreground ml-auto">
          {formatResponseTime(config.firstResponseHours)} response
        </span>
      )}
    </div>
  )
}

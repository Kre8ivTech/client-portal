'use client'

import { 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Briefcase,
  Coffee,
  Users,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { WorkloadAnalysis, StaffAvailabilityWindow } from '@/types/ai'

interface WorkloadCardProps {
  workload: WorkloadAnalysis
  showDetails?: boolean
  className?: string
}

function getUtilizationColor(percent: number): string {
  if (percent >= 90) return 'text-red-600 bg-red-100'
  if (percent >= 75) return 'text-yellow-600 bg-yellow-100'
  if (percent >= 50) return 'text-blue-600 bg-blue-100'
  return 'text-green-600 bg-green-100'
}

function getUtilizationStatus(percent: number): { label: string; icon: typeof Clock } {
  if (percent >= 90) return { label: 'At capacity', icon: AlertTriangle }
  if (percent >= 75) return { label: 'Busy', icon: Briefcase }
  if (percent >= 50) return { label: 'Balanced', icon: TrendingUp }
  return { label: 'Available', icon: CheckCircle }
}

export function WorkloadCard({ workload, showDetails = false, className }: WorkloadCardProps) {
  const utilizationColor = getUtilizationColor(workload.utilization_percent)
  const { label: statusLabel, icon: StatusIcon } = getUtilizationStatus(workload.utilization_percent)

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-slate-500" />
            Workload Overview
          </CardTitle>
          <Badge 
            variant="outline" 
            className={cn('text-xs', utilizationColor)}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusLabel}
          </Badge>
        </div>
        <CardDescription>
          {workload.can_take_new_work 
            ? 'Capacity available for new work'
            : 'Consider reassigning new tickets'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Utilization ring */}
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle
                  className="text-slate-200"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="transparent"
                  r="28"
                  cx="32"
                  cy="32"
                />
                <circle
                  className={cn(
                    workload.utilization_percent >= 90 ? 'text-red-500' :
                    workload.utilization_percent >= 75 ? 'text-yellow-500' :
                    workload.utilization_percent >= 50 ? 'text-blue-500' : 'text-green-500'
                  )}
                  strokeWidth="4"
                  strokeDasharray={`${workload.utilization_percent * 1.76} 176`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  r="28"
                  cx="32"
                  cy="32"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                {workload.utilization_percent}%
              </span>
            </div>
            <div>
              <div className="font-medium">Utilization</div>
              <div className="text-sm text-slate-500">
                {workload.estimated_hours_queued.toFixed(1)}h queued
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold text-slate-700">
              {workload.available_hours_today.toFixed(1)}h
            </div>
            <div className="text-xs text-slate-500">available today</div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-blue-50 rounded-lg">
            <div className="text-xl font-bold text-blue-700">{workload.current_tickets}</div>
            <div className="text-xs text-blue-600">Tickets</div>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded-lg">
            <div className="text-xl font-bold text-purple-700">{workload.current_tasks}</div>
            <div className="text-xs text-purple-600">Tasks</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded-lg">
            <div className="text-xl font-bold text-green-700">{workload.available_hours_week.toFixed(0)}h</div>
            <div className="text-xs text-green-600">Week capacity</div>
          </div>
        </div>

        {/* Hours by priority */}
        {showDetails && (
          <div className="border-t pt-3">
            <div className="text-xs font-medium text-slate-500 mb-2">Hours by Priority</div>
            <div className="space-y-2">
              <PriorityBar label="Critical" hours={workload.hours_by_priority.critical} color="bg-red-500" />
              <PriorityBar label="High" hours={workload.hours_by_priority.high} color="bg-orange-500" />
              <PriorityBar label="Medium" hours={workload.hours_by_priority.medium} color="bg-yellow-500" />
              <PriorityBar label="Low" hours={workload.hours_by_priority.low} color="bg-green-500" />
            </div>
          </div>
        )}

        {/* Next available */}
        <div className="flex items-center gap-2 text-sm text-slate-600 pt-2 border-t">
          <Calendar className="h-4 w-4" />
          <span>
            Next available: <strong>{formatNextAvailable(workload.next_available_slot)}</strong>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Priority bar component
 */
function PriorityBar({ label, hours, color }: { label: string; hours: number; color: string }) {
  const maxHours = 20 // Scale for visualization
  const width = Math.min(100, (hours / maxHours) * 100)

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 text-xs text-slate-600">{label}</div>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={cn('h-full rounded-full', color)}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-12 text-xs text-right text-slate-500">{hours.toFixed(1)}h</div>
    </div>
  )
}

/**
 * Format next available slot as human-readable
 */
function formatNextAvailable(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 1) return 'Now'
  if (diffHours < 24) return `In ${Math.round(diffHours)} hours`
  
  const diffDays = Math.ceil(diffHours / 24)
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays < 7) return `In ${diffDays} days`
  
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Compact workload badge for headers/lists
 */
export function WorkloadBadge({ 
  workload,
  className,
}: { 
  workload: Pick<WorkloadAnalysis, 'utilization_percent' | 'can_take_new_work'>
  className?: string 
}) {
  const color = getUtilizationColor(workload.utilization_percent)
  
  return (
    <Badge variant="outline" className={cn('text-xs', color, className)}>
      <TrendingUp className="h-3 w-3 mr-1" />
      {workload.utilization_percent}% utilized
    </Badge>
  )
}

/**
 * Weekly availability calendar
 */
export function WeeklyAvailabilityCalendar({
  availability,
  className,
}: {
  availability: StaffAvailabilityWindow[]
  className?: string
}) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-500" />
          Weekly Availability
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {availability.slice(0, 7).map((day) => {
            const isToday = day.date === today
            const hasCapacity = day.net_hours > 0
            const utilizationPercent = day.available_hours > 0 
              ? ((day.available_hours - day.net_hours) / day.available_hours) * 100 
              : 100

            return (
              <div 
                key={day.date} 
                className={cn(
                  'p-2 rounded-lg text-center',
                  isToday ? 'ring-2 ring-blue-500' : '',
                  !hasCapacity ? 'bg-slate-100' : 'bg-white border'
                )}
              >
                <div className="text-xs text-slate-500 mb-1">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={cn(
                  'text-sm font-medium',
                  !hasCapacity ? 'text-slate-400' : 'text-slate-700'
                )}>
                  {day.net_hours.toFixed(0)}h
                </div>
                {hasCapacity && (
                  <div className="mt-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        'h-full rounded-full',
                        utilizationPercent >= 80 ? 'bg-red-400' :
                        utilizationPercent >= 50 ? 'bg-yellow-400' : 'bg-green-400'
                      )}
                      style={{ width: `${utilizationPercent}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        
        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <span>Busy</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span>Full</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Team workload overview for managers
 */
export function TeamWorkloadSummary({
  teamWorkloads,
  className,
}: {
  teamWorkloads: Array<{
    staff_id: string
    staff_name: string
    workload: WorkloadAnalysis
  }>
  className?: string
}) {
  const avgUtilization = teamWorkloads.length > 0
    ? teamWorkloads.reduce((sum, m) => sum + m.workload.utilization_percent, 0) / teamWorkloads.length
    : 0

  const overloaded = teamWorkloads.filter(m => m.workload.utilization_percent >= 90).length
  const available = teamWorkloads.filter(m => m.workload.can_take_new_work).length

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            Team Workload
          </CardTitle>
          <Badge variant="outline" className={getUtilizationColor(avgUtilization)}>
            {avgUtilization.toFixed(0)}% avg
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 bg-slate-50 rounded">
            <div className="text-lg font-bold">{teamWorkloads.length}</div>
            <div className="text-xs text-slate-500">Staff</div>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <div className="text-lg font-bold text-green-700">{available}</div>
            <div className="text-xs text-green-600">Available</div>
          </div>
          <div className="text-center p-2 bg-red-50 rounded">
            <div className="text-lg font-bold text-red-700">{overloaded}</div>
            <div className="text-xs text-red-600">At capacity</div>
          </div>
        </div>

        {/* Staff list */}
        <div className="space-y-2">
          {teamWorkloads.map((member) => (
            <div 
              key={member.staff_id} 
              className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium">
                  {member.staff_name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="text-sm font-medium">{member.staff_name}</div>
                  <div className="text-xs text-slate-500">
                    {member.workload.current_tickets} tickets, {member.workload.current_tasks} tasks
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      'h-full rounded-full',
                      member.workload.utilization_percent >= 90 ? 'bg-red-500' :
                      member.workload.utilization_percent >= 75 ? 'bg-yellow-500' :
                      member.workload.utilization_percent >= 50 ? 'bg-blue-500' : 'bg-green-500'
                    )}
                    style={{ width: `${member.workload.utilization_percent}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 w-8 text-right">
                  {member.workload.utilization_percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

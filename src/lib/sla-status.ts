/**
 * SLA Status Utilities
 * 
 * Utilities for determining and displaying SLA status with visual indicators
 */

import { differenceInHours, differenceInMinutes, isPast } from 'date-fns'

export type SLAStatus = 
  | 'breach' // Red - Past deadline
  | 'critical' // Red - < 1 hour remaining  
  | 'warning' // Yellow - < 25% time remaining
  | 'upcoming' // Yellow - < 50% time remaining
  | 'on-track' // Green - > 50% time remaining
  | 'completed' // Gray - Resolved or responded

export interface SLAStatusInfo {
  status: SLAStatus
  label: string
  description: string
  hoursRemaining?: number
  minutesRemaining?: number
  hoursOverdue?: number
  colors: {
    bg: string
    text: string
    border: string
    dot: string
  }
}

/**
 * Get SLA status for first response
 */
export function getFirstResponseSLAStatus(
  createdAt: string | null,
  firstResponseDueAt: string | null,
  firstResponseAt: string | null
): SLAStatusInfo {
  // Already responded
  if (firstResponseAt) {
    return {
      status: 'completed',
      label: 'Responded',
      description: 'First response completed',
      colors: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      },
    }
  }

  // No SLA configured
  if (!firstResponseDueAt || !createdAt) {
    return {
      status: 'on-track',
      label: 'No SLA',
      description: 'No SLA deadline configured',
      colors: {
        bg: 'bg-slate-50',
        text: 'text-slate-500',
        border: 'border-slate-200',
        dot: 'bg-slate-300',
      },
    }
  }

  const now = new Date()
  const dueDate = new Date(firstResponseDueAt)
  const createdDate = new Date(createdAt)
  
  // Calculate time remaining
  const hoursRemaining = differenceInHours(dueDate, now)
  const minutesRemaining = differenceInMinutes(dueDate, now)
  
  // Breach - past deadline
  if (isPast(dueDate)) {
    const hoursOverdue = Math.abs(hoursRemaining)
    return {
      status: 'breach',
      label: 'OVERDUE',
      description: `First response overdue by ${formatDuration(hoursOverdue)}`,
      hoursOverdue,
      colors: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        dot: 'bg-red-500',
      },
    }
  }

  // Critical - less than 1 hour remaining
  if (hoursRemaining < 1) {
    return {
      status: 'critical',
      label: 'URGENT',
      description: `First response due in ${minutesRemaining} minutes`,
      hoursRemaining,
      minutesRemaining,
      colors: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        dot: 'bg-red-500',
      },
    }
  }

  // Calculate percentage of time elapsed
  const totalHours = differenceInHours(dueDate, createdDate)
  const elapsedHours = differenceInHours(now, createdDate)
  const percentElapsed = totalHours > 0 ? (elapsedHours / totalHours) * 100 : 0

  // Warning - less than 25% time remaining (75% elapsed)
  if (percentElapsed >= 75) {
    return {
      status: 'warning',
      label: 'At Risk',
      description: `First response due in ${formatDuration(hoursRemaining)}`,
      hoursRemaining,
      colors: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
        dot: 'bg-yellow-500',
      },
    }
  }

  // Upcoming - less than 50% time remaining (50% elapsed)
  if (percentElapsed >= 50) {
    return {
      status: 'upcoming',
      label: 'Approaching',
      description: `First response due in ${formatDuration(hoursRemaining)}`,
      hoursRemaining,
      colors: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-300',
        dot: 'bg-orange-500',
      },
    }
  }

  // On track - plenty of time remaining
  return {
    status: 'on-track',
    label: 'On Track',
    description: `First response due in ${formatDuration(hoursRemaining)}`,
    hoursRemaining,
    colors: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-300',
      dot: 'bg-green-500',
    },
  }
}

/**
 * Get SLA status for resolution
 */
export function getResolutionSLAStatus(
  createdAt: string | null,
  slaDueAt: string | null,
  resolvedAt: string | null,
  status: string
): SLAStatusInfo {
  // Already resolved
  if (resolvedAt || status === 'resolved' || status === 'closed') {
    return {
      status: 'completed',
      label: 'Resolved',
      description: 'Ticket resolved',
      colors: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      },
    }
  }

  // No SLA configured
  if (!slaDueAt || !createdAt) {
    return {
      status: 'on-track',
      label: 'No SLA',
      description: 'No resolution deadline configured',
      colors: {
        bg: 'bg-slate-50',
        text: 'text-slate-500',
        border: 'border-slate-200',
        dot: 'bg-slate-300',
      },
    }
  }

  const now = new Date()
  const dueDate = new Date(slaDueAt)
  const createdDate = new Date(createdAt)
  
  // Calculate time remaining
  const hoursRemaining = differenceInHours(dueDate, now)
  const minutesRemaining = differenceInMinutes(dueDate, now)
  
  // Breach - past deadline
  if (isPast(dueDate)) {
    const hoursOverdue = Math.abs(hoursRemaining)
    return {
      status: 'breach',
      label: 'OVERDUE',
      description: `Resolution overdue by ${formatDuration(hoursOverdue)}`,
      hoursOverdue,
      colors: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        dot: 'bg-red-500',
      },
    }
  }

  // Critical - less than 2 hours remaining
  if (hoursRemaining < 2) {
    return {
      status: 'critical',
      label: 'URGENT',
      description: `Resolution due in ${hoursRemaining < 1 ? `${minutesRemaining} minutes` : `${hoursRemaining} hours`}`,
      hoursRemaining,
      minutesRemaining,
      colors: {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        dot: 'bg-red-500',
      },
    }
  }

  // Calculate percentage of time elapsed
  const totalHours = differenceInHours(dueDate, createdDate)
  const elapsedHours = differenceInHours(now, createdDate)
  const percentElapsed = totalHours > 0 ? (elapsedHours / totalHours) * 100 : 0

  // Warning - less than 25% time remaining (75% elapsed)
  if (percentElapsed >= 75) {
    return {
      status: 'warning',
      label: 'At Risk',
      description: `Resolution due in ${formatDuration(hoursRemaining)}`,
      hoursRemaining,
      colors: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        border: 'border-yellow-300',
        dot: 'bg-yellow-500',
      },
    }
  }

  // Upcoming - less than 50% time remaining (50% elapsed)
  if (percentElapsed >= 50) {
    return {
      status: 'upcoming',
      label: 'Approaching',
      description: `Resolution due in ${formatDuration(hoursRemaining)}`,
      hoursRemaining,
      colors: {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-300',
        dot: 'bg-orange-500',
      },
    }
  }

  // On track - plenty of time remaining
  return {
    status: 'on-track',
    label: 'On Track',
    description: `Resolution due in ${formatDuration(hoursRemaining)}`,
    hoursRemaining,
    colors: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-300',
      dot: 'bg-green-500',
    },
  }
}

/**
 * Get combined SLA status (worst of first response and resolution)
 */
export function getCombinedSLAStatus(
  createdAt: string | null,
  firstResponseDueAt: string | null,
  firstResponseAt: string | null,
  slaDueAt: string | null,
  resolvedAt: string | null,
  status: string
): SLAStatusInfo {
  const firstResponseStatus = getFirstResponseSLAStatus(
    createdAt,
    firstResponseDueAt,
    firstResponseAt
  )
  
  const resolutionStatus = getResolutionSLAStatus(
    createdAt,
    slaDueAt,
    resolvedAt,
    status
  )

  // Return the worst status
  const statusPriority: Record<SLAStatus, number> = {
    breach: 0,
    critical: 1,
    warning: 2,
    upcoming: 3,
    'on-track': 4,
    completed: 5,
  }

  const firstPriority = statusPriority[firstResponseStatus.status]
  const resPriority = statusPriority[resolutionStatus.status]

  return firstPriority < resPriority ? firstResponseStatus : resolutionStatus
}

/**
 * Get row background color class based on SLA status
 */
export function getSLARowColor(slaStatus: SLAStatus): string {
  switch (slaStatus) {
    case 'breach':
    case 'critical':
      return 'bg-red-50 hover:bg-red-100'
    case 'warning':
      return 'bg-yellow-50 hover:bg-yellow-100'
    case 'upcoming':
      return 'bg-orange-50 hover:bg-orange-100'
    case 'on-track':
      return 'hover:bg-green-50'
    case 'completed':
    default:
      return 'hover:bg-slate-50'
  }
}

/**
 * Format duration in human-readable format
 */
function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  }
  
  if (hours < 24) {
    const roundedHours = Math.round(hours)
    return `${roundedHours} hour${roundedHours !== 1 ? 's' : ''}`
  }
  
  const days = Math.floor(hours / 24)
  const remainingHours = Math.round(hours % 24)
  
  if (remainingHours === 0) {
    return `${days} day${days !== 1 ? 's' : ''}`
  }
  
  return `${days}d ${remainingHours}h`
}

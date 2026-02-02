/**
 * Ticket Priority Configuration
 *
 * Defines response times, colors, and SLA targets for each priority level.
 */

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type TicketPriority = typeof TICKET_PRIORITIES[number]

export interface PriorityConfig {
  value: TicketPriority
  label: string
  description: string
  /** First response time target in hours */
  firstResponseHours: number
  /** Resolution time target in hours */
  resolutionHours: number
  /** Display order (lower = higher priority) */
  order: number
  /** Color scheme for UI display */
  colors: {
    bg: string
    bgHover: string
    text: string
    border: string
    dot: string
    row: string
    rowHover: string
  }
}

/**
 * Priority configuration with response times and color coding
 *
 * Response Time SLAs:
 * - Critical: 1 hour first response, 4 hours resolution
 * - High: 4 hours first response, 24 hours resolution
 * - Medium: 8 hours first response, 48 hours resolution
 * - Low: 24 hours first response, 72 hours resolution
 */
export const PRIORITY_CONFIG: Record<TicketPriority, PriorityConfig> = {
  critical: {
    value: 'critical',
    label: 'Critical',
    description: 'System down, security breach, or major business impact',
    firstResponseHours: 1,
    resolutionHours: 4,
    order: 1,
    colors: {
      bg: 'bg-red-100',
      bgHover: 'hover:bg-red-200',
      text: 'text-red-700',
      border: 'border-red-300',
      dot: 'bg-red-500',
      row: 'bg-red-50',
      rowHover: 'hover:bg-red-100',
    },
  },
  high: {
    value: 'high',
    label: 'High',
    description: 'Significant functionality impacted, workaround available',
    firstResponseHours: 4,
    resolutionHours: 24,
    order: 2,
    colors: {
      bg: 'bg-orange-100',
      bgHover: 'hover:bg-orange-200',
      text: 'text-orange-700',
      border: 'border-orange-300',
      dot: 'bg-orange-500',
      row: 'bg-orange-50',
      rowHover: 'hover:bg-orange-100',
    },
  },
  medium: {
    value: 'medium',
    label: 'Medium',
    description: 'Standard request with moderate business impact',
    firstResponseHours: 8,
    resolutionHours: 48,
    order: 3,
    colors: {
      bg: 'bg-blue-100',
      bgHover: 'hover:bg-blue-200',
      text: 'text-blue-700',
      border: 'border-blue-300',
      dot: 'bg-blue-500',
      row: 'bg-blue-50/30',
      rowHover: 'hover:bg-blue-50',
    },
  },
  low: {
    value: 'low',
    label: 'Low',
    description: 'General inquiry or minor issue with no immediate impact',
    firstResponseHours: 24,
    resolutionHours: 72,
    order: 4,
    colors: {
      bg: 'bg-slate-100',
      bgHover: 'hover:bg-slate-200',
      text: 'text-slate-600',
      border: 'border-slate-300',
      dot: 'bg-slate-400',
      row: 'bg-slate-50/30',
      rowHover: 'hover:bg-slate-50',
    },
  },
}

/**
 * Get priority configuration by value
 */
export function getPriorityConfig(priority: string | null): PriorityConfig {
  const validPriority = priority as TicketPriority
  return PRIORITY_CONFIG[validPriority] ?? PRIORITY_CONFIG.medium
}

/**
 * Get priority options for select dropdowns
 */
export function getPriorityOptions() {
  return Object.values(PRIORITY_CONFIG)
    .sort((a, b) => a.order - b.order)
    .map(({ value, label }) => ({ value, label }))
}

/**
 * Calculate SLA due date based on priority
 */
export function calculateSlaDueDate(
  priority: TicketPriority,
  createdAt: Date = new Date()
): Date {
  const config = PRIORITY_CONFIG[priority]
  const dueDate = new Date(createdAt)
  dueDate.setHours(dueDate.getHours() + config.resolutionHours)
  return dueDate
}

/**
 * Calculate first response due date based on priority
 */
export function calculateFirstResponseDue(
  priority: TicketPriority,
  createdAt: Date = new Date()
): Date {
  const config = PRIORITY_CONFIG[priority]
  const dueDate = new Date(createdAt)
  dueDate.setHours(dueDate.getHours() + config.firstResponseHours)
  return dueDate
}

/**
 * Format response time for display
 */
export function formatResponseTime(hours: number): string {
  if (hours < 1) {
    return `${hours * 60} minutes`
  }
  if (hours === 1) {
    return '1 hour'
  }
  if (hours < 24) {
    return `${hours} hours`
  }
  const days = hours / 24
  return days === 1 ? '1 day' : `${days} days`
}

/**
 * Get all priorities sorted by urgency (most urgent first)
 */
export function getPrioritiesByUrgency(): PriorityConfig[] {
  return Object.values(PRIORITY_CONFIG).sort((a, b) => a.order - b.order)
}

/**
 * Check if a priority is considered urgent (critical or high)
 */
export function isUrgentPriority(priority: string | null): boolean {
  return priority === 'critical' || priority === 'high'
}

/**
 * Workload & Completion Estimation Service
 * 
 * Analyzes staff calendars, current workload, and historical data
 * to provide completion estimates for tickets and tasks.
 */

import { aiClient } from './client'
import { SYSTEM_PROMPTS, COMPLEXITY_INDICATORS, TICKET_CATEGORIES, AI_MODELS } from './config'
import type {
  WorkloadAnalysis,
  CompletionEstimate,
  EstimationFactor,
  StaffAvailabilityWindow,
  HistoricalTicketData,
  AIServiceResponse,
  StaffSchedule,
  CalendarBlock,
} from '@/types/ai'
import type { TicketPriority } from '@/types/tickets'

// =============================================================================
// WORKLOAD ANALYSIS
// =============================================================================

/**
 * Analyze a staff member's current workload
 */
export function analyzeWorkload(
  staffId: string,
  schedules: StaffSchedule[],
  calendarBlocks: CalendarBlock[],
  openTickets: Array<{ id: string; priority: TicketPriority; estimated_hours: number }>,
  openTasks: Array<{ id: string; estimated_hours: number }>
): WorkloadAnalysis {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const dayOfWeek = now.getDay()

  // Get today's schedule
  const todaySchedule = schedules.find(s => s.day_of_week === dayOfWeek)
  const availableToday = todaySchedule?.is_working_day ? todaySchedule.available_hours : 0

  // Calculate blocked hours today
  const blockedToday = calendarBlocks
    .filter(block => {
      const blockStart = new Date(block.start_at)
      const blockEnd = new Date(block.end_at)
      const todayStart = new Date(today)
      const todayEnd = new Date(today + 'T23:59:59')
      return blockStart <= todayEnd && blockEnd >= todayStart
    })
    .reduce((total, block) => {
      // Calculate overlap with today
      const blockStart = new Date(block.start_at)
      const blockEnd = new Date(block.end_at)
      const todayStart = new Date(today)
      const todayEnd = new Date(today + 'T23:59:59')
      
      const overlapStart = Math.max(blockStart.getTime(), todayStart.getTime())
      const overlapEnd = Math.min(blockEnd.getTime(), todayEnd.getTime())
      const overlapHours = Math.max(0, (overlapEnd - overlapStart) / (1000 * 60 * 60))
      
      return total + overlapHours
    }, 0)

  // Calculate week availability
  let availableWeek = 0
  for (let i = 0; i < 7; i++) {
    const daySchedule = schedules.find(s => s.day_of_week === i)
    if (daySchedule?.is_working_day) {
      availableWeek += daySchedule.available_hours
    }
  }

  // Sum up queued work
  const ticketHours = openTickets.reduce((sum, t) => sum + (t.estimated_hours || 2), 0)
  const taskHours = openTasks.reduce((sum, t) => sum + (t.estimated_hours || 1), 0)
  const totalQueuedHours = ticketHours + taskHours

  // Calculate hours by priority
  const hoursByPriority = {
    critical: openTickets.filter(t => t.priority === 'critical').reduce((s, t) => s + (t.estimated_hours || 1), 0),
    high: openTickets.filter(t => t.priority === 'high').reduce((s, t) => s + (t.estimated_hours || 2), 0),
    medium: openTickets.filter(t => t.priority === 'medium').reduce((s, t) => s + (t.estimated_hours || 2), 0),
    low: openTickets.filter(t => t.priority === 'low').reduce((s, t) => s + (t.estimated_hours || 1), 0),
  }

  const netAvailableToday = Math.max(0, availableToday - blockedToday)
  const utilizationPercent = availableWeek > 0 
    ? Math.min(100, (totalQueuedHours / availableWeek) * 100)
    : 100

  // Find next available slot
  const nextAvailable = findNextAvailableSlot(schedules, calendarBlocks, now)

  return {
    staff_id: staffId,
    analysis_date: today,
    current_tickets: openTickets.length,
    current_tasks: openTasks.length,
    estimated_hours_queued: totalQueuedHours,
    available_hours_today: netAvailableToday,
    available_hours_week: availableWeek,
    utilization_percent: Math.round(utilizationPercent),
    hours_by_priority: hoursByPriority,
    can_take_new_work: utilizationPercent < 80 && netAvailableToday > 0,
    next_available_slot: nextAvailable.toISOString(),
    recommended_capacity: Math.max(0, 100 - utilizationPercent),
  }
}

// =============================================================================
// COMPLETION ESTIMATION
// =============================================================================

/**
 * Estimate completion date for a ticket
 */
export async function estimateCompletion(
  ticket: {
    id: string
    subject: string
    description: string
    category: string
    priority: TicketPriority
    created_at: string
    queue_position: number
  },
  assignedStaff: {
    id: string
    workload: WorkloadAnalysis
    availability: StaffAvailabilityWindow[]
  },
  historicalData: HistoricalTicketData[]
): Promise<CompletionEstimate> {
  // 1. Estimate hours needed
  const estimatedHours = await estimateHours(ticket, historicalData)

  // 2. Analyze complexity
  const complexityScore = analyzeComplexity(ticket.subject, ticket.description)

  // 3. Calculate factors affecting estimate
  const factors = calculateFactors(ticket, assignedStaff.workload, complexityScore)

  // 4. Find when work can start based on queue
  const hoursAhead = calculateHoursAheadInQueue(ticket.queue_position, ticket.priority)
  
  // 5. Calculate completion date
  const { startDate, completionDate, confidence } = calculateCompletionDate(
    estimatedHours,
    hoursAhead,
    assignedStaff.availability,
    factors
  )

  // 6. Generate client-friendly message
  const clientMessage = generateClientMessage(completionDate, confidence, ticket.priority)

  return {
    ticket_id: ticket.id,
    estimated_start_date: startDate.toISOString().split('T')[0],
    estimated_completion_date: completionDate.toISOString().split('T')[0],
    confidence_level: confidence.level,
    confidence_percent: confidence.percent,
    estimated_hours: estimatedHours,
    complexity_score: complexityScore,
    factors,
    assigned_to: assignedStaff.id,
    staff_availability: assignedStaff.availability,
    queue_position: ticket.queue_position,
    tickets_ahead: ticket.queue_position - 1,
    client_message: clientMessage,
    detailed_breakdown: generateDetailedBreakdown(estimatedHours, factors, assignedStaff.availability),
  }
}

/**
 * Estimate hours needed using historical data + AI
 */
async function estimateHours(
  ticket: { subject: string; description: string; category: string; priority: TicketPriority },
  historicalData: HistoricalTicketData[]
): Promise<number> {
  // Find similar historical tickets
  const similarTickets = historicalData.filter(h => h.category === ticket.category)
  
  if (similarTickets.length >= 5) {
    // Use historical average with priority adjustment
    const avgHours = similarTickets.reduce((s, t) => s + t.actual_hours, 0) / similarTickets.length
    const priorityMultiplier = {
      critical: 0.8, // Rush = less time but focused
      high: 0.9,
      medium: 1.0,
      low: 1.2, // May take longer due to lower priority
    }
    return Math.round(avgHours * priorityMultiplier[ticket.priority] * 10) / 10
  }

  // Fall back to category defaults
  const categoryConfig = TICKET_CATEGORIES[ticket.category as keyof typeof TICKET_CATEGORIES]
  if (categoryConfig) {
    return categoryConfig.typical_hours
  }

  // Use AI for novel tickets
  const response = await aiClient.analyzeJSON<{ estimated_hours: number }>(
    'Estimate hours for support ticket. Return JSON with estimated_hours.',
    `Subject: ${ticket.subject}\nDescription: ${ticket.description}\nCategory: ${ticket.category}`,
    AI_MODELS.fast
  )

  return response.data?.estimated_hours || 2 // Default 2 hours
}

/**
 * Analyze ticket complexity (0-1 scale)
 */
function analyzeComplexity(subject: string, description: string): number {
  const text = `${subject} ${description}`.toLowerCase()
  let score = 0.3 // Base complexity

  // Check for high complexity indicators
  const highMatches = COMPLEXITY_INDICATORS.high.filter(ind => text.includes(ind)).length
  score += highMatches * 0.15

  // Check for medium complexity indicators
  const mediumMatches = COMPLEXITY_INDICATORS.medium.filter(ind => text.includes(ind)).length
  score += mediumMatches * 0.08

  // Check for low complexity indicators (reduces score)
  const lowMatches = COMPLEXITY_INDICATORS.low.filter(ind => text.includes(ind)).length
  score -= lowMatches * 0.1

  // Length of description adds complexity
  if (description.length > 1000) score += 0.1
  if (description.length > 2000) score += 0.1

  return Math.max(0.1, Math.min(1.0, score))
}

/**
 * Calculate factors affecting the estimate
 */
function calculateFactors(
  ticket: { priority: TicketPriority; queue_position: number },
  workload: WorkloadAnalysis,
  complexityScore: number
): EstimationFactor[] {
  const factors: EstimationFactor[] = []

  // Priority factor
  if (ticket.priority === 'critical') {
    factors.push({
      factor: 'Critical priority',
      impact: 'decreases',
      description: 'Will be prioritized and worked on immediately',
      weight: 0.3,
    })
  } else if (ticket.priority === 'low') {
    factors.push({
      factor: 'Low priority',
      impact: 'increases',
      description: 'May be queued behind higher priority work',
      weight: 0.2,
    })
  }

  // Queue position
  if (ticket.queue_position > 5) {
    factors.push({
      factor: 'Queue position',
      impact: 'increases',
      description: `${ticket.queue_position - 1} tickets ahead in queue`,
      weight: 0.15 * (ticket.queue_position - 1),
    })
  }

  // Staff workload
  if (workload.utilization_percent > 80) {
    factors.push({
      factor: 'High staff utilization',
      impact: 'increases',
      description: `Staff currently at ${workload.utilization_percent}% capacity`,
      weight: 0.2,
    })
  } else if (workload.utilization_percent < 50) {
    factors.push({
      factor: 'Available capacity',
      impact: 'decreases',
      description: 'Staff has bandwidth to work on this soon',
      weight: 0.15,
    })
  }

  // Complexity
  if (complexityScore > 0.7) {
    factors.push({
      factor: 'High complexity',
      impact: 'increases',
      description: 'Issue appears to involve multiple systems or requires investigation',
      weight: complexityScore * 0.3,
    })
  } else if (complexityScore < 0.3) {
    factors.push({
      factor: 'Low complexity',
      impact: 'decreases',
      description: 'Straightforward issue with likely quick resolution',
      weight: (1 - complexityScore) * 0.2,
    })
  }

  return factors
}

/**
 * Calculate estimated hours ahead in queue based on priority
 */
function calculateHoursAheadInQueue(queuePosition: number, priority: TicketPriority): number {
  const avgHoursPerTicket = 2
  const positionsAhead = Math.max(0, queuePosition - 1)
  
  // Priority affects how much of the queue matters
  const priorityFactor = {
    critical: 0.1, // Skip most of queue
    high: 0.3,
    medium: 0.7,
    low: 1.0, // Full queue wait
  }

  return positionsAhead * avgHoursPerTicket * priorityFactor[priority]
}

/**
 * Calculate actual completion date based on availability
 */
function calculateCompletionDate(
  estimatedHours: number,
  hoursAheadInQueue: number,
  availability: StaffAvailabilityWindow[],
  factors: EstimationFactor[]
): { startDate: Date; completionDate: Date; confidence: { level: 'low' | 'medium' | 'high'; percent: number } } {
  // Apply factor adjustments
  let adjustedHours = estimatedHours
  for (const factor of factors) {
    if (factor.impact === 'increases') {
      adjustedHours *= (1 + factor.weight)
    } else if (factor.impact === 'decreases') {
      adjustedHours *= (1 - factor.weight * 0.5) // Decreases have less impact
    }
  }

  // Add buffer (20% for medium confidence)
  const bufferPercent = 0.2
  const totalHoursNeeded = (hoursAheadInQueue + adjustedHours) * (1 + bufferPercent)

  // Walk through availability to find completion date
  let hoursRemaining = totalHoursNeeded
  let currentDate = new Date()
  let startDate: Date | null = null

  for (const day of availability) {
    if (hoursRemaining <= 0) break
    
    if (day.net_hours > 0) {
      if (!startDate && hoursRemaining <= adjustedHours * (1 + bufferPercent)) {
        startDate = new Date(day.date)
      }
      hoursRemaining -= day.net_hours
      currentDate = new Date(day.date)
    }
  }

  // If we ran out of availability windows, project forward
  if (hoursRemaining > 0) {
    const avgDailyHours = 6
    const daysNeeded = Math.ceil(hoursRemaining / avgDailyHours)
    currentDate.setDate(currentDate.getDate() + daysNeeded)
  }

  // Calculate confidence
  const confidence = calculateConfidence(estimatedHours, factors, availability.length)

  return {
    startDate: startDate || new Date(),
    completionDate: currentDate,
    confidence,
  }
}

/**
 * Calculate confidence level for the estimate
 */
function calculateConfidence(
  estimatedHours: number,
  factors: EstimationFactor[],
  availabilityDays: number
): { level: 'low' | 'medium' | 'high'; percent: number } {
  let baseConfidence = 70

  // More hours = less confidence
  if (estimatedHours > 8) baseConfidence -= 10
  if (estimatedHours > 16) baseConfidence -= 10

  // More increasing factors = less confidence
  const increasingFactors = factors.filter(f => f.impact === 'increases')
  baseConfidence -= increasingFactors.length * 5

  // Good availability data = more confidence
  if (availabilityDays >= 14) baseConfidence += 10
  if (availabilityDays < 7) baseConfidence -= 10

  const percent = Math.max(30, Math.min(95, baseConfidence))
  const level = percent >= 70 ? 'high' : percent >= 50 ? 'medium' : 'low'

  return { level, percent }
}

/**
 * Find next available work slot
 */
function findNextAvailableSlot(
  schedules: StaffSchedule[],
  calendarBlocks: CalendarBlock[],
  from: Date
): Date {
  const checkDate = new Date(from)
  
  for (let i = 0; i < 30; i++) { // Check up to 30 days out
    const dayOfWeek = checkDate.getDay()
    const schedule = schedules.find(s => s.day_of_week === dayOfWeek)
    
    if (schedule?.is_working_day) {
      // Check if day is blocked
      const dateStr = checkDate.toISOString().split('T')[0]
      const isBlocked = calendarBlocks.some(block => {
        const blockStart = new Date(block.start_at).toISOString().split('T')[0]
        const blockEnd = new Date(block.end_at).toISOString().split('T')[0]
        return block.all_day && dateStr >= blockStart && dateStr <= blockEnd
      })

      if (!isBlocked) {
        return checkDate
      }
    }

    checkDate.setDate(checkDate.getDate() + 1)
  }

  return checkDate // Return furthest date checked
}

/**
 * Generate client-friendly message
 */
function generateClientMessage(
  completionDate: Date,
  confidence: { level: string; percent: number },
  priority: TicketPriority
): string {
  const dateStr = completionDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const priorityMessages = {
    critical: 'We understand this is urgent and have prioritized it accordingly.',
    high: 'This has been marked as high priority.',
    medium: '',
    low: '',
  }

  const confidenceMessages = {
    high: `We expect to complete this by ${dateStr}.`,
    medium: `Our target completion date is ${dateStr}, though this may vary depending on complexity.`,
    low: `We're tentatively targeting ${dateStr}, but will provide updates as we learn more about the scope.`,
  }

  const parts = [
    priorityMessages[priority],
    confidenceMessages[confidence.level as keyof typeof confidenceMessages],
  ].filter(Boolean)

  return parts.join(' ')
}

/**
 * Generate detailed breakdown for staff
 */
function generateDetailedBreakdown(
  estimatedHours: number,
  factors: EstimationFactor[],
  availability: StaffAvailabilityWindow[]
): string {
  const lines = [
    `Base estimate: ${estimatedHours} hours`,
    '',
    'Factors:',
    ...factors.map(f => `  ${f.impact === 'increases' ? '+' : '-'} ${f.factor}: ${f.description}`),
    '',
    `Available capacity next 7 days: ${availability.slice(0, 7).reduce((s, d) => s + d.net_hours, 0)} hours`,
  ]

  return lines.join('\n')
}

// =============================================================================
// STAFF AVAILABILITY HELPERS
// =============================================================================

/**
 * Generate availability windows for a staff member
 */
export function generateAvailabilityWindows(
  schedules: StaffSchedule[],
  calendarBlocks: CalendarBlock[],
  startDate: Date,
  days: number = 14
): StaffAvailabilityWindow[] {
  const windows: StaffAvailabilityWindow[] = []
  const currentDate = new Date(startDate)

  for (let i = 0; i < days; i++) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const dayOfWeek = currentDate.getDay()
    
    const schedule = schedules.find(s => s.day_of_week === dayOfWeek)
    const availableHours = schedule?.is_working_day ? (schedule.available_hours || 0) : 0

    // Calculate blocked hours for this day
    const blockedHours = calendarBlocks
      .filter(block => {
        const blockDate = new Date(block.start_at).toISOString().split('T')[0]
        return blockDate === dateStr || (block.all_day && dateStr >= blockDate && dateStr <= new Date(block.end_at).toISOString().split('T')[0])
      })
      .reduce((total, block) => {
        if (block.all_day) return availableHours // Full day blocked
        // Calculate partial block
        const blockStart = new Date(block.start_at)
        const blockEnd = new Date(block.end_at)
        return total + (blockEnd.getTime() - blockStart.getTime()) / (1000 * 60 * 60)
      }, 0)

    windows.push({
      date: dateStr,
      available_hours: availableHours,
      blocked_hours: Math.min(blockedHours, availableHours),
      net_hours: Math.max(0, availableHours - blockedHours),
    })

    currentDate.setDate(currentDate.getDate() + 1)
  }

  return windows
}

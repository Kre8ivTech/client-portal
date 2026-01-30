import { addDays, endOfDay, startOfDay } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase/admin'

const DEFAULT_RATE_CENTS = Number(process.env.DEFAULT_SUPPORT_RATE_CENTS || 15000)
const MAX_LOOKAHEAD_DAYS = 45

const priorityHours: Record<string, number> = {
  critical: 12,
  high: 8,
  medium: 4,
  low: 2,
}

export async function createTicketEstimate({
  ticketId,
  organizationId,
  createdBy,
  priority,
  description,
}: {
  ticketId: string
  organizationId: string
  createdBy: string
  priority: string
  description: string
}) {
  const estimatedHours = calculateEstimatedHours(priority, description)
  const { hasActivePlan } = await getPlanStatus(organizationId)
  const estimatedCostCents = hasActivePlan ? null : Math.round(estimatedHours * DEFAULT_RATE_CENTS)

  const { completionAt, rationale } = await estimateCompletionDate({
    organizationId,
    estimatedHours,
  })

  const { data } = await supabaseAdmin
    .from('ticket_estimates')
    .insert({
      ticket_id: ticketId,
      organization_id: organizationId,
      estimated_hours: estimatedHours,
      estimated_cost_cents: estimatedCostCents,
      estimated_completion_at: completionAt?.toISOString() ?? null,
      estimated_completion_reason: rationale,
      created_by: createdBy,
      ai_model: 'heuristic-v1',
      ai_confidence: 0.4,
    })
    .select()
    .single()

  return data ?? null
}

function calculateEstimatedHours(priority: string, description: string) {
  const base = priorityHours[priority] ?? 4
  const detailFactor = Math.min(6, Math.ceil(description.length / 800))
  return Number((base + detailFactor).toFixed(2))
}

async function getPlanStatus(organizationId: string) {
  const { data, error } = await supabaseAdmin
    .from('plan_assignments')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .limit(1)

  if (error) {
    return { hasActivePlan: false }
  }

  return { hasActivePlan: Boolean(data?.length) }
}

async function estimateCompletionDate({
  organizationId,
  estimatedHours,
}: {
  organizationId: string
  estimatedHours: number
}) {
  const backlogHours = await getBacklogHours(organizationId)
  const totalHours = estimatedHours + backlogHours
  const { schedules, eventsByDayUser } = await getSchedulesAndEvents(organizationId)

  if (schedules.length === 0) {
    return {
      completionAt: addDays(new Date(), Math.ceil(totalHours / 8)),
      rationale: 'Estimated using default capacity of 8 hours per day.',
    }
  }

  let remainingHours = totalHours
  let currentDate = startOfDay(new Date())
  let iterations = 0

  while (remainingHours > 0 && iterations < MAX_LOOKAHEAD_DAYS) {
    const dayOfWeek = currentDate.getUTCDay()
    let dayCapacity = 0

    for (const schedule of schedules) {
      if (!schedule.work_days.includes(dayOfWeek)) continue
      dayCapacity += Math.max(0, schedule.daily_hours - getBusyHours(schedule.user_id, currentDate, eventsByDayUser))
    }

    if (dayCapacity > 0) {
      remainingHours -= dayCapacity
    }

    if (remainingHours <= 0) {
      return {
        completionAt: endOfDay(currentDate),
        rationale: 'Estimated using staff schedules and synced calendar busy time.',
      }
    }

    currentDate = addDays(currentDate, 1)
    iterations += 1
  }

  return {
    completionAt: addDays(new Date(), MAX_LOOKAHEAD_DAYS),
    rationale: 'Estimated using current workload and schedule capacity.',
  }
}

async function getBacklogHours(organizationId: string) {
  const { count } = await supabaseAdmin
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('status', ['new', 'open', 'in_progress', 'pending_client'])

  const backlog = count ? count * 1.5 : 0
  return backlog
}

async function getSchedulesAndEvents(organizationId: string) {
  const { data: schedules } = await supabaseAdmin
    .from('staff_work_schedules')
    .select('user_id, work_days, start_time, end_time')
    .eq('organization_id', organizationId)

  const normalizedSchedules = (schedules || []).map((schedule) => ({
    user_id: schedule.user_id,
    work_days: schedule.work_days as number[],
    daily_hours: getDailyHours(schedule.start_time, schedule.end_time),
  }))

  const userIds = normalizedSchedules.map((schedule) => schedule.user_id)
  if (userIds.length === 0) {
    return { schedules: [], eventsByDayUser: new Map<string, number>() }
  }

  const rangeStart = startOfDay(new Date())
  const rangeEnd = addDays(rangeStart, MAX_LOOKAHEAD_DAYS)

  const { data: events } = await supabaseAdmin
    .from('calendar_events')
    .select('user_id, start_at, end_at, is_busy')
    .in('user_id', userIds)
    .eq('is_busy', true)
    .gte('start_at', rangeStart.toISOString())
    .lte('start_at', rangeEnd.toISOString())

  const eventsByDayUser = new Map<string, number>()

  for (const event of events || []) {
    const start = new Date(event.start_at)
    const end = new Date(event.end_at)
    const hours = Math.max(0, (end.getTime() - start.getTime()) / 36e5)
    const dayKey = `${event.user_id}-${start.toISOString().slice(0, 10)}`
    eventsByDayUser.set(dayKey, (eventsByDayUser.get(dayKey) || 0) + hours)
  }

  return { schedules: normalizedSchedules, eventsByDayUser }
}

function getDailyHours(startTime: string, endTime: string) {
  const start = parseHours(startTime)
  const end = parseHours(endTime)
  if (end <= start) return 0
  return end - start
}

function parseHours(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours + (minutes || 0) / 60
}

function getBusyHours(
  userId: string,
  date: Date,
  eventsByDayUser: Map<string, number>
) {
  const dayKey = `${userId}-${date.toISOString().slice(0, 10)}`
  return eventsByDayUser.get(dayKey) || 0
}

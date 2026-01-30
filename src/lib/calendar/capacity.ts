import { addDays, startOfDay } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase/admin'

const WINDOW_DAYS = 7

export async function upsertCapacitySnapshotForOrg(organizationId: string) {
  const windowStart = startOfDay(new Date())
  const windowEnd = addDays(windowStart, WINDOW_DAYS)

  const { data: schedules } = await supabaseAdmin
    .from('staff_work_schedules')
    .select('user_id, work_days, start_time, end_time')
    .eq('organization_id', organizationId)

  const dailySchedules = (schedules || []).map((schedule) => ({
    userId: schedule.user_id,
    workDays: schedule.work_days as number[],
    dailyHours: getDailyHours(schedule.start_time, schedule.end_time),
  }))

  const { data: events } = await supabaseAdmin
    .from('calendar_events')
    .select('user_id, start_at, end_at, is_busy')
    .eq('organization_id', organizationId)
    .eq('is_busy', true)
    .gte('start_at', windowStart.toISOString())
    .lte('start_at', windowEnd.toISOString())

  const bookedHours = (events || []).reduce((total, event) => {
    const start = new Date(event.start_at)
    const end = new Date(event.end_at)
    const hours = Math.max(0, (end.getTime() - start.getTime()) / 36e5)
    return total + hours
  }, 0)

  let availableHours = 0
  for (let i = 0; i < WINDOW_DAYS; i += 1) {
    const date = addDays(windowStart, i)
    const dayOfWeek = date.getUTCDay()
    for (const schedule of dailySchedules) {
      if (schedule.workDays.includes(dayOfWeek)) {
        availableHours += schedule.dailyHours
      }
    }
  }

  const capacityHours = Math.max(availableHours - bookedHours, 0)

  await supabaseAdmin.from('capacity_snapshots').insert({
    organization_id: organizationId,
    window_start: windowStart.toISOString().slice(0, 10),
    window_end: windowEnd.toISOString().slice(0, 10),
    total_available_hours: Number(availableHours.toFixed(2)),
    total_booked_hours: Number(bookedHours.toFixed(2)),
    total_capacity_hours: Number(capacityHours.toFixed(2)),
    notes: { source: 'calendar-sync', window_days: WINDOW_DAYS },
  })
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

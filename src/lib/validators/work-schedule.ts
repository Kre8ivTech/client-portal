import { z } from 'zod'

const timeString = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:mm format')

export const workScheduleSchema = z.object({
  time_zone: z.string().min(1).max(64),
  work_days: z.array(z.number().int().min(0).max(6)).min(1),
  start_time: timeString,
  end_time: timeString,
})

export type WorkScheduleInput = z.infer<typeof workScheduleSchema>

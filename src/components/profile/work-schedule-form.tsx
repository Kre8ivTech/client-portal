'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle } from 'lucide-react'

const WEEK_DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

interface WorkScheduleFormProps {
  initialSchedule?: {
    time_zone: string
    work_days: number[]
    start_time: string
    end_time: string
  } | null
}

export function WorkScheduleForm({ initialSchedule }: WorkScheduleFormProps) {
  const [timeZone, setTimeZone] = useState(initialSchedule?.time_zone || 'UTC')
  const [workDays, setWorkDays] = useState<number[]>(
    initialSchedule?.work_days || [1, 2, 3, 4, 5]
  )
  const [startTime, setStartTime] = useState(initialSchedule?.start_time || '09:00')
  const [endTime, setEndTime] = useState(initialSchedule?.end_time || '17:00')
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const toggleDay = (day: number) => {
    setWorkDays((prev) =>
      prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day]
    )
  }

  const handleSave = async () => {
    setStatus('saving')
    setError(null)

    const response = await fetch('/api/work-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        time_zone: timeZone,
        work_days: workDays,
        start_time: startTime,
        end_time: endTime,
      }),
    })

    const payload = await response.json()

    if (!response.ok) {
      setStatus('error')
      setError(payload.error || 'Unable to save schedule.')
      return
    }

    setStatus('success')
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Time Zone</Label>
          <Input
            value={timeZone}
            onChange={(event) => setTimeZone(event.target.value)}
            placeholder="America/New_York"
          />
        </div>
        <div className="space-y-2">
          <Label>Work Days</Label>
          <div className="flex flex-wrap gap-2">
            {WEEK_DAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                  workDays.includes(day.value)
                    ? 'bg-primary text-white border-primary'
                    : 'border-slate-200 text-slate-500'
                }`}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>End Time</Label>
          <Input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
          />
        </div>
      </div>

      {status === 'success' && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Schedule saved</AlertTitle>
          <AlertDescription>Your work schedule has been updated.</AlertDescription>
        </Alert>
      )}

      {status === 'error' && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to save schedule</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button onClick={handleSave} disabled={status === 'saving'}>
        {status === 'saving' ? 'Saving...' : 'Save Schedule'}
      </Button>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, Clock, Plus, Trash2, Loader2 } from 'lucide-react'
import { Database } from '@/types/database'

type CalendarIntegration = Database['public']['Tables']['staff_calendar_integrations']['Row']
type OfficeHour = Database['public']['Tables']['office_hours']['Row']

const DAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const

const PROVIDERS = [
  { value: 'google', label: 'Google Calendar' },
  { value: 'microsoft', label: 'Microsoft 365 / Outlook' },
  { value: 'outlook', label: 'Outlook.com' },
  { value: 'ical', label: 'iCal / URL' },
] as const

interface CalendarOfficeHoursProps {
  profileId: string
}

export function CalendarOfficeHours({ profileId }: CalendarOfficeHoursProps) {
  const supabase = createClient()
  const [integrations, setIntegrations] = useState<CalendarIntegration[]>([])
  const [officeHours, setOfficeHours] = useState<OfficeHour[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connectProvider, setConnectProvider] = useState<string | null>(null)
  const [newSlot, setNewSlot] = useState({ day_of_week: 1, start_time: '09:00', end_time: '17:00' })

  useEffect(() => {
    async function load() {
      const [intRes, ohRes] = await Promise.all([
        supabase
          .from('staff_calendar_integrations')
          .select('*')
          .eq('profile_id', profileId)
          .order('provider'),
        supabase
          .from('office_hours')
          .select('*')
          .eq('profile_id', profileId)
          .order('day_of_week')
          .order('start_time'),
      ])
      if (intRes.data) setIntegrations(intRes.data as CalendarIntegration[])
      if (ohRes.data) setOfficeHours(ohRes.data as OfficeHour[])
      setLoading(false)
    }
    load()
  }, [profileId, supabase])

  const handleConnectCalendar = async () => {
    if (!connectProvider) return
    setSaving(true)
    const { error } = await (supabase as any).from('staff_calendar_integrations').insert({
      profile_id: profileId,
      provider: connectProvider as 'google' | 'microsoft' | 'outlook' | 'ical',
      sync_enabled: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    })
    setSaving(false)
    if (!error) {
      setConnectProvider(null)
      const { data } = await supabase
        .from('staff_calendar_integrations')
        .select('*')
        .eq('profile_id', profileId)
        .order('provider')
      if (data) setIntegrations(data as CalendarIntegration[])
    }
  }

  const handleDisconnect = async (id: string) => {
    await supabase.from('staff_calendar_integrations').delete().eq('id', id)
    setIntegrations((prev) => prev.filter((i) => i.id !== id))
  }

  const handleAddOfficeHour = async () => {
    const { day_of_week, start_time, end_time } = newSlot
    if (end_time <= start_time) return
    setSaving(true)
    const { data } = await (supabase as any)
      .from('office_hours')
      .insert({
        profile_id: profileId,
        day_of_week,
        start_time,
        end_time,
      })
      .select()
      .single()
    setSaving(false)
    if (data) {
      setOfficeHours((prev) => [...prev, data as OfficeHour].sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)))
      setNewSlot({ day_of_week: 1, start_time: '09:00', end_time: '17:00' })
    }
  }

  const handleRemoveOfficeHour = async (id: string) => {
    await supabase.from('office_hours').delete().eq('id', id)
    setOfficeHours((prev) => prev.filter((oh) => oh.id !== id))
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading calendar and office hours...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-900">
            <Calendar className="text-primary w-5 h-5" />
            Calendar integration
          </CardTitle>
          <CardDescription>
            Connect your calendar so capacity analysis can account for busy times.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {integrations.length > 0 && (
            <ul className="space-y-2">
              {integrations.map((int) => (
                <li
                  key={int.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium capitalize">{int.provider}</span>
                    {int.calendar_name && (
                      <span className="text-sm text-slate-500">{int.calendar_name}</span>
                    )}
                    {int.sync_enabled && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-100">
                        Synced
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDisconnect(int.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={connectProvider ?? ''} onValueChange={setConnectProvider}>
              <SelectTrigger className="w-[200px] bg-white border-slate-200">
                <SelectValue placeholder="Add calendar" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleConnectCalendar}
              disabled={!connectProvider || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2">Connect</span>
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            OAuth and full sync will be configured in a future release. This records your preferred calendar for capacity planning.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-slate-900">
            <Clock className="text-primary w-5 h-5" />
            Office hours
          </CardTitle>
          <CardDescription>
            Set your recurring weekly availability for capacity analysis.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          {officeHours.length > 0 && (
            <ul className="space-y-2">
              {officeHours.map((oh) => (
                <li
                  key={oh.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium w-24">
                      {DAYS.find((d) => d.value === oh.day_of_week)?.label ?? 'Day'}
                    </span>
                    <span className="text-sm text-slate-600">
                      {formatTime(oh.start_time)} – {formatTime(oh.end_time)}
                    </span>
                    {oh.label && (
                      <span className="text-xs text-slate-500">({oh.label})</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemoveOfficeHour(oh.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Day</Label>
              <Select
                value={String(newSlot.day_of_week)}
                onValueChange={(v) => setNewSlot((s) => ({ ...s, day_of_week: Number(v) }))}
              >
                <SelectTrigger className="w-[130px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => (
                    <SelectItem key={d.value} value={String(d.value)}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Start</Label>
              <Input
                type="time"
                className="w-[120px] bg-white"
                value={newSlot.start_time}
                onChange={(e) => setNewSlot((s) => ({ ...s, start_time: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">End</Label>
              <Input
                type="time"
                className="w-[120px] bg-white"
                value={newSlot.end_time}
                onChange={(e) => setNewSlot((s) => ({ ...s, end_time: e.target.value }))}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleAddOfficeHour}
              disabled={saving || newSlot.end_time <= newSlot.start_time}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="ml-2">Add</span>
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            Capacity analysis uses office hours and calendar busy times to estimate availability.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, BarChart3, Sparkles, Settings } from 'lucide-react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return eh - sh + (em - sm) / 60
}

export default async function CapacityPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .single()

  type ProfileRow = { id: string; role: string }
  const role = (profile as ProfileRow | null)?.role ?? 'client'
  if (role !== 'staff' && role !== 'super_admin') {
    redirect('/dashboard')
  }

  const { data: officeHoursRows } = await supabase
    .from('office_hours')
    .select('*')
    .eq('user_id', user.id)
    .order('day_of_week')
    .order('start_time')

  const { data: integrationsRows } = await supabase
    .from('staff_calendar_integrations')
    .select('id, provider, calendar_name, sync_enabled')
    .eq('user_id', user.id)

  type OfficeHourRow = { id: string; start_time: string; end_time: string; day_of_week: number; label: string | null }
  type IntegrationRow = { id: string; provider: string; calendar_name: string | null; sync_enabled: boolean }
  const officeHours = (officeHoursRows ?? []) as OfficeHourRow[]
  const integrations = (integrationsRows ?? []) as IntegrationRow[]

  const totalHoursPerWeek =
    officeHours.reduce((sum, oh) => sum + hoursBetween(oh.start_time, oh.end_time), 0)
  const calendarConnected = integrations.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Capacity analysis</h2>
          <p className="text-slate-500 mt-1">
            Your availability and office hours for workload planning.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/dashboard/settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Calendar & office hours
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Weekly capacity
            </CardTitle>
            <CardDescription>Based on your office hours</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">
              {totalHoursPerWeek.toFixed(1)} <span className="text-lg font-normal text-slate-500">hours</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {totalHoursPerWeek === 0
                ? 'Add office hours in Settings to see capacity.'
                : 'Available for support and project work this week (recurring).'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Calendar integration
            </CardTitle>
            <CardDescription>Busy times from your calendar</CardDescription>
          </CardHeader>
          <CardContent>
            {calendarConnected ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-green-700">Connected</p>
                <ul className="text-sm text-slate-600">
                  {integrations.map((int) => (
                    <li key={int.id} className="capitalize">
                      {int.provider}
                      {int.calendar_name ? ` — ${int.calendar_name}` : ''}
                      {int.sync_enabled && ' (sync on)'}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-slate-500 mt-2">
                  Calendar busy times will be used in future capacity calculations.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Connect a calendar in Settings so capacity analysis can exclude busy times.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {officeHours && officeHours.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Your office hours
            </CardTitle>
            <CardDescription>Recurring weekly availability</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {officeHours.map((oh) => (
                <li
                  key={oh.id}
                  className="flex items-center gap-4 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-2"
                >
                  <span className="font-medium w-24 text-slate-700">
                    {DAYS[oh.day_of_week]}
                  </span>
                  <span className="text-sm text-slate-600">
                    {formatTime(oh.start_time)} – {formatTime(oh.end_time)}
                  </span>
                  {oh.label && (
                    <span className="text-xs text-slate-500">{oh.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI capacity analysis
          </CardTitle>
          <CardDescription>
            Insights from your office hours and calendar (when connected)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Capacity analysis with AI will combine your office hours and calendar busy times to
            estimate available capacity, suggest optimal scheduling, and flag overloaded periods.
          </p>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500 italic">
            {totalHoursPerWeek > 0
              ? `You have ${totalHoursPerWeek.toFixed(0)} hours of recurring availability per week. ${calendarConnected ? 'With your calendar connected, AI can refine this by excluding meetings and busy blocks.' : 'Connect your calendar in Settings to enable refined capacity estimates.'}`
              : 'Add office hours in Settings, then connect your calendar to enable AI capacity insights.'}
          </div>
          <p className="text-xs text-slate-500">
            Full AI-powered insights (e.g. suggested shifts, overload alerts) will be available in a future release.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

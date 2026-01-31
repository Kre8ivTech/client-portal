'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'

type Integration = {
  id: string
  provider: string
  status: string
  account_email: string | null
  last_synced_at: string | null
}

interface CalendarIntegrationsPanelProps {
  integrations: Integration[]
  calendars: {
    id: string
    integration_id: string
    name: string
    is_enabled: boolean
  }[]
  logs: {
    provider: string
    status: string
    message: string | null
    calendars_synced: number | null
    events_synced: number | null
    started_at: string
  }[]
}

export function CalendarIntegrationsPanel({
  integrations,
  calendars,
  logs,
}: CalendarIntegrationsPanelProps) {
  const router = useRouter()
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null)
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null)
  const [confirmProvider, setConfirmProvider] = useState<string | null>(null)
  const [calendarState, setCalendarState] = useState(calendars)
  const [error, setError] = useState<string | null>(null)

  const calendarsByIntegration = useMemo(() => {
    return calendarState.reduce<Record<string, typeof calendarState>>((acc, calendar) => {
      acc[calendar.integration_id] = acc[calendar.integration_id] || []
      acc[calendar.integration_id].push(calendar)
      return acc
    }, {})
  }, [calendarState])

  useEffect(() => {
    setCalendarState(calendars)
  }, [calendars])

  const handleSync = async (provider: string) => {
    setError(null)
    setSyncingProvider(provider)

    const response = await fetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider }),
    })

    if (!response.ok) {
      const payload = await response.json()
      setError(payload.error || 'Unable to sync calendars.')
    } else {
      router.refresh()
    }

    setSyncingProvider(null)
  }

  const handleDisconnect = async (provider: string) => {
    setError(null)
    setDisconnectingProvider(provider)

    const response = await fetch(`/api/calendar/disconnect/${provider}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const payload = await response.json()
      setError(payload.error || 'Unable to disconnect calendar.')
    } else {
      router.refresh()
    }

    setDisconnectingProvider(null)
  }

  const handleToggleCalendar = async (calendarId: string, isEnabled: boolean) => {
    setError(null)
    const response = await fetch(`/api/calendar/calendars/${calendarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: isEnabled }),
    })

    if (!response.ok) {
      const payload = await response.json()
      setError(payload.error || 'Unable to update calendar.')
      return
    }

    setCalendarState((prev) =>
      prev.map((calendar) =>
        calendar.id === calendarId ? { ...calendar, is_enabled: isEnabled } : calendar
      )
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/api/calendar/connect/google">Connect Google</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/api/calendar/connect/microsoft">Connect Microsoft</Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Calendar update failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {integrations.length > 0 ? (
        <div className="space-y-2 text-sm text-slate-600">
          {integrations.map((integration) => (
            <div
              key={integration.provider}
              className="flex flex-col gap-3 border rounded-lg px-3 py-3"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium capitalize">{integration.provider}</p>
                  <p className="text-xs text-slate-400">
                    {integration.account_email || 'No email on file'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {integration.last_synced_at
                      ? `Last synced ${format(new Date(integration.last_synced_at), 'MMM d, h:mm a')}`
                      : 'Not synced yet'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSync(integration.provider)}
                    disabled={syncingProvider === integration.provider}
                  >
                    {syncingProvider === integration.provider && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    Sync now
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmProvider(integration.provider)}
                    disabled={disconnectingProvider === integration.provider}
                  >
                    {disconnectingProvider === integration.provider && (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    )}
                    Disconnect
                  </Button>
                  <span className="text-xs uppercase tracking-wider text-slate-400 self-center">
                    {integration.status}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Calendars to Sync
                </p>
                {calendarsByIntegration[integration.id]?.length ? (
                  <div className="space-y-2">
                    {calendarsByIntegration[integration.id].map((calendar) => (
                      <label
                        key={calendar.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2 text-xs"
                      >
                        <span className="text-slate-600">{calendar.name}</span>
                        <input
                          type="checkbox"
                          checked={calendar.is_enabled}
                          onChange={(event) =>
                            handleToggleCalendar(calendar.id, event.target.checked)
                          }
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No calendars synced yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No calendars connected yet.</p>
      )}

      {logs.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Recent Sync Activity
          </p>
          <div className="space-y-2 text-xs text-slate-500">
            {logs.map((log, idx) => (
              <div
                key={`${log.provider}-${log.started_at}-${idx}`}
                className="flex flex-col gap-1 rounded-md border border-slate-100 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold capitalize text-slate-600">{log.provider}</span>
                  <span className="uppercase text-[10px] tracking-wider text-slate-400">
                    {log.status}
                  </span>
                </div>
                <span>
                  {format(new Date(log.started_at), 'MMM d, h:mm a')} ·{' '}
                  {log.calendars_synced || 0} calendars · {log.events_synced || 0} events
                </span>
                {log.message && <span className="text-slate-400">{log.message}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Disconnect calendar?</h3>
            <p className="mt-2 text-sm text-slate-500">
              This will remove {confirmProvider} access and delete synced events for this
              account.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setConfirmProvider(null)}
                disabled={disconnectingProvider !== null}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  const provider = confirmProvider
                  setConfirmProvider(null)
                  handleDisconnect(provider)
                }}
                disabled={disconnectingProvider !== null}
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

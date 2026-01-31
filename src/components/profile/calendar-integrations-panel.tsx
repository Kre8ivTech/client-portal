'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { format } from 'date-fns'

type Integration = {
  provider: string
  status: string
  account_email: string | null
  last_synced_at: string | null
}

interface CalendarIntegrationsPanelProps {
  integrations: Integration[]
}

export function CalendarIntegrationsPanel({ integrations }: CalendarIntegrationsPanelProps) {
  const router = useRouter()
  const [syncingProvider, setSyncingProvider] = useState<string | null>(null)
  const [disconnectingProvider, setDisconnectingProvider] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
              className="flex flex-col gap-3 border rounded-lg px-3 py-3 md:flex-row md:items-center md:justify-between"
            >
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
                  onClick={() => handleDisconnect(integration.provider)}
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
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No calendars connected yet.</p>
      )}
    </div>
  )
}

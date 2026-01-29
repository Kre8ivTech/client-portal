'use client'

import { useState } from 'react'
import { 
  Calendar,
  RefreshCw, 
  Unlink, 
  CheckCircle, 
  AlertCircle,
  Settings,
  ChevronDown,
  ExternalLink,
  Clock,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { cn, formatDistanceToNow } from '@/lib/utils'
import { CALENDAR_PROVIDERS } from '@/types/calendar'
import type { 
  CalendarConnection,
  CalendarProvider,
  SelectedCalendar,
  ConnectionStatus,
} from '@/types/calendar'

// =============================================================================
// STATUS CONFIG
// =============================================================================

const STATUS_CONFIG: Record<ConnectionStatus, {
  label: string
  color: string
  icon: typeof CheckCircle
}> = {
  active: {
    label: 'Connected',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: CheckCircle,
  },
  paused: {
    label: 'Paused',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Clock,
  },
  error: {
    label: 'Error',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertCircle,
  },
  expired: {
    label: 'Expired',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: AlertCircle,
  },
  revoked: {
    label: 'Disconnected',
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Unlink,
  },
}

// =============================================================================
// CONNECT CALENDAR BUTTON
// =============================================================================

interface ConnectCalendarButtonProps {
  provider: CalendarProvider
  onConnect: (provider: CalendarProvider) => void
  isConnecting?: boolean
  disabled?: boolean
  existingConnection?: CalendarConnection
}

export function ConnectCalendarButton({
  provider,
  onConnect,
  isConnecting = false,
  disabled = false,
  existingConnection,
}: ConnectCalendarButtonProps) {
  const config = CALENDAR_PROVIDERS[provider]
  
  if (existingConnection) {
    return null // Show CalendarConnectionCard instead
  }

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-3 h-auto py-4"
      onClick={() => onConnect(provider)}
      disabled={disabled || isConnecting}
    >
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${config.color}15` }}
      >
        {provider === 'google' ? (
          <GoogleIcon className="w-5 h-5" />
        ) : (
          <MicrosoftIcon className="w-5 h-5" />
        )}
      </div>
      <div className="text-left flex-1">
        <div className="font-medium">{config.displayName}</div>
        <div className="text-xs text-slate-500">
          Sync your calendar to show availability
        </div>
      </div>
      {isConnecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ExternalLink className="h-4 w-4 text-slate-400" />
      )}
    </Button>
  )
}

// =============================================================================
// CALENDAR CONNECTION CARD
// =============================================================================

interface CalendarConnectionCardProps {
  connection: CalendarConnection
  onDisconnect: () => void
  onSync: () => void
  onToggleSync: (enabled: boolean) => void
  isSyncing?: boolean
}

export function CalendarConnectionCard({
  connection,
  onDisconnect,
  onSync,
  onToggleSync,
  isSyncing = false,
}: CalendarConnectionCardProps) {
  const [showSettings, setShowSettings] = useState(false)
  const config = CALENDAR_PROVIDERS[connection.provider]
  const statusConfig = STATUS_CONFIG[connection.status]
  const StatusIcon = statusConfig.icon

  return (
    <Card className={cn(
      'relative',
      connection.status === 'error' && 'border-red-200'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${config.color}15` }}
            >
              {connection.provider === 'google' ? (
                <GoogleIcon className="w-5 h-5" />
              ) : (
                <MicrosoftIcon className="w-5 h-5" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">{config.displayName}</CardTitle>
              <CardDescription className="text-xs">
                {connection.provider_email || 'Connected account'}
              </CardDescription>
            </div>
          </div>
          
          <Badge variant="outline" className={cn('text-xs', statusConfig.color)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error message */}
        {connection.status === 'error' && connection.last_sync_error && (
          <div className="p-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
            {connection.last_sync_error}
          </div>
        )}

        {/* Sync stats */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-slate-500">
            <Calendar className="h-4 w-4" />
            <span>
              {connection.events_synced_count} events synced
            </span>
          </div>
          
          {connection.last_sync_at && (
            <div className="text-xs text-slate-400">
              Last sync: {formatDistanceToNow(connection.last_sync_at)}
            </div>
          )}
        </div>

        {/* Selected calendars */}
        {connection.selected_calendars.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {connection.selected_calendars
              .filter(c => c.sync)
              .slice(0, 3)
              .map(cal => (
                <Badge key={cal.id} variant="secondary" className="text-xs">
                  {cal.name}
                </Badge>
              ))}
            {connection.selected_calendars.filter(c => c.sync).length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{connection.selected_calendars.filter(c => c.sync).length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={isSyncing || connection.status !== 'active'}
            className="flex-1"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Now
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
            <ChevronDown className={cn(
              'h-4 w-4 ml-1 transition-transform',
              showSettings && 'rotate-180'
            )} />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Unlink className="h-4 w-4" />
          </Button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="pt-4 border-t space-y-4">
            <SyncSettingsPanel 
              connection={connection}
              onToggleSync={onToggleSync}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =============================================================================
// SYNC SETTINGS PANEL
// =============================================================================

interface SyncSettingsPanelProps {
  connection: CalendarConnection
  onToggleSync: (enabled: boolean) => void
}

function SyncSettingsPanel({ connection, onToggleSync }: SyncSettingsPanelProps) {
  return (
    <div className="space-y-4">
      {/* Enable/disable sync */}
      <div className="flex items-center justify-between">
        <Label htmlFor="sync-enabled" className="text-sm">
          Automatic sync
        </Label>
        <Button
          id="sync-enabled"
          variant={connection.sync_enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => onToggleSync(!connection.sync_enabled)}
        >
          {connection.sync_enabled ? 'Enabled' : 'Disabled'}
        </Button>
      </div>

      {/* Sync options */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between py-1">
          <span className="text-slate-600">Sync busy time only</span>
          <span className="text-slate-900">{connection.sync_busy_only ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-slate-600">Include all-day events</span>
          <span className="text-slate-900">{connection.sync_all_day_events ? 'Yes' : 'No'}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-slate-600">Sync range</span>
          <span className="text-slate-900">
            {connection.sync_days_behind}d ago to {connection.sync_days_ahead}d ahead
          </span>
        </div>
      </div>

      {/* Calendar selection */}
      {connection.selected_calendars.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Calendars</Label>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {connection.selected_calendars.map(cal => (
              <div 
                key={cal.id}
                className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-50"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: cal.color || '#6B7280' }}
                  />
                  <span className="text-sm">{cal.name}</span>
                  {cal.is_primary && (
                    <Badge variant="secondary" className="text-xs">Primary</Badge>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {cal.sync ? 'Syncing' : 'Not syncing'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// CALENDAR CONNECTIONS LIST
// =============================================================================

interface CalendarConnectionsListProps {
  connections: CalendarConnection[]
  onConnect: (provider: CalendarProvider) => void
  onDisconnect: (connectionId: string) => void
  onSync: (connectionId: string) => void
  onToggleSync: (connectionId: string, enabled: boolean) => void
  connectingProvider?: CalendarProvider | null
  syncingConnectionId?: string | null
}

export function CalendarConnectionsList({
  connections,
  onConnect,
  onDisconnect,
  onSync,
  onToggleSync,
  connectingProvider,
  syncingConnectionId,
}: CalendarConnectionsListProps) {
  const googleConnection = connections.find(c => c.provider === 'google')
  const microsoftConnection = connections.find(c => c.provider === 'microsoft')

  return (
    <div className="space-y-4">
      {/* Existing connections */}
      {googleConnection && (
        <CalendarConnectionCard
          connection={googleConnection}
          onDisconnect={() => onDisconnect(googleConnection.id)}
          onSync={() => onSync(googleConnection.id)}
          onToggleSync={(enabled) => onToggleSync(googleConnection.id, enabled)}
          isSyncing={syncingConnectionId === googleConnection.id}
        />
      )}
      
      {microsoftConnection && (
        <CalendarConnectionCard
          connection={microsoftConnection}
          onDisconnect={() => onDisconnect(microsoftConnection.id)}
          onSync={() => onSync(microsoftConnection.id)}
          onToggleSync={(enabled) => onToggleSync(microsoftConnection.id, enabled)}
          isSyncing={syncingConnectionId === microsoftConnection.id}
        />
      )}

      {/* Connect buttons for unconnected providers */}
      {!googleConnection && (
        <ConnectCalendarButton
          provider="google"
          onConnect={onConnect}
          isConnecting={connectingProvider === 'google'}
        />
      )}
      
      {!microsoftConnection && (
        <ConnectCalendarButton
          provider="microsoft"
          onConnect={onConnect}
          isConnecting={connectingProvider === 'microsoft'}
        />
      )}

      {/* No connections message */}
      {connections.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">
          Connect your work calendar to automatically sync your availability.
          This helps provide accurate completion estimates to clients.
        </p>
      )}
    </div>
  )
}

// =============================================================================
// ICONS
// =============================================================================

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  )
}

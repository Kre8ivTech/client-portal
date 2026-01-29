/**
 * Calendar Sync Types for KT-Portal
 * Supports Google Calendar and Microsoft Office 365/Outlook integration
 */

// =============================================================================
// PROVIDER TYPES
// =============================================================================

export type CalendarProvider = 'google' | 'microsoft'

export type ConnectionStatus = 'active' | 'paused' | 'error' | 'expired' | 'revoked'

export type SyncDirection = 'import' | 'export' | 'bidirectional'

export type SyncType = 'full' | 'incremental' | 'manual'

export type SyncStatus = 'running' | 'completed' | 'failed' | 'partial'

// =============================================================================
// CALENDAR CONNECTION
// =============================================================================

export interface CalendarConnection {
  id: string
  profile_id: string
  
  // Provider info
  provider: CalendarProvider
  provider_account_id: string | null
  provider_email: string | null
  
  // Sync settings
  sync_enabled: boolean
  sync_direction: SyncDirection
  selected_calendars: SelectedCalendar[]
  
  // What to sync
  sync_busy_only: boolean
  sync_all_day_events: boolean
  sync_private_events: boolean
  sync_days_ahead: number
  sync_days_behind: number
  
  // Status
  status: ConnectionStatus
  last_sync_at: string | null
  last_sync_status: string | null
  last_sync_error: string | null
  events_synced_count: number
  
  // Metadata
  connected_at: string
  created_at: string
  updated_at: string
}

export interface SelectedCalendar {
  id: string
  name: string
  color?: string
  sync: boolean
  is_primary?: boolean
}

// =============================================================================
// SYNC LOG
// =============================================================================

export interface CalendarSyncLog {
  id: string
  connection_id: string
  
  sync_type: SyncType
  started_at: string
  completed_at: string | null
  
  status: SyncStatus
  
  events_fetched: number
  events_created: number
  events_updated: number
  events_deleted: number
  
  error_message: string | null
  error_details: Record<string, unknown> | null
  
  sync_token: string | null
  
  created_at: string
}

// =============================================================================
// EXTERNAL CALENDAR EVENT (from provider)
// =============================================================================

export interface ExternalCalendarEvent {
  id: string
  uid: string // iCal UID
  calendar_id: string
  calendar_name: string
  
  title: string
  description: string | null
  location: string | null
  
  start: string // ISO datetime
  end: string // ISO datetime
  all_day: boolean
  timezone: string | null
  
  // Busy/free status
  show_as: 'busy' | 'free' | 'tentative' | 'out_of_office'
  
  // Privacy
  is_private: boolean
  
  // Recurrence
  is_recurring: boolean
  recurrence_rule: string | null
  
  // Metadata
  organizer_email: string | null
  attendees_count: number
  
  // Provider-specific
  provider_data?: Record<string, unknown>
}

// =============================================================================
// OAUTH FLOW
// =============================================================================

export interface OAuthState {
  provider: CalendarProvider
  profile_id: string
  redirect_url: string
  nonce: string
  expires_at: number
}

export interface OAuthTokens {
  access_token: string
  refresh_token: string | null
  expires_at: number
  token_type: string
  scopes: string[]
}

// =============================================================================
// PROVIDER CONFIGURATION
// =============================================================================

export const CALENDAR_PROVIDERS: Record<CalendarProvider, {
  name: string
  displayName: string
  icon: string
  color: string
  authUrl: string
  tokenUrl: string
  scopes: string[]
  calendarListEndpoint: string
  eventsEndpoint: string
}> = {
  google: {
    name: 'google',
    displayName: 'Google Calendar',
    icon: 'google',
    color: '#4285F4',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events.readonly',
    ],
    calendarListEndpoint: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    eventsEndpoint: 'https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events',
  },
  microsoft: {
    name: 'microsoft',
    displayName: 'Microsoft 365 / Outlook',
    icon: 'microsoft',
    color: '#0078D4',
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scopes: [
      'offline_access',
      'Calendars.Read',
      'User.Read',
    ],
    calendarListEndpoint: 'https://graph.microsoft.com/v1.0/me/calendars',
    eventsEndpoint: 'https://graph.microsoft.com/v1.0/me/calendars/{calendarId}/events',
  },
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface ConnectCalendarRequest {
  provider: CalendarProvider
  code: string
  redirect_uri: string
  state: string
}

export interface UpdateConnectionRequest {
  sync_enabled?: boolean
  sync_direction?: SyncDirection
  selected_calendars?: SelectedCalendar[]
  sync_busy_only?: boolean
  sync_all_day_events?: boolean
  sync_private_events?: boolean
  sync_days_ahead?: number
  sync_days_behind?: number
}

export interface CalendarListResponse {
  calendars: SelectedCalendar[]
  primary_calendar_id: string | null
}

export interface SyncResult {
  success: boolean
  events_fetched: number
  events_created: number
  events_updated: number
  events_deleted: number
  errors: string[]
  next_sync_token?: string
}

// =============================================================================
// COMPONENT PROPS
// =============================================================================

export interface CalendarConnectionCardProps {
  connection: CalendarConnection
  onDisconnect: () => void
  onSync: () => void
  onUpdateSettings: (settings: UpdateConnectionRequest) => void
  isSyncing?: boolean
}

export interface ConnectCalendarButtonProps {
  provider: CalendarProvider
  onConnect: (provider: CalendarProvider) => void
  isConnecting?: boolean
  disabled?: boolean
}

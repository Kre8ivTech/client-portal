/**
 * Calendar Sync Service
 * Fetches events from Google and Microsoft calendars
 */

import { CALENDAR_PROVIDERS } from '@/types/calendar'
import type { 
  CalendarProvider,
  CalendarConnection,
  ExternalCalendarEvent,
  SelectedCalendar,
  SyncResult,
  CalendarListResponse,
} from '@/types/calendar'

// =============================================================================
// FETCH CALENDAR LIST
// =============================================================================

/**
 * Get list of calendars from provider
 */
export async function fetchCalendarList(
  provider: CalendarProvider,
  accessToken: string
): Promise<CalendarListResponse> {
  if (provider === 'google') {
    return fetchGoogleCalendarList(accessToken)
  }
  return fetchMicrosoftCalendarList(accessToken)
}

async function fetchGoogleCalendarList(
  accessToken: string
): Promise<CalendarListResponse> {
  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch Google calendars: ${response.statusText}`)
  }

  const data = await response.json()
  
  const calendars: SelectedCalendar[] = (data.items || []).map((cal: any) => ({
    id: cal.id,
    name: cal.summary || cal.id,
    color: cal.backgroundColor,
    sync: cal.primary || false,
    is_primary: cal.primary || false,
  }))

  const primaryCalendar = calendars.find(c => c.is_primary)

  return {
    calendars,
    primary_calendar_id: primaryCalendar?.id || null,
  }
}

async function fetchMicrosoftCalendarList(
  accessToken: string
): Promise<CalendarListResponse> {
  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me/calendars',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch Microsoft calendars: ${response.statusText}`)
  }

  const data = await response.json()
  
  const calendars: SelectedCalendar[] = (data.value || []).map((cal: any) => ({
    id: cal.id,
    name: cal.name,
    color: cal.hexColor,
    sync: cal.isDefaultCalendar || false,
    is_primary: cal.isDefaultCalendar || false,
  }))

  const primaryCalendar = calendars.find(c => c.is_primary)

  return {
    calendars,
    primary_calendar_id: primaryCalendar?.id || null,
  }
}

// =============================================================================
// FETCH EVENTS
// =============================================================================

/**
 * Fetch events from a calendar
 */
export async function fetchCalendarEvents(
  provider: CalendarProvider,
  accessToken: string,
  calendarId: string,
  options: {
    timeMin: Date
    timeMax: Date
    syncToken?: string
  }
): Promise<{
  events: ExternalCalendarEvent[]
  nextSyncToken?: string
}> {
  if (provider === 'google') {
    return fetchGoogleEvents(accessToken, calendarId, options)
  }
  return fetchMicrosoftEvents(accessToken, calendarId, options)
}

async function fetchGoogleEvents(
  accessToken: string,
  calendarId: string,
  options: {
    timeMin: Date
    timeMax: Date
    syncToken?: string
  }
): Promise<{
  events: ExternalCalendarEvent[]
  nextSyncToken?: string
}> {
  const params = new URLSearchParams({
    maxResults: '250',
    singleEvents: 'true',
    orderBy: 'startTime',
  })

  if (options.syncToken) {
    params.set('syncToken', options.syncToken)
  } else {
    params.set('timeMin', options.timeMin.toISOString())
    params.set('timeMax', options.timeMax.toISOString())
  }

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    // Sync token might be invalid, need full sync
    if (response.status === 410 && options.syncToken) {
      return fetchGoogleEvents(accessToken, calendarId, {
        ...options,
        syncToken: undefined,
      })
    }
    throw new Error(`Failed to fetch Google events: ${response.statusText}`)
  }

  const data = await response.json()
  
  const events: ExternalCalendarEvent[] = (data.items || [])
    .filter((e: any) => e.status !== 'cancelled')
    .map((event: any) => normalizeGoogleEvent(event, calendarId))

  return {
    events,
    nextSyncToken: data.nextSyncToken,
  }
}

async function fetchMicrosoftEvents(
  accessToken: string,
  calendarId: string,
  options: {
    timeMin: Date
    timeMax: Date
    syncToken?: string
  }
): Promise<{
  events: ExternalCalendarEvent[]
  nextSyncToken?: string
}> {
  // Microsoft uses deltaToken for incremental sync
  let url: string
  
  if (options.syncToken) {
    url = options.syncToken // Delta link is a full URL
  } else {
    const params = new URLSearchParams({
      '$select': 'id,subject,body,start,end,isAllDay,showAs,sensitivity,organizer,attendees,recurrence,iCalUId',
      '$filter': `start/dateTime ge '${options.timeMin.toISOString()}' and end/dateTime le '${options.timeMax.toISOString()}'`,
      '$top': '250',
      '$orderby': 'start/dateTime',
    })
    
    url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events?${params}`
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch Microsoft events: ${response.statusText}`)
  }

  const data = await response.json()
  
  const events: ExternalCalendarEvent[] = (data.value || [])
    .map((event: any) => normalizeMicrosoftEvent(event, calendarId))

  // Handle pagination
  let allEvents = events
  let nextLink = data['@odata.nextLink']
  
  while (nextLink) {
    const pageResponse = await fetch(nextLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    
    if (!pageResponse.ok) break
    
    const pageData = await pageResponse.json()
    allEvents = [...allEvents, ...(pageData.value || []).map((e: any) => normalizeMicrosoftEvent(e, calendarId))]
    nextLink = pageData['@odata.nextLink']
  }

  return {
    events: allEvents,
    nextSyncToken: data['@odata.deltaLink'],
  }
}

// =============================================================================
// NORMALIZE EVENTS
// =============================================================================

function normalizeGoogleEvent(event: any, calendarId: string): ExternalCalendarEvent {
  const isAllDay = !!event.start?.date
  
  return {
    id: event.id,
    uid: event.iCalUID || event.id,
    calendar_id: calendarId,
    calendar_name: '', // Filled in by caller
    
    title: event.summary || '(No title)',
    description: event.description || null,
    location: event.location || null,
    
    start: isAllDay ? event.start.date : event.start.dateTime,
    end: isAllDay ? event.end.date : event.end.dateTime,
    all_day: isAllDay,
    timezone: event.start.timeZone || null,
    
    show_as: mapGoogleTransparency(event.transparency),
    
    is_private: event.visibility === 'private',
    
    is_recurring: !!event.recurringEventId,
    recurrence_rule: event.recurrence?.[0] || null,
    
    organizer_email: event.organizer?.email || null,
    attendees_count: event.attendees?.length || 0,
    
    provider_data: {
      etag: event.etag,
      htmlLink: event.htmlLink,
    },
  }
}

function normalizeMicrosoftEvent(event: any, calendarId: string): ExternalCalendarEvent {
  return {
    id: event.id,
    uid: event.iCalUId || event.id,
    calendar_id: calendarId,
    calendar_name: '',
    
    title: event.subject || '(No title)',
    description: event.body?.content || null,
    location: event.location?.displayName || null,
    
    start: event.start.dateTime,
    end: event.end.dateTime,
    all_day: event.isAllDay || false,
    timezone: event.start.timeZone || null,
    
    show_as: mapMicrosoftShowAs(event.showAs),
    
    is_private: event.sensitivity === 'private',
    
    is_recurring: !!event.recurrence,
    recurrence_rule: event.recurrence?.pattern?.type || null,
    
    organizer_email: event.organizer?.emailAddress?.address || null,
    attendees_count: event.attendees?.length || 0,
    
    provider_data: {
      webLink: event.webLink,
      changeKey: event['@odata.etag'],
    },
  }
}

function mapGoogleTransparency(transparency: string | undefined): ExternalCalendarEvent['show_as'] {
  if (transparency === 'transparent') return 'free'
  return 'busy'
}

function mapMicrosoftShowAs(showAs: string | undefined): ExternalCalendarEvent['show_as'] {
  switch (showAs) {
    case 'free': return 'free'
    case 'tentative': return 'tentative'
    case 'oof': return 'out_of_office'
    default: return 'busy'
  }
}

// =============================================================================
// FULL SYNC OPERATION
// =============================================================================

/**
 * Perform a full calendar sync for a connection
 */
export async function syncCalendarConnection(
  connection: CalendarConnection,
  accessToken: string,
  options: {
    onProgress?: (message: string) => void
  } = {}
): Promise<SyncResult> {
  const { onProgress } = options
  const errors: string[] = []
  
  let totalFetched = 0
  let totalCreated = 0
  let totalUpdated = 0
  let totalDeleted = 0
  
  const timeMin = new Date()
  timeMin.setDate(timeMin.getDate() - connection.sync_days_behind)
  
  const timeMax = new Date()
  timeMax.setDate(timeMax.getDate() + connection.sync_days_ahead)

  // Determine which calendars to sync
  const calendarsToSync = connection.selected_calendars.filter(c => c.sync)
  
  if (calendarsToSync.length === 0) {
    // If no calendars selected, try to sync primary
    const { calendars, primary_calendar_id } = await fetchCalendarList(
      connection.provider,
      accessToken
    )
    
    if (primary_calendar_id) {
      const primaryCal = calendars.find(c => c.id === primary_calendar_id)
      if (primaryCal) {
        calendarsToSync.push(primaryCal)
      }
    }
  }

  onProgress?.(`Syncing ${calendarsToSync.length} calendar(s)...`)

  for (const calendar of calendarsToSync) {
    try {
      onProgress?.(`Fetching events from "${calendar.name}"...`)
      
      const { events } = await fetchCalendarEvents(
        connection.provider,
        accessToken,
        calendar.id,
        { timeMin, timeMax }
      )

      // Filter based on connection settings
      const filteredEvents = events.filter(event => {
        // Skip free time if sync_busy_only
        if (connection.sync_busy_only && event.show_as === 'free') {
          return false
        }
        
        // Skip all-day events if not syncing them
        if (!connection.sync_all_day_events && event.all_day) {
          return false
        }
        
        // Skip private events if not syncing them
        if (!connection.sync_private_events && event.is_private) {
          return false
        }
        
        return true
      })

      totalFetched += filteredEvents.length
      
      // In a real implementation, this would call the database upsert function
      // For now, we just count
      onProgress?.(`Found ${filteredEvents.length} events in "${calendar.name}"`)
      
      // Mark events for create/update (simplified - real implementation would diff)
      totalCreated += filteredEvents.length

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Failed to sync "${calendar.name}": ${message}`)
    }
  }

  return {
    success: errors.length === 0,
    events_fetched: totalFetched,
    events_created: totalCreated,
    events_updated: totalUpdated,
    events_deleted: totalDeleted,
    errors,
  }
}

// =============================================================================
// CONVERT TO CALENDAR BLOCK
// =============================================================================

/**
 * Convert external event to calendar block format
 */
export function eventToCalendarBlock(
  event: ExternalCalendarEvent,
  connectionId: string,
  syncSource: CalendarProvider
): {
  block_type: string
  title: string
  description: string | null
  start_at: string
  end_at: string
  all_day: boolean
  external_event_uid: string
  external_calendar_name: string
  is_synced: boolean
  sync_source: string
  connection_id: string
} {
  // Map show_as to block_type
  let blockType: string
  switch (event.show_as) {
    case 'out_of_office':
      blockType = 'out_of_office'
      break
    case 'tentative':
      blockType = 'meeting'
      break
    default:
      blockType = 'meeting'
  }

  // For all-day events or out of office, might be time_off
  if (event.all_day && event.show_as !== 'free') {
    blockType = 'time_off'
  }

  return {
    block_type: blockType,
    title: event.title,
    description: event.description,
    start_at: event.start,
    end_at: event.end,
    all_day: event.all_day,
    external_event_uid: event.uid,
    external_calendar_name: event.calendar_name,
    is_synced: true,
    sync_source: syncSource,
    connection_id: connectionId,
  }
}

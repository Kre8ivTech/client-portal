/**
 * Calendar Sync Module
 * 
 * Provides integration with external calendars (Google Calendar, Microsoft 365)
 * to sync staff availability for workload planning and completion estimates.
 */

// OAuth
export {
  getAuthorizationUrl,
  validateState,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeTokens,
  getUserInfo,
} from './oauth'

// Sync
export {
  fetchCalendarList,
  fetchCalendarEvents,
  syncCalendarConnection,
  eventToCalendarBlock,
} from './sync'

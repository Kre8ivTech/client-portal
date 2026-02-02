# Ticket Notification System

Comprehensive multi-channel notification system for support tickets with SLA tracking.

## Features

### Notification Channels

- **Email** (via Resend) - Production-ready email notifications
- **SMS** (via Twilio) - Text message alerts for urgent notifications
- **Slack** (via Webhooks) - Organization-wide notifications to Slack channels
- **WhatsApp** (via Twilio) - WhatsApp business messaging

### Notification Events

- **Ticket Created** - When a new support ticket is created
- **Ticket Updated** - When ticket status or details change
- **Ticket Comment** - When someone adds a comment
- **Ticket Assigned** - When a ticket is assigned to staff
- **Ticket Resolved** - When a ticket is marked as resolved
- **Ticket Closed** - When a ticket is closed
- **SLA Warning** - When a ticket is approaching its SLA deadline
- **SLA Breach** - When a ticket has breached its SLA deadline

### SLA Tracking

The system includes intelligent SLA tracking with visual indicators:

- **Red (Breach/Critical)** - Past deadline or < 1 hour remaining
- **Yellow (Warning)** - < 25% time remaining
- **Orange (Upcoming)** - < 50% time remaining
- **Green (On Track)** - > 50% time remaining

#### Priority Client Support

Organizations marked as "Priority Clients" receive:
- **50% faster SLA response times**
- Priority indicators in ticket displays
- Enhanced notification priority

#### Response Time SLAs

**Standard Clients:**
- Critical: 1h first response / 4h resolution
- High: 4h first response / 24h resolution
- Medium: 8h first response / 48h resolution
- Low: 24h first response / 72h resolution

**Priority Clients (50% reduction):**
- Critical: 30min first response / 2h resolution
- High: 2h first response / 12h resolution
- Medium: 4h first response / 24h resolution
- Low: 12h first response / 36h resolution

## Setup

### 1. Environment Variables

Add the following to your `.env.local`:

```bash
# Email (Resend)
RESEND_API_KEY=re_...

# SMS & WhatsApp (Twilio)
TWILIO_ACCOUNT_SID=ACxxxx...
TWILIO_AUTH_TOKEN=xxxx...
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

# Cron Job Security
CRON_SECRET=your-secret-key-here

# App URL
NEXT_PUBLIC_APP_URL=https://your-app.com
```

### 2. Database Migration

Run the notification system migration:

```bash
supabase db push
```

This creates:
- `notification_log` table for audit trail
- `notification_preferences` columns on `users` and `organizations`
- `is_priority_client` flag on `organizations`
- Enhanced SLA calculation functions

### 3. Cron Job Setup

The SLA check runs automatically every 15 minutes via Vercel Cron:

```json
{
  "crons": [
    {
      "path": "/api/notifications/sla-check",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

For security, set `CRON_SECRET` in your environment variables.

## Usage

### User Notification Preferences

Users can configure their notification preferences at:
`/dashboard/settings/notifications`

Options include:
- Enable/disable each channel (Email, SMS, WhatsApp)
- Configure phone numbers for SMS/WhatsApp
- Choose which events trigger notifications
- Configure SLA alert preferences

### Organization Notification Settings

Staff and admins can configure organization-wide settings:

- **Slack Integration**: Set up webhook URL for channel notifications
- **Event Configuration**: Choose which events trigger org-wide alerts
- **Priority Client Status**: Mark organizations as priority clients

### Triggering Notifications Programmatically

Use the helper functions in your server actions:

```typescript
import {
  notifyTicketCreated,
  notifyTicketComment,
  notifyTicketAssigned,
} from '@/lib/actions/ticket-notifications'

// When creating a ticket
await notifyTicketCreated(
  ticket.id,
  ticket.ticket_number,
  ticket.subject,
  ticket.priority
)

// When adding a comment
await notifyTicketComment(
  ticket.id,
  ticket.ticket_number,
  ticket.subject,
  commenterName,
  comment.content
)

// When assigning a ticket
await notifyTicketAssigned(
  ticket.id,
  ticket.ticket_number,
  ticket.subject,
  assigneeName,
  ticket.priority
)
```

### Direct API Usage

POST to `/api/notifications/ticket`:

```json
{
  "ticketId": "uuid",
  "notificationType": "ticket_created",
  "context": {
    "ticketNumber": 123,
    "ticketSubject": "Issue with login",
    "priority": "high"
  }
}
```

## Architecture

### Notification Flow

```
Ticket Event
  → Notification API (/api/notifications/ticket)
    → Build Payloads (determine recipients & channels)
      → Send via Providers (Email/SMS/Slack/WhatsApp)
        → Log to Database (notification_log)
```

### Provider Files

- `src/lib/notifications/providers/email.ts` - Resend email provider
- `src/lib/notifications/providers/sms.ts` - Twilio SMS provider
- `src/lib/notifications/providers/slack.ts` - Slack webhook provider
- `src/lib/notifications/providers/whatsapp.ts` - Twilio WhatsApp provider

### SLA Tracking

The SLA check cron job:
1. Queries `get_tickets_needing_sla_notifications()` function
2. Identifies tickets approaching or past deadlines
3. Sends warning/breach notifications
4. Prevents duplicate notifications within 1 hour

## Features

### Ticket List Enhancements

- **Client Filter**: Filter tickets by organization (staff/admins only)
- **SLA Status Filter**: Filter by SLA status (breach, critical, warning, on-track)
- **Visual SLA Indicators**: Color-coded rows based on SLA status
- **Priority Client Badges**: Visual indicator for priority client tickets

### Archive System

Access archived tickets at `/dashboard/tickets/archive`

- View all resolved, closed, and cancelled tickets
- Separate from active ticket view
- Full audit trail preserved
- Searchable and filterable

### Notification Audit Log

All sent notifications are logged in the `notification_log` table:

- Recipient information
- Notification type and channel
- Message content
- Delivery status (sent/failed)
- Provider response (message IDs)
- Error messages (if failed)
- Timestamps

## Monitoring

### Check Notification Logs

Query the notification log:

```sql
SELECT 
  notification_type,
  channel,
  status,
  COUNT(*) as count
FROM notification_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY notification_type, channel, status;
```

### Failed Notifications

Find failed notifications:

```sql
SELECT *
FROM notification_log
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 50;
```

### SLA Performance

Check SLA compliance:

```sql
SELECT 
  priority,
  COUNT(*) as total_tickets,
  COUNT(*) FILTER (WHERE first_response_at IS NOT NULL) as responded,
  COUNT(*) FILTER (WHERE first_response_at < first_response_due_at) as on_time_response,
  COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) as resolved,
  COUNT(*) FILTER (WHERE resolved_at < sla_due_at) as on_time_resolution
FROM tickets
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY priority;
```

## Troubleshooting

### Notifications Not Sending

1. **Check Environment Variables**: Ensure all API keys are configured
2. **Check User Preferences**: Verify user has enabled the channel
3. **Check Notification Log**: Query for errors in `notification_log`
4. **Check Provider Status**: Verify Resend/Twilio service status

### SLA Checks Not Running

1. **Verify Cron Secret**: Ensure `CRON_SECRET` matches in Vercel settings
2. **Check Vercel Logs**: View cron execution logs in Vercel dashboard
3. **Test Manually**: Call `/api/notifications/sla-check` with Bearer token

### Slack Notifications Failing

1. **Verify Webhook URL**: Test webhook URL in Slack settings
2. **Check Organization Settings**: Ensure Slack is enabled in org preferences
3. **Review Error Logs**: Check `notification_log` for specific errors

## Best Practices

1. **User Consent**: Always respect user notification preferences
2. **Rate Limiting**: Avoid sending duplicate notifications within short periods
3. **Priority Handling**: Send critical SLA breach notifications immediately
4. **Audit Trail**: Maintain complete notification logs for compliance
5. **Error Handling**: Log all failures for debugging and monitoring
6. **Testing**: Test notification flows in development before production
7. **Privacy**: Never expose sensitive data in notification content
8. **Formatting**: Keep messages concise and actionable

## Future Enhancements

Potential improvements:

- **Push Notifications**: Browser push notifications for in-app alerts
- **Digest Emails**: Batched daily/weekly summary emails
- **Custom Templates**: User-configurable notification templates
- **A/B Testing**: Test different notification formats
- **Delivery Optimization**: Smart timing based on user activity
- **Read Receipts**: Track when notifications are opened
- **Do Not Disturb**: Honor user quiet hours
- **Team Mentions**: @mention team members in notifications

## Support

For issues or questions about the notification system:
1. Check the notification logs in the database
2. Review the Vercel deployment logs
3. Test notification delivery manually via API
4. Contact the development team with specific error details

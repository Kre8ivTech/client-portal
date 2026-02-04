# Task Submission Notifications System

## Overview

This system provides email notifications to admin and assigned staff when service requests or project requests are submitted by clients. The system includes:

1. **Immediate Notifications** - Sent when a task is submitted
2. **Acknowledgement Links** - Each notification includes a unique link for staff to acknowledge receipt
3. **24-Hour Reminders** - Automatic reminders sent for unacknowledged tasks after 24 hours

## Architecture

### Database Schema

#### task_acknowledgements Table
- Tracks which staff members should acknowledge a task
- Stores unique acknowledgement tokens for secure links
- Records when acknowledgements are made
- Tokens expire after 24 hours

Key columns:
- `task_type`: 'service_request' or 'project_request'
- `task_id`: UUID of the task
- `acknowledged_by`: UUID of the staff member
- `acknowledged_at`: Timestamp when acknowledged (NULL until acknowledged)
- `acknowledgement_token`: Unique UUID for the acknowledgement link
- `token_expires_at`: Token expiration (24 hours from creation)

### Email Templates

Three new email templates are included:

1. **new_service_request** - Sent when a service request is submitted
2. **new_project_request** - Sent when a project request is submitted
3. **task_acknowledgement_reminder** - Sent when a task is unacknowledged for 24+ hours

Templates include:
- Task details (request number, priority, client info)
- Acknowledgement button with unique token link
- Link to view the full request in the portal

### Notification Flow

```
Client submits task
  → Task created in database
  → API triggers notifyServiceRequestCreated() or notifyProjectRequestCreated()
  → buildTaskNotificationPayloads() is called:
    - Fetches task details
    - Queries staff_assignments for assigned staff
    - Queries for all admin/staff users in the organization
    - Creates acknowledgement record for each recipient
    - Generates unique acknowledgement tokens
    - Builds email payloads with acknowledgement links
  → Emails sent to all recipients
  → Acknowledgement records stored (acknowledged_at = NULL)
```

### Acknowledgement Flow

```
Staff clicks acknowledgement link in email
  → GET /api/tasks/acknowledge?token=xxx
  → Token validation:
    - Check token exists
    - Check token not expired
    - Check not already acknowledged
  → Update task_acknowledgements:
    - Set acknowledged_at to current timestamp
  → Redirect to task page with success message
```

### 24-Hour Reminder Flow

```
Cron job runs every hour
  → GET /api/cron/task-acknowledgement-check
  → Query unacknowledged tasks:
    - acknowledged_at IS NULL
    - created_at < 24 hours ago
    - token_expires_at > now (not expired)
  → For each unacknowledged task:
    - Fetch task details
    - Calculate hours since submission
    - Get list of who has already acknowledged
    - Send reminder email to each unacknowledged recipient
  → Log results
```

## Implementation

### 1. Database Migrations

Run these migrations to set up the system:

```bash
# Migration for task_acknowledgements table
supabase/migrations/20260204160000_task_acknowledgements.sql

# Migration for email templates
supabase/migrations/20260204160001_task_notification_email_templates.sql
```

### 2. API Endpoints

**Task Notifications**
- `POST /api/notifications/task` - Send notifications for task events

**Acknowledgements**
- `GET /api/tasks/acknowledge?token=xxx` - Handle acknowledgement link clicks
- `POST /api/tasks/acknowledge` - Acknowledge via API (with optional notes)

**Cron Jobs**
- `GET /api/cron/task-acknowledgement-check` - Check for unacknowledged tasks (runs hourly)

### 3. Server Actions

**Task Notifications** (`src/lib/actions/task-notifications.ts`)
- `notifyServiceRequestCreated()` - Notify when service request is created
- `notifyServiceRequestAssigned()` - Notify when staff assigned to service request
- `notifyServiceRequestUpdated()` - Notify when service request is updated
- `notifyProjectRequestCreated()` - Notify when project request is created
- `notifyProjectRequestAssigned()` - Notify when staff assigned to project request
- `notifyProjectRequestUpdated()` - Notify when project request is updated
- `notifyTaskAcknowledgementReminder()` - Send 24-hour reminder

**Staff Assignment Notifications** (`src/lib/actions/staff-assignment-notifications.ts`)
- `notifyStaffAssignedToServiceRequest()` - Notify when staff assigned to service request
- `notifyStaffAssignedToProjectRequest()` - Notify when staff assigned to project request

### 4. Notification Types

Added to `src/lib/notifications/index.ts`:
- `service_request_created`
- `service_request_assigned`
- `service_request_updated`
- `project_request_created`
- `project_request_assigned`
- `project_request_updated`
- `task_acknowledgement_reminder`

## Usage

### When a Service Request is Created

The notification is automatically triggered in the service request creation API:

```typescript
// src/app/api/service-requests/route.ts

// After successful creation
notifyServiceRequestCreated(
  serviceRequest.id,
  serviceRequest.request_number,
  serviceRequest.service.name,
  clientName,
  organizationName,
  serviceRequest.priority
).catch((err) => {
  console.error('Failed to send notifications:', err)
})
```

### When Staff are Assigned

After creating a staff assignment, trigger the notification:

```typescript
// Create staff assignment
await supabase.from('staff_assignments').insert({
  assignable_type: 'service_request',
  assignable_id: serviceRequestId,
  staff_user_id: staffUserId,
  role: 'primary'
})

// Trigger notification
await notifyStaffAssignedToServiceRequest(serviceRequestId, staffUserId)
```

### For Project Requests

When project request API is implemented, add similar notification triggers:

```typescript
// After successful project request creation
notifyProjectRequestCreated(
  projectRequest.id,
  projectRequest.request_number,
  projectRequest.title,
  clientName,
  organizationName,
  projectRequest.priority
).catch((err) => {
  console.error('Failed to send notifications:', err)
})
```

## Configuration

### Environment Variables

Required:
- `NEXT_PUBLIC_APP_URL` - Base URL for acknowledgement links
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations
- `RESEND_API_KEY` - Resend API key for sending emails
- `CRON_SECRET` - Secret for authenticating cron job requests

### Vercel Cron Configuration

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/task-acknowledgement-check",
      "schedule": "0 * * * *"
    }
  ]
}
```

This runs every hour at the top of the hour.

### Email Template Customization

Email templates can be customized per organization:

1. Go to Supabase Dashboard → Database → email_templates
2. Insert a new row with the same `template_type` but with your `organization_id`
3. Customize the `subject` and `body` HTML

The system will use organization-specific templates if available, otherwise fall back to system defaults.

## Testing

### Test Acknowledgement Flow

1. Create a service request as a client
2. Check that admin receives an email notification
3. Click the acknowledgement link in the email
4. Verify redirect to the task page with success message
5. Check that `acknowledged_at` is set in the database

### Test 24-Hour Reminder

For testing, temporarily modify the cron job query to use a shorter time window:

```typescript
// Change from 24 hours to 5 minutes for testing
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

const { data: unacknowledgedRecords } = await supabaseAdmin
  .from('task_acknowledgements')
  .select('...')
  .is('acknowledged_at', null)
  .lt('created_at', fiveMinutesAgo.toISOString()) // Testing: 5 minutes
```

Then manually trigger the cron job:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/task-acknowledgement-check
```

### Test Email Templates

Use the test email endpoint:

```bash
POST /api/admin/email/test
{
  "to": "test@example.com",
  "templateType": "new_service_request",
  "variables": {
    "recipient_name": "Test Staff",
    "request_number": "SR-00001",
    // ... other variables
  }
}
```

## Security

- **Token Security**: Acknowledgement tokens are UUIDs, unique and unpredictable
- **Token Expiry**: Tokens expire after 24 hours
- **One-Time Use**: Once acknowledged, subsequent clicks show "already acknowledged"
- **RLS Policies**: All database operations respect Row-Level Security policies
- **Cron Authentication**: Cron job requires valid `CRON_SECRET` in Authorization header

## Monitoring

### Check Acknowledgement Status

```sql
-- View unacknowledged tasks
SELECT
  ta.task_type,
  ta.task_id,
  ta.created_at,
  p.name AS staff_name,
  p.email AS staff_email,
  ta.acknowledged_at
FROM task_acknowledgements ta
JOIN profiles p ON ta.acknowledged_by = p.id
WHERE ta.acknowledged_at IS NULL
  AND ta.token_expires_at > NOW()
ORDER BY ta.created_at DESC;
```

### Check Reminder Logs

```sql
-- View notification logs for reminders
SELECT
  created_at,
  recipient,
  status,
  error_message
FROM notification_log
WHERE notification_type = 'task_acknowledgement_reminder'
ORDER BY created_at DESC
LIMIT 50;
```

### Check Cron Job Status

View Vercel logs for cron job execution:

```bash
vercel logs --follow --filter "cron/task-acknowledgement-check"
```

## Troubleshooting

### Emails Not Sending

1. Check `RESEND_API_KEY` is set correctly
2. Check Resend dashboard for delivery status
3. Check `notification_log` table for failed attempts
4. Check email templates exist in database

### Acknowledgement Links Not Working

1. Check `NEXT_PUBLIC_APP_URL` is set correctly
2. Verify token is valid (not expired, exists in database)
3. Check RLS policies on `task_acknowledgements` table
4. Check API route logs for errors

### Reminders Not Sending

1. Check cron job is configured in `vercel.json`
2. Check `CRON_SECRET` matches in cron request
3. Check Vercel logs for cron job execution
4. Verify unacknowledged tasks exist (query database)
5. Check notification_log for failed email attempts

## Future Enhancements

- **SMS Notifications**: Add SMS support for high-priority tasks
- **Slack Notifications**: Send acknowledgement requests to Slack
- **Escalation**: Escalate to manager if not acknowledged after 48 hours
- **Dashboard Widget**: Show unacknowledged tasks in admin dashboard
- **Bulk Acknowledgement**: Allow acknowledging multiple tasks at once
- **Acknowledgement Notes**: Allow staff to add notes when acknowledging
- **Custom Reminder Schedule**: Allow configuring reminder frequency per organization

## Related Files

### Migrations
- `supabase/migrations/20260204160000_task_acknowledgements.sql`
- `supabase/migrations/20260204160001_task_notification_email_templates.sql`

### Notifications
- `src/lib/notifications/index.ts` - Notification types and helpers
- `src/lib/notifications/send.ts` - Notification sending logic
- `src/lib/notifications/providers/email.ts` - Email provider (Resend)

### Actions
- `src/lib/actions/task-notifications.ts` - Task notification triggers
- `src/lib/actions/staff-assignment-notifications.ts` - Staff assignment notification triggers

### API Routes
- `src/app/api/notifications/task/route.ts` - Task notification endpoint
- `src/app/api/tasks/acknowledge/route.ts` - Acknowledgement endpoint
- `src/app/api/cron/task-acknowledgement-check/route.ts` - Reminder cron job
- `src/app/api/service-requests/route.ts` - Service request creation (with notifications)

### Configuration
- `vercel.json` - Cron job configuration

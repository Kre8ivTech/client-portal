# SLA Monitoring Strategy

## Overview

The ticket SLA monitoring system uses a **hybrid approach** combining daily cron jobs with real-time client-side monitoring. This design ensures reliable SLA breach detection while working within Vercel Hobby plan limitations.

## Why Hybrid Monitoring?

### Vercel Hobby Plan Limitations

Vercel Hobby accounts only support daily cron jobs. More frequent schedules (e.g., every 15 minutes) require upgrading to the Pro plan.

### Solution: Dual-Layer Monitoring

Our system combines two complementary approaches:

1. **Daily Cron Job** - Comprehensive daily check at 8 AM
2. **Real-time Client Monitoring** - Active monitoring when tickets are being viewed

## How It Works

### 1. Daily Cron Job (Server-side)

**Schedule:** Every day at 8:00 AM UTC  
**Endpoint:** `/api/notifications/sla-check`  
**Purpose:** Comprehensive sweep of all active tickets

**Process:**
1. Queries all active tickets with pending responses or resolutions
2. Calculates time remaining until SLA deadlines
3. Identifies tickets needing warnings (< 25% time remaining) or breach notifications (overdue)
4. Sends notifications via configured channels (Email, SMS, Slack, WhatsApp)
5. Prevents duplicate notifications (4-hour cooldown)

**Configuration:**
```json
{
  "path": "/api/notifications/sla-check",
  "schedule": "0 8 * * *"
}
```

### 2. Real-time Client Monitoring (Browser-side)

**Component:** `SLAMonitorWrapper` in dashboard layout  
**Check Interval:** Every 5 minutes  
**Purpose:** Immediate detection of at-risk tickets during active usage

**Process:**
1. Monitors SLA status while users browse ticket pages
2. Identifies tickets with < 2 hours to first response or < 4 hours to resolution
3. Triggers server-side SLA check automatically (max once per hour)
4. Provides immediate notifications without waiting for daily cron

**Implementation:**
```typescript
// Runs automatically in dashboard
<SLAMonitorWrapper />

// Hook checks every 5 minutes
useSLAMonitor(isTicketPage)
```

## Benefits

### Immediate Response
- Critical SLA breaches detected within 5 minutes during active hours
- No waiting for daily cron when staff are actively managing tickets
- Real-time alerts when customers are most engaged

### Comprehensive Coverage
- Daily cron ensures no ticket is missed
- Catches tickets that weren't viewed during the day
- Provides overnight and weekend coverage

### Cost-Effective
- Works on Vercel Hobby plan ($0/month)
- No need to upgrade to Pro plan ($20/month) for frequent cron
- Efficient use of compute resources

### Reliable
- Redundant monitoring layers
- Falls back to daily cron if client monitoring fails
- Works even when no one is actively viewing tickets

## SLA Response Times

### Standard Clients

| Priority | First Response | Resolution |
|----------|---------------|------------|
| Critical | 1 hour | 4 hours |
| High | 4 hours | 24 hours |
| Medium | 8 hours | 48 hours |
| Low | 24 hours | 72 hours |

### Priority Clients (50% faster)

| Priority | First Response | Resolution |
|----------|---------------|------------|
| Critical | 30 minutes | 2 hours |
| High | 2 hours | 12 hours |
| Medium | 4 hours | 24 hours |
| Low | 12 hours | 36 hours |

## Notification Thresholds

### Warning (Yellow)
- Sent when < 25% of time remaining before deadline
- Example: Critical ticket with 1-hour SLA will warn at 15 minutes remaining
- Gives staff time to respond before breach

### Breach (Red)
- Sent immediately when deadline passes
- Triggers urgent notifications via all configured channels
- Requires immediate action

### Cooldown Period
- 4 hours between duplicate notifications for the same ticket/level
- Prevents notification spam
- Allows time for staff to respond

## Monitoring in Action

### Scenario 1: Active Hours (Staff Online)

1. **9:30 AM** - Critical ticket created (30-minute SLA for priority client)
2. **9:35 AM** - Client monitor detects at-risk status (< 2 hours)
3. **9:36 AM** - Server-side check triggered automatically
4. **9:37 AM** - Warning notification sent to assigned staff
5. **9:45 AM** - Staff responds, SLA met

**Result:** Immediate detection and notification within 7 minutes

### Scenario 2: Off Hours (Staff Offline)

1. **11:30 PM** - High-priority ticket created (4-hour SLA)
2. **8:00 AM** - Daily cron runs, detects ticket approaching deadline
3. **8:01 AM** - Warning notification sent to staff
4. **8:30 AM** - Staff arrives, sees notification, responds

**Result:** Caught by daily cron, staff notified first thing in morning

### Scenario 3: Weekend Coverage

1. **Saturday 2:00 PM** - Medium ticket created (8-hour SLA)
2. **Saturday 9:00 PM** - Ticket approaching deadline (< 25% time)
3. **Sunday 8:00 AM** - Daily cron sends breach notification
4. **Monday 9:00 AM** - Staff sees urgent notification, addresses immediately

**Result:** No missed breaches even on weekends

## Manual Triggering

Staff can manually trigger SLA checks:

```bash
# Via authenticated API call
curl https://your-app.com/api/notifications/sla-check \
  -H "Cookie: your-session-cookie"

# Returns:
{
  "success": true,
  "checked": 42,
  "notified": 3,
  "tickets": [
    {
      "ticketId": "uuid",
      "ticketNumber": 123,
      "level": "warning"
    }
  ]
}
```

## Monitoring Effectiveness

### Metrics to Track

Query notification effectiveness:

```sql
-- SLA notification delivery
SELECT 
  DATE(created_at) as date,
  notification_type,
  COUNT(*) as sent,
  COUNT(*) FILTER (WHERE status = 'sent') as delivered,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM notification_log
WHERE notification_type IN ('sla_warning', 'sla_breach')
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), notification_type
ORDER BY date DESC;

-- SLA compliance rate
SELECT 
  priority,
  COUNT(*) as total,
  COUNT(*) FILTER (
    WHERE first_response_at < first_response_due_at
  ) as on_time_response,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE first_response_at < first_response_due_at
    ) / COUNT(*),
    2
  ) as response_rate_percent
FROM tickets
WHERE first_response_at IS NOT NULL
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY priority;
```

## Troubleshooting

### Client Monitor Not Running

**Symptoms:** No real-time notifications during active hours

**Check:**
1. Verify `SLAMonitorWrapper` is in dashboard layout
2. Check browser console for errors
3. Confirm React Query is configured

**Fix:**
```typescript
// Ensure component is mounted
<SLAMonitorWrapper />

// Check hook is enabled
useSLAMonitor(true)
```

### Daily Cron Not Executing

**Symptoms:** No overnight SLA notifications

**Check:**
1. Verify cron is configured in `vercel.json`
2. Check Vercel dashboard > Cron Jobs
3. Confirm `CRON_SECRET` environment variable

**Fix:**
1. Redeploy to Vercel
2. Check cron execution logs in Vercel dashboard
3. Test manually: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" /api/notifications/sla-check`

### Too Many Notifications

**Symptoms:** Duplicate notifications within short periods

**Possible Causes:**
- Cooldown period too short
- Multiple clients triggering checks
- Cron and client checks overlapping

**Fix:**
- Increase cooldown period in `sla-monitor.ts` (currently 4 hours)
- Adjust client check frequency in `use-sla-monitor.ts` (currently 5 minutes)

## Upgrading to Vercel Pro

If you need more frequent automated checks:

1. Upgrade to Vercel Pro ($20/month)
2. Update cron schedule in `vercel.json`:
   ```json
   {
     "schedule": "*/15 * * * *"
   }
   ```
3. Redeploy

**Benefits:**
- Checks every 15 minutes automatically
- No dependency on client-side monitoring
- More consistent SLA breach detection
- Better for low-traffic applications

**Trade-offs:**
- Monthly cost
- Higher compute usage
- May not provide faster notifications than hybrid approach during active hours

## Best Practices

1. **Monitor During Business Hours**: Client-side monitoring provides fastest response when staff are active
2. **Set CRON_SECRET**: Always secure your cron endpoint
3. **Configure Notifications**: Ensure all channels are properly configured
4. **Test Regularly**: Manually trigger SLA checks to verify system works
5. **Review Logs**: Check notification logs weekly for delivery issues
6. **Adjust Thresholds**: Tune warning/breach thresholds based on team capacity
7. **Priority Clients**: Mark critical clients as priority for faster SLA

## Conclusion

The hybrid monitoring approach provides:
- ✅ Real-time breach detection during active hours
- ✅ Comprehensive daily coverage
- ✅ Vercel Hobby plan compatibility
- ✅ Cost-effective solution
- ✅ Reliable redundancy

This design ensures no SLA breaches are missed while keeping costs low and maintaining immediate responsiveness when it matters most.

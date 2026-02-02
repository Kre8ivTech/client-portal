# Admin SLA Configuration Guide

## Overview

The SLA Monitoring Configuration interface allows system administrators to customize how the ticket SLA tracking and notification system operates, without requiring code changes or redeployment.

## Accessing the Settings

**URL:** `/dashboard/admin/settings/sla`

**Access Requirements:**
- Must be logged in as a Super Admin
- Regular staff and clients cannot access this page

## Configuration Options

### 1. System Status

**SLA Monitoring Enabled**
- Master switch for the entire SLA monitoring system
- When disabled, no SLA checks or notifications will be sent
- Default: Enabled

### 2. Automated Cron Checks

**Enable Cron Jobs**
- Toggles automated server-side SLA checks via Vercel Cron
- Default: Enabled

**Cron Schedule**
Choose from preset schedules or enter a custom cron expression:

| Schedule | Frequency | Vercel Plan Required | Best For |
|----------|-----------|---------------------|----------|
| Daily at 8 AM | Once per day | Hobby (Free) ✅ | Low traffic, cost-conscious |
| Every 12 hours | Twice per day | Pro ($20/month) | Standard operations |
| Every 6 hours | 4 times per day | Pro | Active support teams |
| Every 4 hours | 6 times per day | Pro | High-volume operations |
| Every 2 hours | 12 times per day | Pro | Mission-critical |
| Every hour | 24 times per day | Pro | Enterprise support |
| Every 30 minutes | 48 times per day | Pro | Real-time operations |
| Every 15 minutes | 96 times per day | Pro | Maximum coverage |

**Vercel Plan Indicators:**
- Green checkmark: Compatible with free Hobby plan
- Red warning: Requires Vercel Pro upgrade

**Custom Cron Expression:**
Use standard cron format: `minute hour day month weekday`
- Example: `0 8 * * *` = Daily at 8:00 AM
- Example: `*/30 * * * *` = Every 30 minutes

### 3. Real-time Client Monitoring

**Enable Client Monitoring**
- Toggles browser-based SLA monitoring
- Checks SLA status while users are viewing ticket pages
- Provides real-time alerts without waiting for cron
- Default: Enabled

**Check Interval (minutes)**
- How often to check SLA status in the browser
- Range: 1-60 minutes
- Default: 5 minutes
- Recommended: 3-10 minutes for active monitoring

**Benefits:**
- Immediate alerts during business hours
- No cron limitations
- Complements daily cron for 24/7 coverage

### 4. Notification Thresholds

**Warning Threshold (%)**
- Send warning notifications when less than this percentage of time remains
- Range: 1-75%
- Default: 25% (75% of time elapsed)
- Example: For a 4-hour SLA, warning at 1 hour remaining (25% of 4 hours)

**Critical Threshold (hours)**
- Mark tickets as critical when less than this many hours remain
- Range: 0.5-24 hours
- Default: 2 hours
- Triggers urgent visual indicators and priority notifications

**Notification Cooldown (hours)**
- Minimum time between duplicate notifications for the same ticket
- Range: 1-24 hours
- Default: 4 hours
- Prevents notification spam while allowing follow-ups

**Immediate Breach Notifications**
- Send notifications instantly when SLA deadline passes
- Default: Enabled
- Recommended: Keep enabled for time-sensitive operations

### 5. Auto Escalation

**Enable Auto Escalation**
- Automatically increase ticket priority when SLA breaches aren't addressed
- Default: Disabled
- Use for organizations with defined escalation procedures

**Escalation Delay (hours)**
- How long to wait after SLA breach before escalating
- Range: 0.5-48 hours
- Default: 1 hour
- Only applies when auto escalation is enabled

**Escalation Behavior:**
- Low → Medium
- Medium → High
- High → Critical
- Critical remains critical (may trigger additional notifications)

## Manual SLA Check

**Run Check Now Button**
- Manually triggers an immediate SLA check across all tickets
- Useful for:
  - Testing configuration changes
  - Immediate audit of SLA status
  - Troubleshooting notification issues
  - After bulk ticket imports

**Results:**
- Shows number of tickets checked
- Displays number of notifications sent
- Lists affected tickets with their status

## Recommended Configurations

### Small Business (Hobby Plan)

```
Cron: Daily at 8 AM
Client Monitoring: Enabled (5 minutes)
Warning Threshold: 25%
Critical Threshold: 2 hours
Cooldown: 4 hours
Auto Escalation: Disabled
```

**Pros:** Free, adequate coverage with real-time monitoring during business hours

### Growing Business (Pro Plan)

```
Cron: Every 6 hours
Client Monitoring: Enabled (5 minutes)
Warning Threshold: 25%
Critical Threshold: 2 hours
Cooldown: 3 hours
Auto Escalation: Enabled (1 hour delay)
```

**Pros:** Good balance of coverage and cost

### Enterprise (Pro Plan)

```
Cron: Every 15 minutes
Client Monitoring: Enabled (3 minutes)
Warning Threshold: 20%
Critical Threshold: 1 hour
Cooldown: 2 hours
Auto Escalation: Enabled (30 minutes delay)
```

**Pros:** Maximum responsiveness, tight SLA compliance

### 24/7 Support (Pro Plan)

```
Cron: Every 30 minutes
Client Monitoring: Enabled (5 minutes)
Warning Threshold: 30%
Critical Threshold: 1 hour
Cooldown: 2 hours
Auto Escalation: Enabled (1 hour delay)
```

**Pros:** Around-the-clock coverage, suitable for global teams

## Testing Your Configuration

1. **Create a Test Ticket**
   - Set to Critical priority (1-hour response time for standard clients)
   - Do not respond to it

2. **Wait for Warning**
   - Warning should arrive at 25% time remaining (15 minutes for 1-hour SLA)
   - Check notification logs to verify delivery

3. **Verify Breach Notification**
   - If no response after 1 hour, breach notification should send
   - Check email, SMS, or Slack based on your preferences

4. **Verify Escalation** (if enabled)
   - Wait for escalation delay period
   - Ticket should increase in priority
   - Additional notifications should be sent

## Monitoring Effectiveness

### Check Notification Delivery

Navigate to notification logs or query:

```sql
SELECT 
  DATE(created_at) as date,
  notification_type,
  channel,
  COUNT(*) FILTER (WHERE status = 'sent') as delivered,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM notification_log
WHERE notification_type IN ('sla_warning', 'sla_breach')
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at), notification_type, channel
ORDER BY date DESC;
```

### Review SLA Compliance

Check how well your team is meeting SLAs:

```sql
SELECT 
  priority,
  COUNT(*) as total_tickets,
  COUNT(*) FILTER (
    WHERE first_response_at < first_response_due_at
  ) as on_time_responses,
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE first_response_at < first_response_due_at
    ) / COUNT(*),
    1
  ) as response_rate_percent
FROM tickets
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND first_response_at IS NOT NULL
GROUP BY priority;
```

## Troubleshooting

### No Notifications Being Sent

**Check:**
1. Is SLA Monitoring enabled?
2. Is Cron enabled (if relying on cron)?
3. Are there any active tickets approaching SLA deadlines?
4. Check notification preferences for users
5. Verify email/SMS/Slack credentials are configured

**Solution:**
- Use "Run Check Now" to trigger manual check
- Review notification logs for errors
- Test with a deliberate SLA breach

### Too Many Notifications

**Check:**
1. Is cooldown period too short?
2. Are multiple monitoring systems triggering?
3. Is client monitoring checking too frequently?

**Solution:**
- Increase cooldown period to 6-8 hours
- Reduce client check interval to 10-15 minutes
- Adjust warning threshold to lower value (15-20%)

### Cron Not Running

**Check:**
1. Is cron enabled in settings?
2. Is schedule compatible with your Vercel plan?
3. Check Vercel dashboard > Cron Jobs for execution logs

**Solution:**
- Verify `CRON_SECRET` environment variable is set
- Switch to daily schedule for Hobby plan
- Redeploy to Vercel
- Check Vercel logs for errors

### Escalation Not Working

**Check:**
1. Is auto escalation enabled?
2. Has escalation delay period passed?
3. Is ticket already at critical priority? (cannot escalate further)

**Solution:**
- Enable auto escalation in settings
- Wait for full delay period
- Check that ticket is not already at maximum priority

## Best Practices

1. **Start Conservative**
   - Begin with daily cron and 5-minute client monitoring
   - Adjust based on actual needs
   - Upgrade to Pro when business requires

2. **Monitor First Week**
   - Track notification delivery rates
   - Adjust thresholds if too many/few notifications
   - Fine-tune cooldown periods

3. **Match Business Hours**
   - If 9-5 operation, daily cron at 8 AM works well
   - Client monitoring provides daytime coverage
   - 24/7 operations need more frequent cron

4. **Set Realistic SLAs**
   - Ensure your team can meet the response times
   - Use priority client status judiciously
   - Consider time zones for global teams

5. **Review Regularly**
   - Monthly review of SLA compliance
   - Adjust thresholds based on performance
   - Update cron frequency as team grows

6. **Document Escalation**
   - If using auto escalation, document the process
   - Train team on escalation procedures
   - Define who handles escalated tickets

## Security Considerations

- Only Super Admins can modify these settings
- Changes are logged in the audit trail
- Settings affect entire system
- Test changes in staging environment first

## Support

For questions or issues with SLA configuration:
1. Review the notification system documentation
2. Check Vercel logs for cron execution
3. Query notification logs for delivery status
4. Use "Run Check Now" to test configuration
5. Contact development team for advanced troubleshooting

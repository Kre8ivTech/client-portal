-- Email Templates for Task Submission Notifications
-- Adds templates for service request and project request notifications

-- Service Request Submitted (to admin and assigned staff)
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  body,
  organization_id
) VALUES (
  'new_service_request',
  'Service Request Submitted',
  'New Service Request: {{service_name}} - {{request_number}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .task-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 6px; border-left: 4px solid #4F46E5; }
    .detail-row { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-label { font-weight: bold; color: #6b7280; display: inline-block; min-width: 140px; }
    .detail-value { color: #111827; }
    .priority-high { color: #dc2626; font-weight: bold; }
    .priority-medium { color: #f59e0b; font-weight: bold; }
    .priority-low { color: #10b981; font-weight: bold; }
    .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .button:hover { background-color: #4338CA; }
    .footer { text-align: center; margin-top: 30px; padding: 20px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
    .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">New Service Request</h1>
  </div>

  <div class="content">
    <p>Hi {{recipient_name}},</p>

    <p>A new service request has been submitted by <strong>{{client_name}}</strong> from <strong>{{organization_name}}</strong>.</p>

    <div class="task-details">
      <h2 style="margin-top: 0; color: #4F46E5;">Request Details</h2>

      <div class="detail-row">
        <span class="detail-label">Request Number:</span>
        <span class="detail-value">{{request_number}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Service:</span>
        <span class="detail-value">{{service_name}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Priority:</span>
        <span class="detail-value priority-{{priority_class}}">{{priority}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Requested Start:</span>
        <span class="detail-value">{{requested_start_date}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value">{{status}}</span>
      </div>

      {{#if details}}
      <div class="detail-row">
        <span class="detail-label">Additional Details:</span>
        <span class="detail-value">{{details}}</span>
      </div>
      {{/if}}
    </div>

    <div class="warning-box">
      <strong>Action Required:</strong> Please acknowledge this request within 24 hours. Click the button below to acknowledge receipt and review the request.
    </div>

    <center>
      <a href="{{acknowledgement_url}}" class="button">Acknowledge Request</a>
    </center>

    <p style="margin-top: 30px;">You can also view the full request details in the portal:</p>
    <p><a href="{{request_url}}" style="color: #4F46E5;">View Request in Portal</a></p>

    <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
      <em>This is an automated notification. If you have questions about this request, please contact the client or your team lead.</em>
    </p>
  </div>

  <div class="footer">
    <p>&copy; {{current_year}} {{organization_name}}. All rights reserved.</p>
    <p>You are receiving this email because you are assigned staff for this service request.</p>
  </div>
</body>
</html>',
  NULL -- NULL organization_id means system default
) ON CONFLICT (template_type, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;

-- Project Request Submitted (to admin and assigned staff)
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  body,
  organization_id
) VALUES (
  'new_project_request',
  'Project Request Submitted',
  'New Project Request: {{project_title}} - {{request_number}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #7C3AED; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .task-details { background-color: white; padding: 20px; margin: 20px 0; border-radius: 6px; border-left: 4px solid #7C3AED; }
    .detail-row { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-label { font-weight: bold; color: #6b7280; display: inline-block; min-width: 140px; }
    .detail-value { color: #111827; }
    .priority-high { color: #dc2626; font-weight: bold; }
    .priority-medium { color: #f59e0b; font-weight: bold; }
    .priority-low { color: #10b981; font-weight: bold; }
    .button { display: inline-block; padding: 12px 24px; background-color: #7C3AED; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .button:hover { background-color: #6D28D9; }
    .footer { text-align: center; margin-top: 30px; padding: 20px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
    .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">New Project Request</h1>
  </div>

  <div class="content">
    <p>Hi {{recipient_name}},</p>

    <p>A new project request has been submitted by <strong>{{client_name}}</strong> from <strong>{{organization_name}}</strong>.</p>

    <div class="task-details">
      <h2 style="margin-top: 0; color: #7C3AED;">Project Details</h2>

      <div class="detail-row">
        <span class="detail-label">Request Number:</span>
        <span class="detail-value">{{request_number}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Project Title:</span>
        <span class="detail-value"><strong>{{project_title}}</strong></span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Priority:</span>
        <span class="detail-value priority-{{priority_class}}">{{priority}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Budget Range:</span>
        <span class="detail-value">{{budget_range}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Preferred Start:</span>
        <span class="detail-value">{{preferred_start_date}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Status:</span>
        <span class="detail-value">{{status}}</span>
      </div>

      {{#if description}}
      <div class="detail-row">
        <span class="detail-label">Description:</span>
        <span class="detail-value">{{description}}</span>
      </div>
      {{/if}}
    </div>

    <div class="warning-box">
      <strong>Action Required:</strong> Please acknowledge this project request within 24 hours. Click the button below to acknowledge receipt and review the request.
    </div>

    <center>
      <a href="{{acknowledgement_url}}" class="button">Acknowledge Request</a>
    </center>

    <p style="margin-top: 30px;">You can also view the full project request in the portal:</p>
    <p><a href="{{request_url}}" style="color: #7C3AED;">View Request in Portal</a></p>

    <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
      <em>This is an automated notification. If you have questions about this project request, please contact the client or your team lead.</em>
    </p>
  </div>

  <div class="footer">
    <p>&copy; {{current_year}} {{organization_name}}. All rights reserved.</p>
    <p>You are receiving this email because you are assigned staff for this project request.</p>
  </div>
</body>
</html>',
  NULL -- NULL organization_id means system default
) ON CONFLICT (template_type, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;

-- 24-Hour Reminder for Unacknowledged Tasks
INSERT INTO email_templates (
  template_type,
  name,
  subject,
  body,
  organization_id
) VALUES (
  'task_acknowledgement_reminder',
  'Task Acknowledgement Reminder',
  'REMINDER: Unacknowledged {{task_type}} - {{request_number}}',
  '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
    .alert-box { background-color: #fee2e2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .task-summary { background-color: white; padding: 20px; margin: 20px 0; border-radius: 6px; border: 1px solid #e5e7eb; }
    .detail-row { margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .detail-label { font-weight: bold; color: #6b7280; display: inline-block; min-width: 140px; }
    .detail-value { color: #111827; }
    .button { display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
    .button:hover { background-color: #b91c1c; }
    .footer { text-align: center; margin-top: 30px; padding: 20px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
    .time-info { color: #dc2626; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">URGENT: Acknowledgement Required</h1>
  </div>

  <div class="content">
    <p>Hi {{recipient_name}},</p>

    <div class="alert-box">
      <h2 style="margin-top: 0; color: #dc2626;">Unacknowledged Request Alert</h2>
      <p><strong>This request has been pending for over 24 hours without acknowledgement.</strong></p>
      <p class="time-info">Submitted: {{hours_ago}} hours ago</p>
    </div>

    <p>The following {{task_type}} from <strong>{{client_name}}</strong> requires your immediate attention:</p>

    <div class="task-summary">
      <div class="detail-row">
        <span class="detail-label">Request Number:</span>
        <span class="detail-value">{{request_number}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">{{task_title_label}}:</span>
        <span class="detail-value"><strong>{{task_title}}</strong></span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Client:</span>
        <span class="detail-value">{{client_name}} ({{organization_name}})</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Priority:</span>
        <span class="detail-value">{{priority}}</span>
      </div>

      <div class="detail-row">
        <span class="detail-label">Submitted:</span>
        <span class="detail-value">{{submitted_date}}</span>
      </div>

      {{#if acknowledged_by_others}}
      <div class="detail-row">
        <span class="detail-label">Acknowledged By:</span>
        <span class="detail-value">{{acknowledged_by_others}}</span>
      </div>
      {{/if}}
    </div>

    <p style="color: #dc2626; font-weight: bold;">
      Please acknowledge this request immediately to ensure timely service delivery.
    </p>

    <center>
      <a href="{{acknowledgement_url}}" class="button">Acknowledge Now</a>
    </center>

    <p style="margin-top: 30px;">Or view in the portal:</p>
    <p><a href="{{request_url}}" style="color: #4F46E5;">View Request Details</a></p>

    <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">
      <em>This is an automated reminder. If you cannot handle this request, please contact your team lead immediately.</em>
    </p>
  </div>

  <div class="footer">
    <p>&copy; {{current_year}} {{organization_name}}. All rights reserved.</p>
    <p>This is an automated reminder for unacknowledged requests.</p>
  </div>
</body>
</html>',
  NULL -- NULL organization_id means system default
) ON CONFLICT (template_type, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;

-- Add comments for documentation
COMMENT ON COLUMN email_templates.template_type IS 'Available types include: new_service_request, new_project_request, task_acknowledgement_reminder';

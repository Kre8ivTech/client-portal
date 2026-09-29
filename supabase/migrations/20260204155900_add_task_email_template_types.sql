-- Task notification templates use types that were added after the original enum.
-- Adding them in their own migration lets the following inserts use the new values.
ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'new_project_request';
ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'task_acknowledgement_reminder';

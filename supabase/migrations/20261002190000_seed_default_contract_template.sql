-- Idempotent seed: a global service agreement so Create New Contract has a template
-- when an organization has not uploaded one. No-ops once that template exists,
-- and no-ops when the database has no super admin to own created_by.

INSERT INTO public.contract_templates (
  organization_id,
  name,
  description,
  contract_type,
  template_content,
  variables,
  is_active,
  created_by
)
SELECT
  NULL,
  'Standard Service Agreement',
  'Default agreement for sending a contract to a client for signature.',
  'service_agreement',
  $template$
<h1>Service Agreement</h1>
<p>This service agreement is made with <strong>{{client_name}}</strong>.</p>
<p><strong>Services.</strong> {{service_description}}</p>
<p><strong>Effective date.</strong> {{effective_date}}</p>
<p>By signing, the client agrees to the services described above.</p>
<p>/sn1/</p>
$template$,
  '[
    {"name":"client_name","label":"Client name","type":"text","required":true,"default":""},
    {"name":"service_description","label":"Service description","type":"text","required":true,"default":""},
    {"name":"effective_date","label":"Effective date","type":"text","required":true,"default":""}
  ]'::jsonb,
  TRUE,
  admin_user.id
FROM public.users AS admin_user
WHERE admin_user.role IN ('super_admin', 'admin')
  AND NOT EXISTS (
    SELECT 1
    FROM public.contract_templates AS existing
    WHERE existing.name = 'Standard Service Agreement'
      AND existing.organization_id IS NULL
  )
ORDER BY admin_user.created_at ASC
LIMIT 1;

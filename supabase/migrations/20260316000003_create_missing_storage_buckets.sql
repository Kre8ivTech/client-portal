-- Create missing storage buckets referenced in code but never created

-- task-files bucket: Used for task file uploads and screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-files', 'task-files', false, 52428800, ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','text/csv','application/zip'])
ON CONFLICT (id) DO NOTHING;

-- project-files bucket: Used for project file uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('project-files', 'project-files', false, 52428800, ARRAY['image/jpeg','image/png','image/gif','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','text/csv','application/zip'])
ON CONFLICT (id) DO NOTHING;

-- contracts bucket: Used for signed contract document storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('contracts', 'contracts', false, 52428800, ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies. Local Supabase runs migrations as a role that cannot own
-- storage.objects; skip those policies when the role cannot be assumed.
DO $$
DECLARE
  owner_name text;
BEGIN
  SELECT pg_get_userbyid(c.relowner) INTO owner_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname = 'objects';

  IF owner_name IS NULL THEN
    RAISE NOTICE 'storage.objects not found; skipping bucket policies';
    RETURN;
  END IF;

  BEGIN
    EXECUTE format('SET ROLE %I', owner_name);
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can upload task files" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authenticated users can upload task files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''task-files'')';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view task files" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authenticated users can view task files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''task-files'')';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can delete own task files" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authenticated users can delete own task files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''task-files'' AND auth.uid()::text = (storage.foldername(name))[1])';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can upload project files" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authenticated users can upload project files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''project-files'')';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view project files" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authenticated users can view project files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''project-files'')';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can delete own project files" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authenticated users can delete own project files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = ''project-files'' AND auth.uid()::text = (storage.foldername(name))[1])';
    EXECUTE 'DROP POLICY IF EXISTS "Staff can upload contracts" ON storage.objects';
    EXECUTE 'CREATE POLICY "Staff can upload contracts" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = ''contracts'' AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN (''super_admin'', ''staff'')))';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can view contracts" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authenticated users can view contracts" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = ''contracts'')';
    EXECUTE 'RESET ROLE';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'skipping storage.objects policies: %', SQLERRM;
  END;
END $$;

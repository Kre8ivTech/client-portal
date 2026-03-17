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

-- Storage policies for task-files
CREATE POLICY "Authenticated users can upload task files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-files');

CREATE POLICY "Authenticated users can view task files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'task-files');

CREATE POLICY "Authenticated users can delete own task files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for project-files
CREATE POLICY "Authenticated users can upload project files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "Authenticated users can view project files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'project-files');

CREATE POLICY "Authenticated users can delete own project files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'project-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for contracts
CREATE POLICY "Staff can upload contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contracts' AND
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'staff'))
);

CREATE POLICY "Authenticated users can view contracts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contracts');

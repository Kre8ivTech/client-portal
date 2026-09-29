-- Create avatars bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- storage.objects is owned by the storage service role. Local migrations run as a
-- different role, so policy changes have to run as the table owner.
DO $$
DECLARE
  owner_name text;
BEGIN
  SELECT pg_get_userbyid(c.relowner) INTO owner_name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage' AND c.relname = 'objects';

  IF owner_name IS NULL THEN
    RAISE NOTICE 'storage.objects not found; skipping avatar policies';
    RETURN;
  END IF;

  BEGIN
    EXECUTE format('SET ROLE %I', owner_name);
    EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects';
    EXECUTE 'CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = ''avatars'')';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects';
    EXECUTE 'CREATE POLICY "Authenticated users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = ''avatars'' AND auth.role() = ''authenticated'')';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects';
    EXECUTE 'CREATE POLICY "Users can update their own avatars" ON storage.objects FOR UPDATE USING (bucket_id = ''avatars'' AND owner = auth.uid())';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects';
    EXECUTE 'CREATE POLICY "Users can delete their own avatars" ON storage.objects FOR DELETE USING (bucket_id = ''avatars'' AND owner = auth.uid())';
    EXECUTE 'RESET ROLE';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'skipping storage.objects policies: %', SQLERRM;
  END;
END $$;

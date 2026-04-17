-- Ensure user-facing tables are included in Supabase realtime publication
-- so client subscriptions can receive postgres_changes events.
DO $$
DECLARE
  target_table text;
  realtime_pub_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) INTO realtime_pub_exists;

  IF NOT realtime_pub_exists THEN
    RAISE NOTICE 'Publication supabase_realtime does not exist. Skipping realtime publication setup.';
    RETURN;
  END IF;

  FOREACH target_table IN ARRAY ARRAY['raw_events', 'sync_status', 'oauth_tokens', 'user_profiles', 'topics'] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_rel pr
      JOIN pg_publication p ON p.oid = pr.prpubid
      JOIN pg_class c ON c.oid = pr.prrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE p.pubname = 'supabase_realtime'
        AND n.nspname = 'public'
        AND c.relname = target_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', target_table);
    END IF;
  END LOOP;
END $$;

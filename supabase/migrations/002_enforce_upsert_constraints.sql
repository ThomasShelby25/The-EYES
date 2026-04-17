-- Ensure conflict targets used by API upserts are always backed by unique constraints.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'raw_events'
      AND tc.constraint_type = 'UNIQUE'
    GROUP BY tc.constraint_name
    HAVING array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position)
      = ARRAY['user_id', 'platform', 'platform_id']::text[]
  ) THEN
    ALTER TABLE raw_events
      ADD CONSTRAINT raw_events_user_platform_platform_id_unique UNIQUE (user_id, platform, platform_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'sync_status'
      AND tc.constraint_type = 'UNIQUE'
    GROUP BY tc.constraint_name
    HAVING array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position)
      = ARRAY['user_id', 'platform']::text[]
  ) THEN
    ALTER TABLE sync_status
      ADD CONSTRAINT sync_status_user_platform_unique UNIQUE (user_id, platform);
  END IF;
END $$;

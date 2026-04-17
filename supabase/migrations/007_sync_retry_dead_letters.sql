-- Dead-letter storage for retries that should no longer be rescheduled.
-- Captures terminal failures for auditability and manual remediation.

CREATE TABLE IF NOT EXISTS sync_retry_dead_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  retry_attempt INTEGER NOT NULL DEFAULT 1 CHECK (retry_attempt >= 1),
  last_http_status INTEGER,
  error_message TEXT,
  failure_reason TEXT NOT NULL CHECK (failure_reason IN ('max_attempts_exceeded', 'non_retriable_status')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_retry_dead_letters_user_created_at
  ON sync_retry_dead_letters(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_retry_dead_letters_platform_created_at
  ON sync_retry_dead_letters(platform, created_at DESC);

ALTER TABLE sync_retry_dead_letters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own sync retry dead letters" ON sync_retry_dead_letters;
CREATE POLICY "Users can read their own sync retry dead letters" ON sync_retry_dead_letters
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sync retry dead letters" ON sync_retry_dead_letters;
CREATE POLICY "Users can insert their own sync retry dead letters" ON sync_retry_dead_letters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sync retry dead letters" ON sync_retry_dead_letters;
CREATE POLICY "Users can update their own sync retry dead letters" ON sync_retry_dead_letters
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sync retry dead letters" ON sync_retry_dead_letters;
CREATE POLICY "Users can delete their own sync retry dead letters" ON sync_retry_dead_letters
  FOR DELETE USING (auth.uid() = user_id);

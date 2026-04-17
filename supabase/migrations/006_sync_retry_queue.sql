-- Retry queue and backoff state for scheduler fan-out failures.
-- Stores one pending retry slot per user/platform.

CREATE TABLE IF NOT EXISTS sync_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  retry_attempt INTEGER NOT NULL DEFAULT 1 CHECK (retry_attempt >= 1),
  next_attempt_at TIMESTAMP NOT NULL,
  last_http_status INTEGER,
  last_error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_sync_retry_queue_next_attempt_at
  ON sync_retry_queue(next_attempt_at ASC);

CREATE INDEX IF NOT EXISTS idx_sync_retry_queue_user_next_attempt_at
  ON sync_retry_queue(user_id, next_attempt_at ASC);

ALTER TABLE sync_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own sync retry queue" ON sync_retry_queue;
CREATE POLICY "Users can read their own sync retry queue" ON sync_retry_queue
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sync retry queue" ON sync_retry_queue;
CREATE POLICY "Users can insert their own sync retry queue" ON sync_retry_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sync retry queue" ON sync_retry_queue;
CREATE POLICY "Users can update their own sync retry queue" ON sync_retry_queue
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sync retry queue" ON sync_retry_queue;
CREATE POLICY "Users can delete their own sync retry queue" ON sync_retry_queue
  FOR DELETE USING (auth.uid() = user_id);

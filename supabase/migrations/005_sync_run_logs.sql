-- Durable scheduler observability logs.
-- Stores per-user, per-platform outcomes for cron/manual sync orchestration.

CREATE TABLE IF NOT EXISTS sync_run_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT 'cron' CHECK (trigger IN ('cron', 'manual', 'recovery')),
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  http_status INTEGER,
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  started_at TIMESTAMP NOT NULL DEFAULT now(),
  completed_at TIMESTAMP,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_run_logs_run_user_platform_attempt
  ON sync_run_logs(run_id, user_id, platform, attempt);

CREATE INDEX IF NOT EXISTS idx_sync_run_logs_user_created_at
  ON sync_run_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_run_logs_status_created_at
  ON sync_run_logs(status, created_at DESC);

ALTER TABLE sync_run_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own sync run logs" ON sync_run_logs;
CREATE POLICY "Users can read their own sync run logs" ON sync_run_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sync run logs" ON sync_run_logs;
CREATE POLICY "Users can insert their own sync run logs" ON sync_run_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sync run logs" ON sync_run_logs;
CREATE POLICY "Users can update their own sync run logs" ON sync_run_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sync run logs" ON sync_run_logs;
CREATE POLICY "Users can delete their own sync run logs" ON sync_run_logs
  FOR DELETE USING (auth.uid() = user_id);

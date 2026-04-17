-- OAuth token refresh telemetry and retry diagnostics.

CREATE TABLE IF NOT EXISTS oauth_refresh_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt >= 1),
  latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_logs_user_created_at
  ON oauth_refresh_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_logs_platform_created_at
  ON oauth_refresh_logs(platform, created_at DESC);

ALTER TABLE oauth_refresh_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own oauth refresh logs" ON oauth_refresh_logs;
CREATE POLICY "Users can read their own oauth refresh logs" ON oauth_refresh_logs
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own oauth refresh logs" ON oauth_refresh_logs;
CREATE POLICY "Users can insert their own oauth refresh logs" ON oauth_refresh_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own oauth refresh logs" ON oauth_refresh_logs;
CREATE POLICY "Users can delete their own oauth refresh logs" ON oauth_refresh_logs
  FOR DELETE USING (auth.uid() = user_id);

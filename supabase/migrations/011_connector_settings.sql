-- Persist per-connector UI preferences.

CREATE TABLE IF NOT EXISTS connector_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  data_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_connector_settings_user_platform
  ON connector_settings(user_id, platform);

ALTER TABLE connector_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own connector settings" ON connector_settings;
CREATE POLICY "Users can read their own connector settings" ON connector_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own connector settings" ON connector_settings;
CREATE POLICY "Users can insert their own connector settings" ON connector_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own connector settings" ON connector_settings;
CREATE POLICY "Users can update their own connector settings" ON connector_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own connector settings" ON connector_settings;
CREATE POLICY "Users can delete their own connector settings" ON connector_settings
  FOR DELETE USING (auth.uid() = user_id);
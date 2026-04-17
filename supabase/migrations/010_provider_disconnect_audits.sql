-- Provider disconnect and data-lifecycle audit ledger.
-- Records remote token revocation outcomes and local purge/disconnect actions.

CREATE TABLE IF NOT EXISTS provider_disconnect_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('disconnect', 'purge_platform', 'purge_account')),
  disconnected BOOLEAN NOT NULL DEFAULT false,
  deleted_event_count INTEGER NOT NULL DEFAULT 0 CHECK (deleted_event_count >= 0),
  remaining_memories INTEGER CHECK (remaining_memories >= 0),
  revocation_provider TEXT,
  revocation_status TEXT CHECK (revocation_status IN ('success', 'failed', 'skipped')),
  revocation_http_status INTEGER,
  revocation_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provider_disconnect_audits_user_created_at
  ON provider_disconnect_audits(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_disconnect_audits_platform_created_at
  ON provider_disconnect_audits(platform, created_at DESC);

ALTER TABLE provider_disconnect_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own provider disconnect audits" ON provider_disconnect_audits;
CREATE POLICY "Users can read their own provider disconnect audits" ON provider_disconnect_audits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own provider disconnect audits" ON provider_disconnect_audits;
CREATE POLICY "Users can insert their own provider disconnect audits" ON provider_disconnect_audits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own provider disconnect audits" ON provider_disconnect_audits;
CREATE POLICY "Users can delete their own provider disconnect audits" ON provider_disconnect_audits
  FOR DELETE USING (auth.uid() = user_id);
-- Escalation event ledger for scheduler reliability incidents.
-- Tracks open/resolved incident state, ownership routing, and webhook dispatch cadence.

CREATE TABLE IF NOT EXISTS sync_escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  owner TEXT NOT NULL DEFAULT 'ops-review',
  first_triggered_at TIMESTAMP NOT NULL DEFAULT now(),
  last_triggered_at TIMESTAMP NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP,
  trigger_count INTEGER NOT NULL DEFAULT 1 CHECK (trigger_count >= 1),
  last_observed DOUBLE PRECISION NOT NULL DEFAULT 0,
  threshold DOUBLE PRECISION NOT NULL DEFAULT 0,
  message TEXT NOT NULL,
  last_dispatched_at TIMESTAMP,
  dispatch_count INTEGER NOT NULL DEFAULT 0 CHECK (dispatch_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_sync_escalation_events_user_status_last_triggered
  ON sync_escalation_events(user_id, status, last_triggered_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_escalation_events_status_severity
  ON sync_escalation_events(status, severity, last_triggered_at DESC);

ALTER TABLE sync_escalation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own sync escalation events" ON sync_escalation_events;
CREATE POLICY "Users can read their own sync escalation events" ON sync_escalation_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sync escalation events" ON sync_escalation_events;
CREATE POLICY "Users can insert their own sync escalation events" ON sync_escalation_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sync escalation events" ON sync_escalation_events;
CREATE POLICY "Users can update their own sync escalation events" ON sync_escalation_events
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sync escalation events" ON sync_escalation_events;
CREATE POLICY "Users can delete their own sync escalation events" ON sync_escalation_events
  FOR DELETE USING (auth.uid() = user_id);

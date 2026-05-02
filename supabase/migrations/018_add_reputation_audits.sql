-- Migration: 018_add_reputation_audits.sql
-- Description: Table for storing premium reputation audit records and metadata.

CREATE TYPE audit_status AS ENUM ('pending', 'analysis', 'generating', 'completed', 'failed');

CREATE TABLE IF NOT EXISTS reputation_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status audit_status NOT NULL DEFAULT 'pending',
  
  -- Results
  risk_score DECIMAL(3, 1), -- 0.0 to 10.0
  mentions_count INTEGER DEFAULT 0,
  commitments_count INTEGER DEFAULT 0,
  summary_narrative TEXT,
  connectors_covered TEXT[] DEFAULT '{}',
  
  -- Artifacts
  report_url TEXT,
  
  -- Detailed Analysis Results (JSON)
  -- Stores: sentiment_distribution, commitments_list, top_entities, etc.
  metadata JSONB DEFAULT '{}',
  
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_reputation_audits_user_id ON reputation_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_audits_status ON reputation_audits(status);

-- RLS Policies
ALTER TABLE reputation_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own audits" ON reputation_audits;
CREATE POLICY "Users can view their own audits" ON reputation_audits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own audits" ON reputation_audits;
CREATE POLICY "Users can update their own audits" ON reputation_audits
  FOR UPDATE USING (auth.uid() = user_id);

-- Note: In production, INSERT would be handled by a service role or a specific trigger.
-- For the demo/beta, we allow the user to initiate (pending status).
DROP POLICY IF EXISTS "Users can insert their own audits" ON reputation_audits;
CREATE POLICY "Users can insert their own audits" ON reputation_audits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_audit_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_reputation_audits_timestamp
  BEFORE UPDATE ON reputation_audits
  FOR EACH ROW
  EXECUTE FUNCTION update_audit_timestamp();

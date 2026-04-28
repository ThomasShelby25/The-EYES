
-- Add cursor and metadata tracking to sync_status
ALTER TABLE sync_status 
ADD COLUMN IF NOT EXISTS cursor TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Index for performance when checking cursors
CREATE INDEX IF NOT EXISTS idx_sync_status_platform_cursor ON sync_status(platform) WHERE cursor IS NOT NULL;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar TEXT,
  plan TEXT DEFAULT 'Private Beta',
  joined_date TEXT,
  memories_indexed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create oauth_tokens table (for connected platforms)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'reddit', 'gmail', 'github', 'notion', 'google_calendar'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  scope TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Create sync_status table (track sync progress per platform)
CREATE TABLE IF NOT EXISTS sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'reddit', 'gmail', 'github', 'notion', 'google_calendar'
  last_sync_at TIMESTAMP,
  next_sync_at TIMESTAMP,
  sync_progress INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0,
  status TEXT DEFAULT 'idle', -- 'idle', 'syncing', 'error'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Create raw_events table (store raw data from platforms)
CREATE TABLE IF NOT EXISTS raw_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  platform_id TEXT NOT NULL, -- unique ID from platform
  event_type TEXT, -- 'post', 'comment', 'email', 'commit', etc.
  title TEXT,
  content TEXT,
  author TEXT,
  timestamp TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  is_flagged BOOLEAN DEFAULT FALSE,
  flag_severity TEXT, -- 'low', 'medium', 'high'
  flag_reason TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create embeddings table (for RAG/semantic search)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES raw_events(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI ada-002 dimension
  created_at TIMESTAMP DEFAULT now()
);

-- Create topics table (for clustering)
CREATE TABLE IF NOT EXISTS topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_ids UUID[] DEFAULT ARRAY[]::UUID[],
  sentiment TEXT, -- 'positive', 'neutral', 'negative'
  connection_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Enable RLS (Row Level Security)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can only see their own profile" ON user_profiles;
CREATE POLICY "Users can only see their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;
CREATE POLICY "Users can update their own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
CREATE POLICY "Users can insert their own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only see their own oauth tokens" ON oauth_tokens;
CREATE POLICY "Users can only see their own oauth tokens" ON oauth_tokens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own oauth tokens" ON oauth_tokens;
CREATE POLICY "Users can insert their own oauth tokens" ON oauth_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own oauth tokens" ON oauth_tokens;
CREATE POLICY "Users can update their own oauth tokens" ON oauth_tokens
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only see their own sync status" ON sync_status;
CREATE POLICY "Users can only see their own sync status" ON sync_status
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only see their own events" ON raw_events;
CREATE POLICY "Users can only see their own events" ON raw_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only see their own embeddings" ON embeddings;
CREATE POLICY "Users can only see their own embeddings" ON embeddings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can only see their own topics" ON topics;
CREATE POLICY "Users can only see their own topics" ON topics
  FOR SELECT USING (auth.uid() = user_id);

-- Create indexes for performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'raw_events_user_platform_platform_id_unique'
  ) THEN
    ALTER TABLE raw_events
      ADD CONSTRAINT raw_events_user_platform_platform_id_unique UNIQUE (user_id, platform, platform_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_raw_events_user_platform ON raw_events(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_raw_events_timestamp ON raw_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user_platform ON oauth_tokens(user_id, platform);
CREATE INDEX IF NOT EXISTS idx_sync_status_user ON sync_status(user_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_user ON embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);

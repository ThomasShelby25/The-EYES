-- Fix RLS policies for sync_status
DROP POLICY IF EXISTS "Users can insert their own sync status" ON sync_status;
CREATE POLICY "Users can insert their own sync status" ON sync_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sync status" ON sync_status;
CREATE POLICY "Users can update their own sync status" ON sync_status
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sync status" ON sync_status;
CREATE POLICY "Users can delete their own sync status" ON sync_status
  FOR DELETE USING (auth.uid() = user_id);

-- Fix RLS policies for raw_events
DROP POLICY IF EXISTS "Users can insert their own events" ON raw_events;
CREATE POLICY "Users can insert their own events" ON raw_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own events" ON raw_events;
CREATE POLICY "Users can update their own events" ON raw_events
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own events" ON raw_events;
CREATE POLICY "Users can delete their own events" ON raw_events
  FOR DELETE USING (auth.uid() = user_id);

-- Fix RLS policies for embeddings
DROP POLICY IF EXISTS "Users can insert their own embeddings" ON embeddings;
CREATE POLICY "Users can insert their own embeddings" ON embeddings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own embeddings" ON embeddings;
CREATE POLICY "Users can update their own embeddings" ON embeddings
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own embeddings" ON embeddings;
CREATE POLICY "Users can delete their own embeddings" ON embeddings
  FOR DELETE USING (auth.uid() = user_id);

-- Fix RLS policies for topics
DROP POLICY IF EXISTS "Users can insert their own topics" ON topics;
CREATE POLICY "Users can insert their own topics" ON topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own topics" ON topics;
CREATE POLICY "Users can update their own topics" ON topics
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own topics" ON topics;
CREATE POLICY "Users can delete their own topics" ON topics
  FOR DELETE USING (auth.uid() = user_id);

-- Ensure user_profiles also has delete permission (for account reset)
DROP POLICY IF EXISTS "Users can delete their own profile" ON user_profiles;
CREATE POLICY "Users can delete their own profile" ON user_profiles
  FOR DELETE USING (auth.uid() = user_id);

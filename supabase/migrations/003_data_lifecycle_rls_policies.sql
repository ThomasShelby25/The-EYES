-- Add write/delete policies required by lifecycle controls and cleanup routes.

-- oauth_tokens
DROP POLICY IF EXISTS "Users can delete their own oauth tokens" ON oauth_tokens;
CREATE POLICY "Users can delete their own oauth tokens" ON oauth_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- sync_status
DROP POLICY IF EXISTS "Users can insert their own sync status" ON sync_status;
CREATE POLICY "Users can insert their own sync status" ON sync_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sync status" ON sync_status;
CREATE POLICY "Users can update their own sync status" ON sync_status
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sync status" ON sync_status;
CREATE POLICY "Users can delete their own sync status" ON sync_status
  FOR DELETE USING (auth.uid() = user_id);

-- raw_events
DROP POLICY IF EXISTS "Users can insert their own events" ON raw_events;
CREATE POLICY "Users can insert their own events" ON raw_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own events" ON raw_events;
CREATE POLICY "Users can update their own events" ON raw_events
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own events" ON raw_events;
CREATE POLICY "Users can delete their own events" ON raw_events
  FOR DELETE USING (auth.uid() = user_id);

-- embeddings
DROP POLICY IF EXISTS "Users can insert their own embeddings" ON embeddings;
CREATE POLICY "Users can insert their own embeddings" ON embeddings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own embeddings" ON embeddings;
CREATE POLICY "Users can delete their own embeddings" ON embeddings
  FOR DELETE USING (auth.uid() = user_id);

-- topics
DROP POLICY IF EXISTS "Users can insert their own topics" ON topics;
CREATE POLICY "Users can insert their own topics" ON topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own topics" ON topics;
CREATE POLICY "Users can update their own topics" ON topics
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own topics" ON topics;
CREATE POLICY "Users can delete their own topics" ON topics
  FOR DELETE USING (auth.uid() = user_id);

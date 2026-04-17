import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertSyncStatusSafely } from '@/utils/supabase/upsert';

export async function POST(request: Request) {
  const actor = await resolveSyncActor(request);
  if ('status' in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { supabase, userId } = actor;

  try {
    // 1. Get Token
    const { data: tokenData } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'linkedin')
      .single();

    if (!tokenData) return NextResponse.json({ error: 'No token found' }, { status: 404 });

    // 2. Mock Fetching
    const mockEvents = [
      {
        user_id: userId,
        platform: 'linkedin',
        platform_id: `li_${Date.now()}`,
        event_type: 'post',
        title: 'New LinkedIn Post',
        content: 'I am thrilled to announce that I have joined the EYES team as a Lead Developer!',
        author: 'User',
        timestamp: new Date().toISOString(),
        metadata: { likes: 42 }
      }
    ];

    // 3. Save Events
    const { error: eventError } = await supabase
      .from('raw_events')
      .upsert(mockEvents, { onConflict: 'user_id,platform,platform_id' });

    if (eventError) throw eventError;

    // 4. Update Sync Status & Profile
    const { count: totalMemories } = await supabase
      .from('raw_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const now = new Date().toISOString();
    await Promise.all([
      upsertSyncStatusSafely(supabase, {
        user_id: userId,
        platform: 'linkedin',
        status: 'connected',
        sync_progress: 100,
        total_items: mockEvents.length,
        last_sync_at: now,
        next_sync_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        error_message: null,
      }),
      supabase.from('user_profiles').update({
        memories_indexed: totalMemories ?? mockEvents.length,
        updated_at: now,
      }).eq('user_id', userId),
    ]);

    return NextResponse.json({ success: true, count: mockEvents.length });
  } catch (err) {
    console.error('LinkedIn Sync Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

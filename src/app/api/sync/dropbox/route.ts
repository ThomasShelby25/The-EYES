import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertRawEventsSafely, upsertSyncStatusSafely } from '@/utils/supabase/upsert';
import { decryptToken } from '@/utils/tokens';
import { scoreDropboxEvent } from '@/utils/risk/scorer';

export async function POST(request: Request) {
  try {
    const actor = await resolveSyncActor(request);
    if ('status' in actor) {
      return NextResponse.json({ error: actor.error }, { status: actor.status });
    }

    const { supabase, userId } = actor;

    const { data: tokenRow } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .eq('platform', 'dropbox')
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return NextResponse.json({ error: 'Dropbox is not connected yet.' }, { status: 400 });
    }

    const accessToken = decryptToken(tokenRow.access_token);

    const urlParams = new URL(request.url).searchParams;
    const depth = urlParams.get('depth') || 'shallow';
    const limit = depth === 'deep' ? 100 : 10;

    // List recent files
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        path: '',
        recursive: true,
        limit: limit
      })
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Dropbox API failed (${response.status})` }, { status: 502 });
    }

    const data = await response.json();
    const entries = (data.entries || []) as any[];

    const events = entries
      .filter(entry => entry['.tag'] === 'file')
      .map(entry => {
        const risk = scoreDropboxEvent({ name: entry.name, path: entry.path_display });
        
        return {
          user_id: userId,
          platform: 'dropbox',
          platform_id: entry.id,
          event_type: 'file',
          title: entry.name,
          content: entry.path_display || entry.name,
          author: 'Dropbox',
          timestamp: entry.server_modified || new Date().toISOString(),
          metadata: { ...entry },
          is_flagged: risk.flagged,
          flag_severity: risk.severity,
          flag_reason: risk.reasons.join(', ')
        };
      });

    await upsertRawEventsSafely(supabase, events);

    const { count: totalMemories } = await supabase
      .from('raw_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const now = new Date().toISOString();
    await Promise.all([
      upsertSyncStatusSafely(supabase, {
        user_id: userId,
        platform: 'dropbox',
        status: 'connected',
        sync_progress: 100,
        total_items: events.length,
        last_sync_at: now,
        next_sync_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        error_message: null,
      }),
      supabase.from('user_profiles').update({
        memories_indexed: totalMemories ?? events.length,
        updated_at: now,
      }).eq('user_id', userId),
    ]);

    return NextResponse.json({ ok: true, count: events.length });
  } catch (error) {
    console.error('Dropbox sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

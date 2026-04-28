import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertSyncStatusSafely, upsertRawEventsSafely } from '@/utils/supabase/upsert';
import { getValidSlackToken } from '@/utils/oauth';
import { scoreSlackEvent } from '@/utils/risk/scorer';

export async function POST(request: Request) {
  const actor = await resolveSyncActor(request);
  if ('status' in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { supabase, userId } = actor;

  try {
    // 1. Get existing sync status to retrieve channel cursors from metadata
    const { data: currentStatus } = await supabase
      .from('sync_status')
      .select('metadata, total_items')
      .eq('user_id', userId)
      .eq('platform', 'slack')
      .maybeSingle();

    const channelCursors = (currentStatus?.metadata?.channel_cursors || {}) as Record<string, string>;

    // 2. Get Valid Token
    const accessToken = await getValidSlackToken(supabase, userId);
    if (!accessToken) return NextResponse.json({ error: 'No Slack token found' }, { status: 404 });

    // Mark as 'syncing'
    await upsertSyncStatusSafely(supabase, {
      user_id: userId,
      platform: 'slack',
      status: 'syncing',
      last_sync_at: new Date().toISOString(),
    });

    // 3. Fetch Slack Context
    const channelsResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });

    const channelData = await channelsResponse.json();
    if (!channelData.ok) throw new Error(`Slack API error: ${channelData.error}`);

    const url = new URL(request.url);
    const depth = url.searchParams.get('depth') || 'shallow';
    const channelLimit = depth === 'deep' ? 20 : 5;
    const messageLimit = depth === 'deep' ? 100 : 20;

    const activeChannels = (channelData.channels || []).filter((c: any) => c.is_member).slice(0, channelLimit);
    
    // 4. Fetch History for each channel (using cursors for deep sync)
    const historyPromises = activeChannels.map(async (channel: any) => {
      // Use the stored timestamp (cursor) as the 'latest' parameter to pull OLDER messages
      const latest = channelCursors[channel.id] || null;
      const fetchUrl = new URL('https://slack.com/api/conversations.history');
      fetchUrl.searchParams.set('channel', channel.id);
      fetchUrl.searchParams.set('limit', messageLimit.toString());
      if (latest) fetchUrl.searchParams.set('latest', latest);

      const resp = await fetch(fetchUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await resp.json();
      return { channel, messages: data.ok ? data.messages : [], hasMore: data.has_more };
    });

    const histories = await Promise.all(historyPromises);

    // 5. Transform to Events
    const events: any[] = [];
    const updatedCursors = { ...channelCursors };
    let hasMoreOverall = false;

    for (const { channel, messages, hasMore } of histories) {
      if (hasMore) hasMoreOverall = true;

      for (const msg of messages) {
        if (!msg.text || msg.subtype === 'bot_message') continue;

        const risk = await scoreSlackEvent({
          text: msg.text,
          channelName: channel.name,
          user: 'User' // We don't have the current user name here easily
        });

        events.push({
          user_id: userId,
          platform: 'slack',
          platform_id: `msg_${msg.client_msg_id || msg.ts}`,
          event_type: 'message',
          title: `Message in #${channel.name}`,
          content: msg.text,
          author: msg.user || 'Unknown',
          timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
          is_flagged: risk.flagged,
          flag_severity: risk.severity,
          flag_reason: risk.reasons.join(', '),
          metadata: { ...msg, channel_id: channel.id, channel_name: channel.name }
        });
        
        // Update the cursor for this channel to the oldest message in this batch
        if (!updatedCursors[channel.id] || parseFloat(msg.ts) < parseFloat(updatedCursors[channel.id])) {
          updatedCursors[channel.id] = msg.ts;
        }
      }
    }

    // 6. Save Events
    if (events.length > 0) {
      await upsertRawEventsSafely(supabase, events);
    }

    // 7. Update Sync Status & Profile
    const { count: totalMemories } = await supabase
      .from('raw_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const now = new Date().toISOString();
    await Promise.all([
      upsertSyncStatusSafely(supabase, {
        user_id: userId,
        platform: 'slack',
        status: hasMoreOverall ? 'syncing' : 'connected',
        sync_progress: hasMoreOverall ? 50 : 100,
        total_items: (currentStatus?.total_items || 0) + events.length,
        last_sync_at: now,
        next_sync_at: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
        metadata: { channel_cursors: updatedCursors },
        error_message: null,
      }),
      supabase.from('user_profiles').update({
        memories_indexed: totalMemories ?? events.length,
        updated_at: now,
      }).eq('user_id', userId),
    ]);

    return NextResponse.json({ 
      success: true, 
      count: events.length, 
      hasMore: hasMoreOverall,
      totalMemories 
    });
  } catch (err) {
    console.error('Slack Sync Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

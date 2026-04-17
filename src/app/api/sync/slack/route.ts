import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertSyncStatusSafely } from '@/utils/supabase/upsert';
import { getValidSlackToken } from '@/utils/oauth';
import { scoreSlackEvent } from '@/utils/risk/scorer';

export async function POST(request: Request) {
  const actor = await resolveSyncActor(request);
  if ('status' in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { supabase, userId } = actor;

  try {
    // 1. Get Valid Token
    const accessToken = await getValidSlackToken(supabase, userId);
    if (!accessToken) return NextResponse.json({ error: 'No Slack token found' }, { status: 404 });

    // 2. Fetch Slack Context
    const [authResponse, channelsResponse] = await Promise.all([
      fetch('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        cache: 'no-store',
      }),
      fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
    ]);

    const authData = await authResponse.json();
    const channelData = await channelsResponse.json();

    if (!authData.ok) {
        throw new Error(`Slack Auth Test failed: ${authData.error}`);
    }

    // 3. Fetch History for each channel (Concurrent with small limit)
    const activeChannels = (channelData.channels || []).filter((c: any) => c.is_member).slice(0, 5);
    const historyPromises = activeChannels.map(async (channel: any) => {
      const resp = await fetch(`https://slack.com/api/conversations.history?channel=${channel.id}&limit=20`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await resp.json();
      return { channel, messages: data.ok ? data.messages : [] };
    });

    const Histories = await Promise.all(historyPromises);

    // 4. Transform to Events
    const events: any[] = [
      {
        user_id: userId,
        platform: 'slack',
        platform_id: `team_${authData.team_id}`,
        event_type: 'workspace',
        title: `Slack Workspace: ${authData.team}`,
        content: `Connected to Slack workspace "${authData.team}" (ID: ${authData.team_id}) as user "${authData.user}" (ID: ${authData.user_id}).`,
        author: authData.user,
        timestamp: new Date().toISOString(),
        metadata: { ...authData }
      }
    ];

    for (const { channel, messages } of Histories) {
      messages.forEach((msg: any) => {
        if (!msg.text || msg.subtype === 'bot_message') return;

        const risk = scoreSlackEvent({
          text: msg.text,
          channelName: channel.name,
          user: authData.user
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
      });
    }

    // 5. Save Events
    const { error: eventError } = await supabase
      .from('raw_events')
      .upsert(events, { onConflict: 'user_id,platform,platform_id' });

    if (eventError) throw eventError;

    // 5. Update Sync Status & Profile
    const { count: totalMemories } = await supabase
      .from('raw_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const now = new Date().toISOString();
    await Promise.all([
      upsertSyncStatusSafely(supabase, {
        user_id: userId,
        platform: 'slack',
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

    return NextResponse.json({ success: true, count: events.length });
  } catch (err) {
    console.error('Slack Sync Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

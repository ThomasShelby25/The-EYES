import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertSyncStatusSafely, upsertRawEventsSafely } from '@/utils/supabase/upsert';
import { getValidDiscordToken } from '@/utils/oauth';
import { scoreDiscordEvent } from '@/utils/risk/scorer';

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
      .eq('platform', 'discord')
      .maybeSingle();

    const channelCursors = (currentStatus?.metadata?.channel_cursors || {}) as Record<string, string>;

    // 2. Get Valid Token
    const accessToken = await getValidDiscordToken(supabase, userId);
    if (!accessToken) return NextResponse.json({ error: 'No Discord token found or refresh failed' }, { status: 404 });

    // Mark as 'syncing'
    await upsertSyncStatusSafely(supabase, {
      user_id: userId,
      platform: 'discord',
      status: 'syncing',
      last_sync_at: new Date().toISOString(),
    });

    // 3. Fetch User Profile & Guilds
    const [userResponse, guildsResponse] = await Promise.all([
      fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }),
      fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      })
    ]);

    if (!userResponse.ok) throw new Error(`Discord User API failed: ${userResponse.status}`);

    const discordUser = await userResponse.json();
    const discordGuilds = guildsResponse.ok ? await guildsResponse.json() : [];

    // 4. Fetch Private Channels (DMs) & History using cursors
    const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    
    const dmChannels = dmResponse.ok ? await dmResponse.json() : [];
    const url = new URL(request.url);
    const depth = url.searchParams.get('depth') || 'shallow';
    const dmLimit = depth === 'deep' ? 20 : 5;
    const messageLimit = depth === 'deep' ? 100 : 20;

    const activeDMs = dmChannels.slice(0, dmLimit);

    const messagePromises = activeDMs.map(async (channel: any) => {
      // Use the stored message ID as 'before' to pull OLDER messages
      const beforeId = channelCursors[channel.id] || null;
      const fetchUrl = new URL(`https://discord.com/api/v10/channels/${channel.id}/messages`);
      fetchUrl.searchParams.set('limit', messageLimit.toString());
      if (beforeId) fetchUrl.searchParams.set('before', beforeId);

      const resp = await fetch(fetchUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await resp.json();
      return { channel, messages: Array.isArray(data) ? data : [] };
    });

    const dmHistories = await Promise.all(messagePromises);

    // 5. Transform to Events
    const events: any[] = [
      {
        user_id: userId,
        platform: 'discord',
        platform_id: `user_${discordUser.id}`,
        event_type: 'profile',
        title: `Discord Profile: ${discordUser.username}`,
        content: `Discord user ${discordUser.username}#${discordUser.discriminator} (${discordUser.id}). Email: ${discordUser.email || 'unset'}.`,
        author: discordUser.username,
        timestamp: new Date().toISOString(),
        metadata: { ...discordUser }
      }
    ];

    const updatedCursors = { ...channelCursors };
    let hasMoreOverall = false;

    for (const { channel, messages } of dmHistories) {
      if (messages.length >= messageLimit) hasMoreOverall = true;

      for (const msg of messages) {
        if (!msg.content || msg.author?.bot) continue;

        const risk = await scoreDiscordEvent({
          text: msg.content,
          channelName: channel.name || 'Personal DM',
          user: discordUser.username
        });

        events.push({
          user_id: userId,
          platform: 'discord',
          platform_id: `msg_${msg.id}`,
          event_type: 'message',
          title: `DM with ${channel.recipients?.map((r: any) => r.username).join(', ') || 'Community'}`,
          content: msg.content,
          author: msg.author?.username || 'Unknown',
          timestamp: new Date(msg.timestamp).toISOString(),
          is_flagged: risk.flagged,
          flag_severity: risk.severity,
          flag_reason: risk.reasons.join(', '),
          metadata: { ...msg, channel_id: channel.id }
        });

        // Update the cursor to the oldest message in this batch (smallest ID)
        if (!updatedCursors[channel.id] || BigInt(msg.id) < BigInt(updatedCursors[channel.id])) {
          updatedCursors[channel.id] = msg.id;
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
        platform: 'discord',
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
    console.error('Discord Sync Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

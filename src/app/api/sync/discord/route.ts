import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertSyncStatusSafely } from '@/utils/supabase/upsert';
import { getValidDiscordToken } from '@/utils/oauth';
import { scoreDiscordEvent } from '@/utils/risk/scorer';

export async function POST(request: Request) {
  const actor = await resolveSyncActor(request);
  if ('status' in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { supabase, userId } = actor;

  try {
    // 1. Get Valid Token
    const accessToken = await getValidDiscordToken(supabase, userId);
    if (!accessToken) return NextResponse.json({ error: 'No Discord token found or refresh failed' }, { status: 404 });

    // 2. Fetch User Profile & Guilds
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

    // 3. Fetch Private Channels (DMs) & Recent Messages
    const dmResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    
    const dmChannels = dmResponse.ok ? await dmResponse.json() : [];
    const url = new URL(request.url);
    const depth = url.searchParams.get('depth') || 'shallow';
    const dmLimit = depth === 'deep' ? 15 : 5;
    const messageLimit = depth === 'deep' ? 100 : 20;

    const activeDMs = dmChannels.slice(0, dmLimit);

    const messagePromises = activeDMs.map(async (channel: any) => {
      const resp = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages?limit=${messageLimit}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });
      const data = await resp.json();
      return { channel, messages: Array.isArray(data) ? data : [] };
    });

    const dmHistories = await Promise.all(messagePromises);

    // 4. Transform to Events
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
      },
      ...discordGuilds.slice(0, 5).map((guild: any) => ({
        user_id: userId,
        platform: 'discord',
        platform_id: `guild_${guild.id}`,
        event_type: 'guild',
        title: `Discord Server: ${guild.name}`,
        content: `Member of Discord server "${guild.name}". Permissions: ${guild.permissions}. Owner: ${guild.owner}.`,
        author: discordUser.username,
        timestamp: new Date().toISOString(),
        metadata: { ...guild }
      }))
    ];

    for (const { channel, messages } of dmHistories) {
      messages.forEach((msg: any) => {
        if (!msg.content || msg.author?.bot) return;

        const risk = scoreDiscordEvent({
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
        platform: 'discord',
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
    console.error('Discord Sync Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

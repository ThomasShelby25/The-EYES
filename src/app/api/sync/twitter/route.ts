import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertRawEventsSafely, upsertSyncStatusSafely } from '@/utils/supabase/upsert';
import { decryptToken } from '@/utils/tokens';
import { scoreTwitterEvent } from '@/utils/risk/scorer';

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
      .eq('platform', 'twitter')
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return NextResponse.json({ error: 'X (Twitter) is not connected yet.' }, { status: 400 });
    }

    const accessToken = decryptToken(tokenRow.access_token);

    // Fetch user profile to get handle
    const meResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    });

    if (!meResponse.ok) {
      return NextResponse.json({ error: `X API failed to fetch profile (${meResponse.status})` }, { status: 502 });
    }

    const meData = await meResponse.json();
    const twitterId = meData.data.id;

    const urlParams = new URL(request.url).searchParams;
    const depth = urlParams.get('depth') || 'shallow';
    const maxResults = depth === 'deep' ? 50 : 10;

    // Fetch recent tweets (v2 API)
    const tweetsResponse = await fetch(`https://api.twitter.com/2/users/${twitterId}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store'
    });

    if (!tweetsResponse.ok) {
       // Graceful fallback for rate limits or other issues
       return NextResponse.json({ error: `X API failed to fetch tweets (${tweetsResponse.status})` }, { status: 502 });
    }

    const tweetData = await tweetsResponse.json();
    const tweets = tweetData.data || [];

    const events = tweets.map((tweet: any) => {
      const risk = scoreTwitterEvent({ 
        text: tweet.text, 
        reach: tweet.public_metrics?.impression_count || tweet.public_metrics?.retweet_count * 10 
      });

      return {
        user_id: userId,
        platform: 'twitter',
        platform_id: tweet.id,
        event_type: 'tweet',
        title: 'Post on X',
        content: tweet.text,
        author: meData.data.username,
        timestamp: tweet.created_at || new Date().toISOString(),
        metadata: { ...tweet },
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
        platform: 'twitter',
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
    console.error('X (Twitter) sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

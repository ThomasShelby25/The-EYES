import { NextResponse } from 'next/server';

import { upsertRawEventsSafely, upsertSyncStatusSafely } from '@/utils/supabase/upsert';
import { decryptToken } from '@/utils/tokens';
import { scoreRedditEvent } from '@/utils/risk/scorer';
import { resolveSyncActor } from '@/utils/sync/actor';

type RedditMe = { name: string };

type RedditCommentListing = {
  data?: {
    children?: Array<{
      data: {
        id: string;
        name: string;
        body?: string;
        subreddit?: string;
        permalink?: string;
        score?: number;
        created_utc?: number;
      };
    }>;
  };
};

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
      .eq('platform', 'reddit')
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return NextResponse.json({ error: 'Reddit is not connected yet.' }, { status: 400 });
    }

    const accessToken = decryptToken(tokenRow.access_token);

    const meResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'the-eyes/1.0',
      },
      cache: 'no-store',
    });

    if (!meResponse.ok) {
      return NextResponse.json({ error: `Reddit profile request failed (${meResponse.status})` }, { status: 502 });
    }

    const me = (await meResponse.json()) as RedditMe;

    const commentsResponse = await fetch(`https://oauth.reddit.com/user/${me.name}/comments?limit=10`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'the-eyes/1.0',
      },
      cache: 'no-store',
    });

    if (!commentsResponse.ok) {
      return NextResponse.json({ error: `Reddit comments request failed (${commentsResponse.status})` }, { status: 502 });
    }

    const commentsBody = (await commentsResponse.json()) as RedditCommentListing;
    const comments = commentsBody.data?.children ?? [];

    const events = comments.map((entry) => {
      const data = entry.data;
      const content = data.body || '';
      const risk = scoreRedditEvent({
        body: content,
        subreddit: data.subreddit || '',
        score: data.score,
      });

      return {
        user_id: userId,
        platform: 'reddit',
        platform_id: data.name || data.id,
        event_type: 'comment',
        title: `r/${data.subreddit || 'unknown'} comment`,
        content,
        author: me.name,
        timestamp: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : new Date().toISOString(),
        metadata: {
          subreddit: data.subreddit,
          permalink: data.permalink,
          score: data.score,
          risk_score: risk.score,
          risk_factors: risk.reasons,
        },
        is_flagged: risk.flagged,
        flag_severity: risk.severity,
        flag_reason: risk.reasons[0] || null,
      };
    });

    await upsertRawEventsSafely(supabase, events);

    const { count: totalMemories } = await supabase
      .from('raw_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    const [, profileUpdate] = await Promise.all([
      upsertSyncStatusSafely(supabase, {
        user_id: userId,
        platform: 'reddit',
        status: 'connected',
        sync_progress: 100,
        total_items: events.length,
        last_sync_at: new Date().toISOString(),
        next_sync_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
        error_message: null,
      }),
      supabase.from('user_profiles').update({
        memories_indexed: totalMemories ?? events.length,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId),
    ]);

    if (profileUpdate.error) {
      throw profileUpdate.error;
    }

    return NextResponse.json({ ok: true, syncedComments: events.length });
  } catch (error) {
    console.error('reddit sync error:', error);
    return NextResponse.json({ error: 'Unable to sync Reddit data right now.' }, { status: 500 });
  }
}

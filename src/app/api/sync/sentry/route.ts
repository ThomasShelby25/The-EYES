import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertSyncStatusSafely, upsertRawEventsSafely } from '@/utils/supabase/upsert';
import { decryptToken } from '@/utils/tokens';

export async function POST(request: Request) {
  const actor = await resolveSyncActor(request);
  if ('status' in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { supabase, userId } = actor;

  try {
    const { data: tokenRow } = await supabase
      .from('oauth_tokens')
      .select('access_token')
      .eq('user_id', userId)
      .eq('platform', 'sentry')
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return NextResponse.json({ error: 'Sentry is not connected' }, { status: 401 });
    }

    const accessToken = decryptToken(tokenRow.access_token);

    // Mark as syncing
    await upsertSyncStatusSafely(supabase, {
      user_id: userId,
      platform: 'sentry',
      status: 'syncing',
      last_sync_at: new Date().toISOString(),
    });

    // Fetch Issues from Sentry
    const response = await fetch('https://sentry.io/api/0/projects/me/issues/?limit=20', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const issues = await response.json();
    if (!response.ok) throw new Error('Sentry API Error');

    const events = issues.map((issue: any) => {
      const isHighSeverity = issue.level === 'error' || issue.level === 'fatal';
      return {
        user_id: userId,
        platform: 'sentry',
        platform_id: issue.id,
        event_type: 'issue',
        title: `Sentry: ${issue.title}`,
        content: `${issue.culprit} | Level: ${issue.level} | Project: ${issue.project?.slug}`,
        author: 'Sentry',
        timestamp: issue.lastSeen,
        is_flagged: isHighSeverity,
        flag_severity: isHighSeverity ? 'HIGH' : 'MEDIUM',
        flag_reason: isHighSeverity ? 'Production error detected' : 'Warning detected',
        metadata: {
          id: issue.id,
          permalink: issue.permalink,
          level: issue.level,
          project: issue.project?.slug,
        }
      };
    });

    if (events.length > 0) {
      await upsertRawEventsSafely(supabase, events);
    }

    const now = new Date().toISOString();
    await upsertSyncStatusSafely(supabase, {
      user_id: userId,
      platform: 'sentry',
      status: 'connected',
      sync_progress: 100,
      total_items: events.length,
      last_sync_at: now,
      next_sync_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    });

    return NextResponse.json({ success: true, count: events.length });
  } catch (err) {
    console.error('Sentry Sync Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertSyncStatusSafely, upsertRawEventsSafely } from '@/utils/supabase/upsert';
import { getValidVercelToken } from '@/utils/oauth';

export async function POST(request: Request) {
  const actor = await resolveSyncActor(request);
  if ('status' in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { supabase, userId } = actor;

  try {
    const accessToken = await getValidVercelToken(supabase, userId);
    if (!accessToken) {
      return NextResponse.json({ error: 'Vercel is not connected' }, { status: 401 });
    }

    // Mark as syncing
    await upsertSyncStatusSafely(supabase, {
      user_id: userId,
      platform: 'vercel',
      status: 'syncing',
      last_sync_at: new Date().toISOString(),
    });

    // Fetch Deployments from Vercel
    const response = await fetch('https://api.vercel.com/v6/deployments?limit=30', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || 'Vercel API Error');

    const deployments = body.deployments || [];
    
    const events = deployments.map((dep: any) => {
      const isFailed = dep.state === 'ERROR';
      return {
        user_id: userId,
        platform: 'vercel',
        platform_id: dep.uid,
        event_type: 'deployment',
        title: `Deployment: ${dep.name}`,
        content: `State: ${dep.state} | URL: ${dep.url} | Branch: ${dep.meta?.githubCommitRef || 'main'}`,
        author: dep.creator?.username || 'Vercel',
        timestamp: new Date(dep.createdAt).toISOString(),
        is_flagged: isFailed,
        flag_severity: isFailed ? 'HIGH' : 'LOW',
        flag_reason: isFailed ? 'Deployment failed' : null,
        metadata: {
          uid: dep.uid,
          url: dep.url,
          state: dep.state,
          inspectorUrl: dep.inspectorUrl,
        }
      };
    });

    if (events.length > 0) {
      await upsertRawEventsSafely(supabase, events);
    }

    const now = new Date().toISOString();
    await upsertSyncStatusSafely(supabase, {
      user_id: userId,
      platform: 'vercel',
      status: 'connected',
      sync_progress: 100,
      total_items: events.length,
      last_sync_at: now,
      next_sync_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    });

    return NextResponse.json({ success: true, count: events.length });
  } catch (err) {
    console.error('Vercel Sync Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

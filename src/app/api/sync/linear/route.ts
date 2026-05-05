import { NextResponse } from 'next/server';
import { resolveSyncActor } from '@/utils/sync/actor';
import { upsertSyncStatusSafely, upsertRawEventsSafely } from '@/utils/supabase/upsert';
import { getValidLinearToken } from '@/utils/oauth';
import { scoreLinearEvent } from '@/utils/risk/scorer';

export async function POST(request: Request) {
  const actor = await resolveSyncActor(request);
  if ('status' in actor) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { supabase, userId } = actor;

  try {
    const accessToken = await getValidLinearToken(supabase, userId);
    if (!accessToken) {
      return NextResponse.json({ error: 'Linear is not connected' }, { status: 401 });
    }

    // Mark as syncing
    await upsertSyncStatusSafely(supabase, {
      user_id: userId,
      platform: 'linear',
      status: 'syncing',
      last_sync_at: new Date().toISOString(),
    });

    // Fetch Issues from Linear (GraphQL)
    const query = `
      query {
        issues(first: 50, orderBy: updatedAt) {
          nodes {
            id
            identifier
            title
            description
            url
            updatedAt
            labels {
              nodes {
                name
              }
            }
            creator {
              name
            }
          }
        }
      }
    `;

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    const body = await response.json();
    if (!response.ok) throw new Error(body.errors?.[0]?.message || 'Linear API Error');

    const issues = body.data?.issues?.nodes || [];
    
    const events = await Promise.all(issues.map(async (issue: any) => {
      const labels = issue.labels?.nodes?.map((l: any) => l.name).join(', ') || '';
      const risk = await scoreLinearEvent({
        title: issue.title,
        description: issue.description || '',
        label: labels,
      });

      return {
        user_id: userId,
        platform: 'linear',
        platform_id: issue.id,
        event_type: 'issue',
        title: `[${issue.identifier}] ${issue.title}`,
        content: issue.description || 'No description',
        author: issue.creator?.name || 'Unknown',
        timestamp: issue.updatedAt,
        is_flagged: risk.flagged,
        flag_severity: risk.severity,
        flag_reason: risk.reasons.join(', '),
        metadata: {
          identifier: issue.identifier,
          url: issue.url,
          labels,
        }
      };
    }));

    if (events.length > 0) {
      await upsertRawEventsSafely(supabase, events);
    }

    const now = new Date().toISOString();
    await upsertSyncStatusSafely(supabase, {
      user_id: userId,
      platform: 'linear',
      status: 'connected',
      sync_progress: 100,
      total_items: events.length,
      last_sync_at: now,
      next_sync_at: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    });

    return NextResponse.json({ success: true, count: events.length });
  } catch (err) {
    console.error('Linear Sync Error:', err);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

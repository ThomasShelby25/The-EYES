import { NextResponse } from 'next/server';

import { upsertRawEventsSafely, upsertSyncStatusSafely } from '@/utils/supabase/upsert';
import { decryptToken } from '@/utils/tokens';
import { resolveSyncActor } from '@/utils/sync/actor';
import { scoreNotionEvent } from '@/utils/risk/scorer';

type NotionSearchResult = {
  id: string;
  object: 'page' | 'database' | string;
  url?: string;
  last_edited_time?: string;
  properties?: Record<string, { type?: string; title?: Array<{ plain_text: string }> }>;
  title?: Array<{ plain_text: string }>;
};

type NotionSearchResponse = {
  results?: NotionSearchResult[];
};

function extractTitle(item: NotionSearchResult) {
  if (item.object === 'database' && item.title?.length) {
    return item.title.map((part) => part.plain_text).join(' ').trim() || 'Untitled database';
  }

  if (item.object === 'page' && item.properties) {
    const titleProperty = Object.values(item.properties).find((property) => property?.type === 'title');
    if (titleProperty?.title?.length) {
      return titleProperty.title.map((part) => part.plain_text).join(' ').trim() || 'Untitled page';
    }
  }

  return item.object === 'database' ? 'Untitled database' : 'Untitled page';
}

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
      .eq('platform', 'notion')
      .maybeSingle();

    if (!tokenRow?.access_token) {
      return NextResponse.json({ error: 'Notion is not connected yet.' }, { status: 400 });
    }

    const accessToken = decryptToken(tokenRow.access_token);

    const url = new URL(request.url);
    const depth = url.searchParams.get('depth') || 'shallow';
    const maxResultsPerPage = 100;
    const maxTotalResults = depth === 'deep' ? 300 : 50;

    let allResults: NotionSearchResult[] = [];
    let nextCursor: string | undefined = undefined;

    // --- PAGINATION LOOP ---
    while (allResults.length < maxTotalResults) {
      const searchResponse = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          page_size: maxResultsPerPage,
          start_cursor: nextCursor,
          sort: {
            direction: 'descending',
            timestamp: 'last_edited_time'
          }
        }),
        cache: 'no-store',
      });

      if (!searchResponse.ok) break;

      const body = (await searchResponse.json()) as { results?: NotionSearchResult[], next_cursor?: string | null };
      const pageResults = body.results ?? [];
      allResults = [...allResults, ...pageResults];
      
      nextCursor = body.next_cursor || undefined;
      if (!nextCursor) break;
    }

    const events = allResults.map((item) => {
      const title = extractTitle(item);
      const content = `${title} ${item.url || ''}`.trim();
      const risk = scoreNotionEvent({ title, content });

      return {
        user_id: userId,
        platform: 'notion',
        platform_id: item.id,
        event_type: item.object,
        title,
        content,
        author: 'Notion',
        timestamp: item.last_edited_time ? new Date(item.last_edited_time).toISOString() : new Date().toISOString(),
        metadata: {
          object: item.object,
          url: item.url,
        },
        is_flagged: risk.flagged,
        flag_severity: risk.severity,
        flag_reason: risk.reasons.join(', '),
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
        platform: 'notion',
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

    return NextResponse.json({ ok: true, syncedItems: events.length });
  } catch (error) {
    console.error('notion sync error:', error);
    return NextResponse.json({ error: 'Unable to sync Notion data right now.' }, { status: 500 });
  }
}

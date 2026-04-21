import { NextResponse } from 'next/server';

import { upsertRawEventsSafely, upsertSyncStatusSafely } from '@/utils/supabase/upsert';
import { getValidGoogleToken } from '@/utils/oauth';
import { scoreGmailEvent } from '@/utils/risk/scorer';
import { resolveSyncActor } from '@/utils/sync/actor';

type GmailListResponse = {
  messages?: Array<{ id: string }>;
};

type GmailMessageResponse = {
  id: string;
  snippet?: string;
  internalDate?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
};

function getHeader(headers: Array<{ name: string; value: string }> | undefined, key: string) {
  return headers?.find((header) => header.name.toLowerCase() === key.toLowerCase())?.value;
}

export async function POST(request: Request) {
  try {
    const actor = await resolveSyncActor(request);
    if ('status' in actor) {
      return NextResponse.json({ error: actor.error }, { status: actor.status });
    }

    const { supabase, userId } = actor;

    // 1. Mark as 'syncing' immediately for UI feedback
    await upsertSyncStatusSafely(supabase, {
      user_id: userId,
      platform: 'gmail',
      status: 'syncing',
      last_sync_at: new Date().toISOString(),
    });

    const accessToken = await getValidGoogleToken(supabase, userId, 'gmail');
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Gmail session expired and refresh failed.' }, { status: 401 });
    }

    const url = new URL(request.url);
    const depth = url.searchParams.get('depth') || 'shallow';
    const maxResultsPerPage = 50; 
    const maxTotalResults = depth === 'deep' ? 200 : 10; // Batch limit per cron run

    let allMessageIds: string[] = [];
    let nextPageToken: string | undefined = undefined;

    // --- PAGINATION LOOP ---
    while (allMessageIds.length < maxTotalResults) {
      const fetchUrl = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      fetchUrl.searchParams.set('maxResults', Math.min(maxResultsPerPage, maxTotalResults - allMessageIds.length).toString());
      if (nextPageToken) fetchUrl.searchParams.set('pageToken', nextPageToken);

      const listResponse = await fetch(fetchUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      });

      if (!listResponse.ok) break;

      const listBody = (await listResponse.json()) as { messages?: Array<{ id: string }>, nextPageToken?: string };
      const pageIds = (listBody.messages ?? []).map((m) => m.id);
      allMessageIds = [...allMessageIds, ...pageIds];
      
      nextPageToken = listBody.nextPageToken;
      if (!nextPageToken) break;
    }

    const messageResponses = await Promise.all(
      allMessageIds.map((id) =>
        fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        }).then((response) => (response.ok ? response.json() : null))
      )
    );

    const messages = messageResponses.filter(Boolean) as GmailMessageResponse[];

    const events = messages.map((message) => {
      const subject = getHeader(message.payload?.headers, 'Subject') || 'No subject';
      const from = getHeader(message.payload?.headers, 'From') || 'Unknown sender';
      const content = `${subject} ${message.snippet || ''}`.trim();
      const ts = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : new Date().toISOString();
      const risk = scoreGmailEvent({
        subject,
        snippet: message.snippet || '',
        from,
      });

      return {
        user_id: userId,
        platform: 'gmail',
        platform_id: message.id,
        event_type: 'email',
        title: subject,
        content,
        author: from,
        timestamp: ts,
        metadata: {
          from,
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
        platform: 'gmail',
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

    return NextResponse.json({ ok: true, syncedMessages: events.length, totalMemories });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('gmail sync error:', error);
    return NextResponse.json({ 
      error: 'Unable to sync Gmail data.', 
      detail
    }, { status: 500 });
  }
}

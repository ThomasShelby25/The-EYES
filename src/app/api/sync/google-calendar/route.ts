import { NextResponse } from 'next/server';

import { getValidGoogleToken } from '@/utils/oauth';
import { upsertRawEventsSafely, upsertSyncStatusSafely } from '@/utils/supabase/upsert';
import { resolveSyncActor } from '@/utils/sync/actor';

type CalendarEventsResponse = {
  items?: Array<{
    id: string;
    summary?: string;
    description?: string;
    creator?: { email?: string };
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    htmlLink?: string;
  }>;
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
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'google_calendar')
      .maybeSingle();

    if (!tokenRow?.id) {
      return NextResponse.json({ error: 'Google Calendar is not connected yet.' }, { status: 400 });
    }

    const accessToken = await getValidGoogleToken(supabase, userId, 'google_calendar');
    if (!accessToken) {
      return NextResponse.json({ error: 'Google Calendar session expired and refresh failed.' }, { status: 401 });
    }

    const eventsResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString())}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
      }
    );

    if (!eventsResponse.ok) {
      const providerError = await eventsResponse.text();
      const status = [401, 403].includes(eventsResponse.status) ? eventsResponse.status : 502;
      return NextResponse.json(
        {
          error: `Calendar API request failed (${eventsResponse.status})`,
          detail: providerError.slice(0, 400),
        },
        { status }
      );
    }

    const body = (await eventsResponse.json()) as CalendarEventsResponse;
    const events = (body.items ?? []).map((item) => {
      const title = item.summary || 'Untitled event';
      const description = item.description || '';
      const ts = item.start?.dateTime || item.start?.date || new Date().toISOString();
      const content = `${title} ${description}`.trim();
      const isFlagged = /interview|confidential|medical|legal/i.test(content);

      return {
        user_id: userId,
        platform: 'google_calendar',
        platform_id: item.id,
        event_type: 'calendar_event',
        title,
        content,
        author: item.creator?.email || 'Google Calendar',
        timestamp: new Date(ts).toISOString(),
        metadata: {
          start: item.start,
          end: item.end,
          htmlLink: item.htmlLink,
        },
        is_flagged: isFlagged,
        flag_severity: isFlagged ? 'LOW' : 'LOW',
        flag_reason: isFlagged ? 'Potentially sensitive calendar event' : null,
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
        platform: 'google_calendar',
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

    return NextResponse.json({ ok: true, syncedEvents: events.length });
  } catch (error) {
    console.error('google-calendar sync error:', error);
    return NextResponse.json({ error: 'Unable to sync Google Calendar data right now.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getValidGoogleToken } from '@/utils/oauth';

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionId, actionType, title, description, date } = await req.json();

    if (actionType === 'CALENDAR') {
      // 1. Fetch Google Calendar Token
      const accessToken = await getValidGoogleToken(supabase, user.id, 'google_calendar');

      if (!accessToken) {
        return NextResponse.json({ error: 'Google Calendar not connected or token expired' }, { status: 400 });
      }

      // 2. Build Event Payload
      const eventStart = date ? new Date(date) : new Date();
      const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000); // 1 hour later

      const payload = {
        summary: title,
        description: description,
        start: { dateTime: eventStart.toISOString() },
        end: { dateTime: eventEnd.toISOString() }
      };

      // 3. Execute Write to Google Calendar
      const gcalRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!gcalRes.ok) {
        const errorText = await gcalRes.text();
        console.error('Google Calendar Write Failed:', errorText);
        
        // Check for Scope Error (Insufficient Permissions)
        if (gcalRes.status === 403 || errorText.includes('insufficient')) {
          return NextResponse.json({ 
            error: 'Insufficient Scopes', 
            details: 'Write permissions (calendar.events) are not enabled in your Google Cloud Console.' 
          }, { status: 403 });
        }
        
        return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Handle other action types (LINEAR_TICKET, etc.)
    return NextResponse.json({ success: true, simulated: true });

  } catch (error) {
    console.error('Action execution failed:', error);
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Danger Zone: Delete all memories for the user
    const { error: eventError } = await supabase
      .from('raw_events')
      .delete()
      .eq('user_id', user.id);

    if (eventError) throw eventError;

    // Optional: We could also wipe connections, but for the MVP "Wipe Neural Archive", clearing events is enough.

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to wipe archive:', error);
    return NextResponse.json({ error: 'Failed to wipe archive' }, { status: 500 });
  }
}

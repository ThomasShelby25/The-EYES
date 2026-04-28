import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Danger Zone: Delete all memories, vectors, and sync cursors for the user
    const { error: eventError } = await supabase
      .from('raw_events')
      .delete()
      .eq('user_id', user.id);

    if (eventError) throw eventError;

    const { error: embeddingError } = await supabase
      .from('embeddings')
      .delete()
      .eq('user_id', user.id);
      
    if (embeddingError) throw embeddingError;

    const { error: syncError } = await supabase
      .from('sync_status')
      .delete()
      .eq('user_id', user.id);

    if (syncError) throw syncError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to wipe archive:', error);
    return NextResponse.json({ error: 'Failed to wipe archive' }, { status: 500 });
  }
}

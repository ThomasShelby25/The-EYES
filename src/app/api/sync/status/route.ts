
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * Monitoring API: Returns a global view of the user's sync progress.
 * Used for the "Live Indexing Counter" in the dashboard.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get current sync status for all platforms
    const { data: statusRows } = await supabase
      .from('sync_status')
      .select('platform, status, sync_progress, total_items, last_sync_at, error_message')
      .eq('user_id', user.id);

    // 2. Get total memory count from profiles
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('memories_indexed')
      .eq('user_id', user.id)
      .single();

    const isAnySyncing = statusRows?.some(s => s.status === 'syncing') || false;
    const activeSyncs = statusRows?.filter(s => s.status === 'syncing').map(s => s.platform) || [];

    return NextResponse.json({
      userId: user.id,
      memoriesIndexed: profile?.memories_indexed || 0,
      isSyncing: isAnySyncing,
      activeSyncs,
      platforms: statusRows || [],
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Monitoring] Status API failure:', err);
    return NextResponse.json({ error: 'Unable to fetch engine status.' }, { status: 500 });
  }
}

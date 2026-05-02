import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * API Route to check the status of a specific Reputation Audit.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: audit, error: fetchError } = await supabase
      .from('reputation_audits')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !audit) {
      return NextResponse.json({ error: 'Audit not found or access denied.' }, { status: 404 });
    }

    return NextResponse.json(audit);

  } catch (err) {
    console.error('[Audit Status API] Failure:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

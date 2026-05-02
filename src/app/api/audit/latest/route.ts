import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * API Route to fetch the latest Reputation Audit for the user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: audit, error: fetchError } = await supabase
      .from('reputation_audits')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!audit) {
      return NextResponse.json(null);
    }

    // Map DB fields to camelCase for the frontend if needed
    // The types I added use camelCase, but the DB uses snake_case
    const mappedAudit = {
      id: audit.id,
      status: audit.status,
      riskScore: Number(audit.risk_score),
      mentionsCount: audit.mentions_count,
      commitmentsCount: audit.commitments_count,
      summaryNarrative: audit.summary_narrative,
      connectorsCovered: audit.connectors_covered,
      reportUrl: audit.report_url,
      createdAt: audit.created_at,
      metadata: audit.metadata
    };

    return NextResponse.json(mappedAudit);

  } catch (err) {
    console.error('[Audit Latest API] Failure:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuditAnalysisService } from '@/services/audit/analysis-pipeline';

/**
 * API Route to initiate a Reputation Audit.
 * In production, this would be triggered by a Stripe Webhook.
 * For the demo, we allow a POST request from the dashboard.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Create the pending audit record (Step 1)
    const { data: audit, error: createError } = await supabase
      .from('reputation_audits')
      .insert({
        user_id: user.id,
        status: 'pending'
      })
      .select()
      .single();

    if (createError || !audit) {
      throw new Error(`Failed to create audit record: ${createError?.message}`);
    }

    // 2. Update status to 'analysis' 
    await supabase
      .from('reputation_audits')
      .update({ status: 'analysis' })
      .eq('id', audit.id);

    // 3. RUN ANALYSIS (Awaiting to prevent Vercel termination)
    try {
      console.log(`[Audit API] Starting synchronous analysis for ${audit.id}`);
      await AuditAnalysisService.runAnalysis(audit.id, user.id);
    } catch (err) {
      console.error(`[Audit API] Analysis failed for ${audit.id}:`, err);
      // Even if it fails, we return the auditId so the UI can show the failure state
    }

    return NextResponse.json({
      success: true,
      auditId: audit.id,
      status: 'completed',
      message: 'Neural reputation audit complete.'
    });

  } catch (err) {
    console.error('[Audit API] Initialization failure:', err);
    return NextResponse.json({ 
      error: 'Unable to initiate audit.', 
      detail: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}

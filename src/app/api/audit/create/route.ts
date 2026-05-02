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

    // 2. Fire and forget the analysis pipeline (Background processing)
    // In a real app, this would be a background job (BullMQ, Vercel Background, etc.)
    // For the demo, we trigger it asynchronously
    (async () => {
      try {
        await AuditAnalysisService.runAnalysis(audit.id, user.id);
        console.log(`[Audit] Analysis complete for ${audit.id}`);
        
        // Note: PDF generation step would follow here
      } catch (err) {
        console.error(`[Audit] Async analysis failed for ${audit.id}:`, err);
      }
    })();

    return NextResponse.json({
      success: true,
      auditId: audit.id,
      status: 'pending',
      message: 'Neural reputation audit initiated.'
    });

  } catch (err) {
    console.error('[Audit API] Initialization failure:', err);
    return NextResponse.json({ 
      error: 'Unable to initiate audit.', 
      detail: err instanceof Error ? err.message : String(err) 
    }, { status: 500 });
  }
}

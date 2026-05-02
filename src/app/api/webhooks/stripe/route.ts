import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { AuditAnalysisService } from '@/services/audit/analysis-pipeline';

/**
 * Stripe Webhook Handler (Mock/Foundation)
 * Listens for audit.purchase.completed.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // In production, verify Stripe signature here
    // const sig = request.headers.get('stripe-signature');
    
    // For the demo, we assume the event is valid if it has the right type
    if (body.type === 'audit.purchase.completed') {
      const { userId } = body.data.object.metadata;

      if (!userId) {
        return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
      }

      const supabase = await createClient();
      
      // 1. Create audit record
      const { data: audit, error: createError } = await supabase
        .from('reputation_audits')
        .insert({
          user_id: userId,
          status: 'pending'
        })
        .select()
        .single();

      if (createError) throw createError;

      // 2. Trigger analysis
      // This is non-blocking
      AuditAnalysisService.runAnalysis(audit.id, userId).catch(err => {
        console.error('[Stripe Webhook] Background analysis failed:', err);
      });

      return NextResponse.json({ received: true, auditId: audit.id });
    }

    return NextResponse.json({ received: true, ignored: true });

  } catch (err) {
    console.error('[Stripe Webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

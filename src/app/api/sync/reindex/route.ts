import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateEmbedding } from '@/services/ai/ai';

/**
 * Neural Re-index: Regenerates 768-dimension embeddings for all existing raw_events.
 * This is the final step to fix the Chat 'not working' after the DB dimension change.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get raw events that don't have a matching 768d embedding yet
    // Or just all events if we want to be thorough
    const { data: events, error: fetchError } = await supabase
      .from('raw_events')
      .select('id, content')
      .eq('user_id', user.id)
      .limit(200); // Process in batches of 200 for stability

    if (fetchError || !events) {
      throw new Error(`Failed to fetch events for re-indexing: ${fetchError?.message}`);
    }

    console.log(`[Re-index] Processing ${events.length} records for user ${user.id}`);

    let successCount = 0;
    const errors = [];

    // 2. Loop through and generate real 768d embeddings
    for (const event of events) {
      try {
        const result = await generateEmbedding(event.content);
        if (result && result.embedding) {
          // Upsert into embeddings table
          const { error: upsertError } = await supabase
            .from('embeddings')
            .upsert({
              user_id: user.id,
              event_id: event.id,
              content: event.content,
              embedding: result.embedding
            }, { onConflict: 'event_id' });

          if (upsertError) throw upsertError;
          successCount++;
        }
      } catch (err) {
        errors.push({ id: event.id, error: String(err) });
      }
    }

    return NextResponse.json({
      success: true,
      processed: events.length,
      successCount,
      errors: errors.length > 0 ? errors : null,
      message: `Neural re-indexing complete for ${successCount} records.`
    });

  } catch (err) {
    console.error('[Re-index API] Failure:', err);
    return NextResponse.json({ error: 'Failed to re-index neural memories.' }, { status: 500 });
  }
}

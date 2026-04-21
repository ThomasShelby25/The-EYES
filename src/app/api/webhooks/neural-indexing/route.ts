import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { generateEmbedding } from '@/services/ai/ai';
import { buildDeterministicChunks } from '@/services/ai/chunking';

/**
 * Supabase Database Webhook Handler
 * Triggers on INSERT to 'raw_events'
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // 1. Secure Authentication
  if (!serviceRoleKey || authHeader !== `Bearer ${serviceRoleKey}`) {
    console.warn('[Webhook] Unauthorized attempt or missing service role key.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { record, type, table } = payload;

    // 2. Filter for relevant events
    if (type !== 'INSERT' || table !== 'raw_events' || !record) {
      return NextResponse.json({ message: 'Ignored non-insert or non-event payload.' });
    }

    const { id: eventId, user_id: userId, platform, event_type: eventType, title, content } = record;

    if (!content || !userId) {
      return NextResponse.json({ message: 'Skipped: No content or user ID.' });
    }

    console.log(`[Neural-Link] Processing real-time indexing for event ${eventId} (${platform}:${eventType})`);

    const supabase = createAdminClient();

    // 3. Chunking & Embedding
    const chunks = buildDeterministicChunks({
      platform,
      eventType,
      title,
      content,
    });

    for (const chunk of chunks) {
      const result = await generateEmbedding(chunk);
      if (!result) continue;

      const { error: insertError } = await supabase
        .from('embeddings')
        .insert({
          user_id: userId,
          event_id: eventId,
          content: chunk,
          embedding: result.embedding,
        });

      if (insertError) {
        console.error('[Neural-Link] Failed to persist embedding:', insertError.message);
      }
    }

    // 4. Update Profile Count
    const { count: totalIndexed } = await supabase
      .from('embeddings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    await supabase
      .from('user_profiles')
      .update({ memories_indexed: totalIndexed || 0 })
      .eq('user_id', userId);

    return NextResponse.json({ 
      ok: true, 
      eventId, 
      chunks: chunks.length,
      totalIndexedAtUser: totalIndexed
    });

  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[Neural-Link] Critical webhook failure:', detail);
    return NextResponse.json({ error: 'Internal neural processing error.', detail }, { status: 500 });
  }
}

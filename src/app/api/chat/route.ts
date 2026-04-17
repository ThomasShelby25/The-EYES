import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateEmbedding, chatCompletion, chatCompletionStream } from '@/services/ai/ai';

type ChatHistoryMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type ChatRequestBody = { message?: string; history?: ChatHistoryMessage[] };
type MatchEmbeddingRow = { id: string; content: string; similarity: number };
type EmbeddingLookupRow = { id: string; event_id: string | null };
type RawEventCitationRow = {
  id: string;
  platform: string;
  platform_id: string;
  title: string | null;
  event_type: string | null;
  author: string | null;
  timestamp: string | null;
};

type ChatCitation = {
  sourceId: number;
  embeddingId: string;
  eventId: string | null;
  platform: string;
  platformId: string | null;
  title: string | null;
  eventType: string | null;
  author: string | null;
  timestamp: string | null;
  similarity: number;
  rerankScore: number;
  snippet: string;
};

type ChatDiagnostics = {
  contextCount: number;
  retrievalLatencyMs: number;
  confidenceScore: number;
  groundedScore: number;
  rerankApplied: boolean;
  retrievalStatus: 'success' | 'empty' | 'error' | 'skipped';
  retrievalError: string | null;
};

const CHAT_ROLES = new Set<ChatHistoryMessage['role']>(['system', 'user', 'assistant']);

function normalizeHistory(history: unknown): ChatHistoryMessage[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((entry): entry is { role: unknown; content: unknown } => Boolean(entry && typeof entry === 'object'))
    .filter((entry): entry is ChatHistoryMessage => {
      const role = entry.role;
      const content = entry.content;
      return typeof role === 'string' && CHAT_ROLES.has(role as ChatHistoryMessage['role']) && typeof content === 'string';
    });
}

function isStreamRequested(request: Request) {
  const url = new URL(request.url);
  return url.searchParams.get('stream') === '1';
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, 180);
}

function resolveBaseUrl(request: Request) {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  try {
    return new URL(request.url).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

function toConfidenceScore(citations: ChatCitation[]) {
  if (citations.length === 0) return 0;
  const sum = citations.reduce((total, citation) => total + citation.similarity, 0);
  return Number((sum / citations.length).toFixed(3));
}

function toGroundedScore(citations: ChatCitation[]) {
  if (citations.length === 0) return 0;
  const confidence = toConfidenceScore(citations);
  const evidenceCoverage = Math.min(1, citations.length / 5);
  return Number((confidence * 0.7 + evidenceCoverage * 0.3).toFixed(3));
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function lexicalOverlapScore(queryTokens: string[], content: string) {
  if (queryTokens.length === 0 || !content) return 0;
  const contentTokens = new Set(tokenize(content));
  const overlap = queryTokens.reduce((count, token) => (contentTokens.has(token) ? count + 1 : count), 0);
  return overlap / queryTokens.length;
}

function rerankMatches(query: string, rows: MatchEmbeddingRow[]) {
  const queryTokens = tokenize(query);

  return rows
    .map((row) => {
      const lexical = lexicalOverlapScore(queryTokens, row.content);
      const similarity = Math.max(0, Math.min(1, row.similarity || 0));
      const rerankScore = Number((similarity * 0.8 + lexical * 0.2).toFixed(4));

      return {
        ...row,
        similarity,
        rerankScore,
      };
    })
    .sort((a, b) => b.rerankScore - a.rerankScore);
}

function citationsHeaderValue(citations: ChatCitation[]) {
  const compact = citations.slice(0, 4).map((citation) => ({
    sourceId: citation.sourceId,
    platform: citation.platform,
    title: citation.title,
    similarity: citation.similarity,
    rerankScore: citation.rerankScore,
  }));

  return Buffer.from(JSON.stringify(compact), 'utf8').toString('base64url');
}

/**
 * AI Chat API: 'Ask Your Memory'
 * Implements RAG (Retrieval-Augmented Generation) to answer user questions
 * using their personal digital history.
 */
export async function POST(request: Request) {
  try {
    const { message, history } = (await request.json()) as ChatRequestBody;
    if (!message) return NextResponse.json({ error: 'No query provided' }, { status: 400 });
    const streamRequested = isStreamRequested(request);

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- Autonomous Brain Logic: Trigger sync if brain is empty ---
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('memories_indexed')
      .eq('user_id', user.id)
      .single();

    if (!profile || (profile.memories_indexed || 0) === 0) {
      const baseUrl = resolveBaseUrl(request);
      console.log(`[Autonomous-Brain] Empty brain detected for ${user.id}. Triggering deep intake...`);
      // Fire-and-forget sync trigger
      fetch(`${baseUrl}/api/sync/all?depth=deep`, {
        method: 'POST',
        headers: { 
          'x-cron-secret': process.env.CRON_SECRET || '',
          'x-cron-user-id': user.id 
        }
      }).catch(e => console.error('[Autonomous-Brain] Trigger failure:', e));
    }
    // -------------------------------------------------------------

    // 1. Generate embedding for the user's question
    const retrievalStartedAt = Date.now();
    const queryResult = await generateEmbedding(message);
    let context = '';
    let citations: ChatCitation[] = [];
    let retrievalError: string | null = null;

    let diagnostics: ChatDiagnostics = {
      contextCount: 0,
      retrievalLatencyMs: 0,
      confidenceScore: 0,
      groundedScore: 0,
      rerankApplied: false,
      retrievalStatus: queryResult ? 'empty' : 'skipped',
      retrievalError: null,
    };

    if (queryResult) {
      // 2. Perform vector similarity search in Supabase
      const { data: matches, error: matchError } = await supabase.rpc('match_embeddings', {
        query_embedding: queryResult.embedding,
        match_threshold: 0.5, // Only relevant memories
        match_count: 5,        // Top 5 context pieces
        user_id_arg: user.id
      });

      if (matchError) {
        console.warn('[Chat] Vector search failed (falling back to generic AI):', matchError.message);
        retrievalError = matchError.message;
      } else if (matches && matches.length > 0) {
        const rerankedRows = rerankMatches(
          message,
          (matches as MatchEmbeddingRow[])
          .filter((row) => typeof row.id === 'string' && typeof row.content === 'string')
        ).slice(0, 8);

        const embeddingIds = rerankedRows.map((row) => row.id);
        const { data: embeddingRows } = await supabase
          .from('embeddings')
          .select('id,event_id')
          .eq('user_id', user.id)
          .in('id', embeddingIds);

        const embeddingIdToEventId = new Map(
          ((embeddingRows ?? []) as EmbeddingLookupRow[]).map((row) => [row.id, row.event_id])
        );

        const uniqueEventIds = Array.from(
          new Set(
            Array.from(embeddingIdToEventId.values()).filter((eventId): eventId is string => typeof eventId === 'string')
          )
        );

        let eventMap = new Map<string, RawEventCitationRow>();
        if (uniqueEventIds.length > 0) {
          const { data: eventRows } = await supabase
            .from('raw_events')
            .select('id,platform,platform_id,title,event_type,author,timestamp')
            .eq('user_id', user.id)
            .in('id', uniqueEventIds);

          eventMap = new Map(((eventRows ?? []) as RawEventCitationRow[]).map((row) => [row.id, row]));
        }

        citations = rerankedRows.map((match, index) => {
          const eventId = embeddingIdToEventId.get(match.id) ?? null;
          const source = eventId ? eventMap.get(eventId) : null;

          return {
            sourceId: index + 1,
            embeddingId: match.id,
            eventId,
            platform: source?.platform ?? 'unknown',
            platformId: source?.platform_id ?? null,
            title: source?.title ?? null,
            eventType: source?.event_type ?? null,
            author: source?.author ?? null,
            timestamp: source?.timestamp ?? null,
            similarity: Number((match.similarity ?? 0).toFixed(4)),
            rerankScore: Number((match.rerankScore ?? 0).toFixed(4)),
            snippet: match.content.slice(0, 260),
          };
        });

        context = citations
          .map((citation) => {
            const title = citation.title ? ` | title: ${citation.title}` : '';
            const timestamp = citation.timestamp ? ` | time: ${citation.timestamp}` : '';
            return `[source:${citation.sourceId} platform:${citation.platform}${timestamp}${title}]\n${citation.snippet}`;
          })
          .join('\n---\n');
      }
    }

    diagnostics = {
      contextCount: citations.length,
      retrievalLatencyMs: Date.now() - retrievalStartedAt,
      confidenceScore: toConfidenceScore(citations),
      groundedScore: toGroundedScore(citations),
      rerankApplied: citations.length > 1,
      retrievalStatus: retrievalError ? 'error' : queryResult ? (citations.length > 0 ? 'success' : 'empty') : 'skipped',
      retrievalError,
    };

    // 3. Construct the prompt for GPT-4o
    const systemPrompt = `
      You are the EYES Memory Assistant, an elite AI that helps users explore their digital past.
      You have access to the user's indexed memories from Gmail, GitHub, and other platforms.
      
      User Identity: ${user.user_metadata?.name || 'User'}
      
      When answering:
      1. Use the provided "Memory Context" to be factual.
      2. Reference supporting sources inline using [source:N] where N is the source number from memory context.
      3. If you don't find the answer in the context, say so, but suggest what they might search for.
      4. Be concise, professional, and slightly futuristic.
      5. Grounding rubric: prefer evidence-backed claims, avoid speculation, and use at least one [source:N] citation when context exists.
      
      Memory Context:
      ${context || 'No relevant local memories found for this specific query.'}
    `.trim();

    const messages: ChatHistoryMessage[] = [
      { role: 'system', content: systemPrompt },
      ...normalizeHistory(history),
      { role: 'user', content: message }
    ];

    // 4. Get the answer
    if (streamRequested) {
      const stream = await chatCompletionStream(messages);
      const retrievalErrorHeader = diagnostics.retrievalError
        ? sanitizeHeaderValue(diagnostics.retrievalError)
        : '';
      const citationsHeader = citations.length > 0 ? citationsHeaderValue(citations) : '';

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Context-Used': citations.length > 0 ? 'true' : 'false',
          'X-Context-Count': String(diagnostics.contextCount),
          'X-Retrieval-Latency-Ms': String(diagnostics.retrievalLatencyMs),
          'X-Confidence-Score': diagnostics.confidenceScore.toFixed(3),
          'X-Grounded-Score': diagnostics.groundedScore.toFixed(3),
          'X-Retrieval-Status': diagnostics.retrievalStatus,
          ...(citationsHeader ? { 'X-Citations': citationsHeader } : {}),
          ...(retrievalErrorHeader ? { 'X-Retrieval-Error': retrievalErrorHeader } : {}),
        },
      });
    }

    const answer = await chatCompletion(messages);

    return NextResponse.json({
      answer: answer || 'No response generated by memory assistant.',
      contextUsed: citations.length > 0,
      citations,
      diagnostics,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Chat] API Failure:', err);
    return NextResponse.json({ error: 'Internal neural failure.' }, { status: 500 });
  }
}

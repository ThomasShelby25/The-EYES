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

function extractDateRange(query: string): { start_date: string | null, end_date: string | null } {
  const q = query.toLowerCase();
  const now = new Date();
  let start_date = null;
  let end_date = null;

  if (q.includes('today')) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    start_date = d.toISOString();
    d.setHours(23, 59, 59, 999);
    end_date = d.toISOString();
  } else if (q.includes('yesterday')) {
    const d = new Date();
    d.setDate(now.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    start_date = d.toISOString();
    d.setHours(23, 59, 59, 999);
    end_date = d.toISOString();
  } else if (q.includes('this week')) {
    const d = new Date();
    d.setDate(now.getDate() - now.getDay()); // Sunday as start of week
    d.setHours(0, 0, 0, 0);
    start_date = d.toISOString();
    end_date = now.toISOString();
  } else if (q.includes('last week')) {
    const d = new Date();
    d.setDate(now.getDate() - 7);
    start_date = d.toISOString();
    end_date = now.toISOString();
  } else if (q.includes('this month')) {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    start_date = d.toISOString();
    end_date = now.toISOString();
  } else if (q.includes('last month')) {
    const d = new Date();
    d.setMonth(now.getMonth() - 1);
    start_date = d.toISOString();
    end_date = now.toISOString();
  } else if (q.includes('last year')) {
    const d = new Date();
    d.setFullYear(now.getFullYear() - 1);
    start_date = d.toISOString();
    end_date = now.toISOString();
  }

  return { start_date, end_date };
}

function maskPII(text: string): string {
  let masked = text;
  // Mask 16 digit numbers (credit cards)
  masked = masked.replace(/\b(?:\d[ -]*?){13,16}\b/g, '[REDACTED_CARD]');
  // Mask SSN-like numbers
  masked = masked.replace(/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g, '[REDACTED_SSN]');
  // Mask potential passwords
  masked = masked.replace(/(password|pwd|passcode)\s*[:=]\s*([^\s]+)/gi, '$1: [REDACTED]');
  return masked;
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
    const dateRange = extractDateRange(message);
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
      // 2. Perform HYBRID similarity search in Supabase (Vector + Keyword)
      const { data: matches, error: matchError } = await supabase.rpc('hybrid_search', {
        query_text: message,
        query_embedding: queryResult.embedding,
        match_count: 15, // Pull more for reranking
        user_id_arg: user.id,
        start_date: dateRange.start_date,
        end_date: dateRange.end_date
      });

      if (matchError) {
        console.warn('[Chat] Hybrid search failed:', matchError.message);
        retrievalError = matchError.message;
      } else if (matches && matches.length > 0) {
        // Use the scores directly from the hybrid_search RPC
        const rerankedRows = (matches as any[]).sort((a, b) => b.combined_score - a.combined_score).slice(0, 8);

        // 3. Resolve Metadata for Citations
        const uniqueEventIds = Array.from(new Set(rerankedRows.map(row => row.id)));
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
          const source = eventMap.get(match.id);

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
            rerankScore: Number((match.combined_score ?? 0).toFixed(4)),
            snippet: maskPII((match.content || '').slice(0, 420)), // Masked and increased snippet
          };
        });

        context = citations
          .map((citation) => {
            const platform = citation.platform.toUpperCase();
            const date = citation.timestamp ? new Date(citation.timestamp).toLocaleDateString() : 'Unknown Date';
            const author = citation.author ? ` | sender: ${citation.author}` : '';
            const title = citation.title ? ` | subject: ${citation.title}` : '';
            return `[MEMORY ${citation.sourceId}] [${platform}] [${date}${author}${title}]\n${citation.snippet}`;
          })
          .join('\n\n---\n\n');
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
      You are the EYES Neural Assistant, a high-performance Digital Memory OS.
      Your purpose is to help the user navigate their digital past with absolute accuracy.
      
      User Identity: ${user.user_metadata?.name || 'User'}
      Current Time: ${new Date().toLocaleString()}
      
      OPERATING PROTOCOLS:
      1. DATA GROUNDING: Use the provided "MEMORY CONTEXT" to answer. If a memory contains a specific date, name, or detail, prioritize it.
      2. SOURCE ATTRIBUTION: Reference supporting memories inline using [MEMORY N]. You MUST provide at least one citation if relevant context exists.
      3. HALLUCINATION SHIELD: If the memory context does not contain the answer, state that you don't have that specific record, but suggest related terms they could search for.
      4. TONE: Professional, slightly futuristic, and efficient.
      5. PRIVACY: Never reveal the internal IDs or raw metadata (like platform_id) unless asked.
      
      MEMORY CONTEXT:
      ${context || 'The neural archive is currently empty or contains no relevant records for this query.'}
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

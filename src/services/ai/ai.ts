/**
 * AI Brain Core: Multi-Provider (Anthropic + OpenAI)
 * Embeddings: OpenAI text-embedding-3-small (1536 dimensions)
 * Chat: Anthropic Claude 3 Haiku (Default) with GPT-4o-mini Fallback
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  provider: 'openai';
}

/**
 * Generates embedding using OpenAI text-embedding-3-small.
 * (Embeddings remain on OpenAI as they are generally more standard for vector DBs)
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  const cleanText = text.replace(/\n/g, ' ').trim();
  if (!cleanText) return null;

  if (!OPENAI_API_KEY) {
    console.warn('[AI] OPENAI_API_KEY not configured for embeddings');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: cleanText,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const embedding = data.data?.[0]?.embedding;
      
      if (embedding && Array.isArray(embedding) && embedding.length > 0) {
        return {
          embedding: embedding,
          tokens: data.usage?.total_tokens || Math.ceil(cleanText.length / 4),
          provider: 'openai'
        };
      }
    } else {
      const errBody = await response.json().catch(() => ({}));
      console.error('[AI] OpenAI Embedding Error:', response.status, errBody);
    }
  } catch (err) {
    console.error('[AI] OpenAI Embedding Fetch Exception:', err);
  }

  return null;
}

/**
 * Chat completion using Claude (Primary) or GPT (Fallback).
 */
export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
  // 1. Try Anthropic Claude
  if (ANTHROPIC_API_KEY) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1024,
          temperature: 0.1,
          messages: messages.filter(m => m.role !== 'system'),
          system: messages.find(m => m.role === 'system')?.content
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.content?.[0]?.text || '';
      }
    } catch (err) {
      console.error('[AI] Claude Chat Error, falling back...', err);
    }
  }

  // 2. Fallback to OpenAI
  if (OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: messages,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (err) {
      console.error('[AI] OpenAI Fallback Error:', err);
    }
  }

  return '[AI UNAVAILABLE] Verify ANTHROPIC_API_KEY or OPENAI_API_KEY.';
}

/**
 * Streaming chat completion with provider selection.
 */
export async function chatCompletionStream(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const provider = ANTHROPIC_API_KEY ? 'anthropic' : (OPENAI_API_KEY ? 'openai' : null);

  if (!provider) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('[AI UNAVAILABLE] No API keys configured.'));
        controller.close();
      }
    });
  }

  const endpoint = provider === 'anthropic' 
    ? 'https://api.anthropic.com/v1/messages' 
    : 'https://api.openai.com/v1/chat/completions';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider === 'anthropic') {
    headers['x-api-key'] = ANTHROPIC_API_KEY!;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${OPENAI_API_KEY}`;
  }

  const body = provider === 'anthropic'
    ? {
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        stream: true,
        messages: messages.filter(m => m.role !== 'system'),
        system: messages.find(m => m.role === 'system')?.content
      }
    : {
        model: 'gpt-4o-mini',
        stream: true,
        messages: messages
      };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (response.ok && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      return new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                
                if (provider === 'anthropic') {
                   if (trimmed.startsWith('data: ')) {
                     try {
                        const data = JSON.parse(trimmed.slice(6));
                        if (data.type === 'content_block_delta') {
                          controller.enqueue(encoder.encode(data.delta?.text || ''));
                        }
                     } catch {}
                   }
                } else {
                   if (trimmed.startsWith('data: ')) {
                     try {
                        const data = JSON.parse(trimmed.slice(6));
                        const content = data.choices?.[0]?.delta?.content;
                        if (content) controller.enqueue(encoder.encode(content));
                     } catch {}
                   }
                }
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        }
      });
    }
  } catch (err) {
    console.error(`[AI] ${provider} stream failed:`, err);
  }

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('[AI ERROR] Stream initialization failed.'));
      controller.close();
    }
  });
}


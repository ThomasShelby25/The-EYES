/**
 * AI Brain Core: Anthropic-Only (Claude)
 * Chat: Anthropic Claude 3 Haiku
 * Note: OpenAI removed as per request. Embeddings currently disabled as Anthropic requires Voyage AI or similar for vector generation.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  provider: 'openai';
}

/**
 * Generates pgvector embeddings using OpenAI text-embedding-3-small.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  if (!OPENAI_API_KEY) {
    console.warn('[AI] Open AI Key missing. Embeddings offline.');
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-3-small',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        embedding: data.data[0].embedding,
        tokens: data.usage.total_tokens,
        provider: 'openai',
      };
    }
    
    const err = await response.json();
    console.error('[AI] OpenAI Embedding Error:', err);
    return null;
  } catch (err) {
    console.error('[AI] Neural Engine Failure:', err);
    return null;
  }
}

/**
 * Chat completion using Claude 3 Haiku.
 */
export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return '[AI UNAVAILABLE] ANTHROPIC_API_KEY not configured.';
  }

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
    } else {
      const errBody = await response.json().catch(() => ({}));
      console.error('[AI] Claude Chat API Error:', response.status, errBody);
    }
  } catch (err) {
    console.error('[AI] Claude Chat Fetch Error:', err);
  }

  return '[AI UNAVAILABLE] Neural Core offline. Verify ANTHROPIC_API_KEY.';
}

/**
 * Streaming chat completion using Claude.
 */
export async function chatCompletionStream(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  
  if (!ANTHROPIC_API_KEY) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('[AI UNAVAILABLE] ANTHROPIC_API_KEY not configured.'));
        controller.close();
      }
    });
  }

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
        stream: true,
        messages: messages.filter(m => m.role !== 'system'),
        system: messages.find(m => m.role === 'system')?.content
      }),
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
                if (trimmed.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(trimmed.slice(6));
                    if (data.type === 'content_block_delta') {
                      controller.enqueue(encoder.encode(data.delta?.text || ''));
                    }
                  } catch {}
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
    console.error('[AI] Claude Stream Error:', err);
  }

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('[AI ERROR] Neural stream failed.'));
      controller.close();
    }
  });
}


/**
 * AI Brain Core: Claude-Only (Anthropic)
 * Embeddings: text-embedding-3-small (1536 dimensions → truncated to 768 DB)
 * Chat: claude-3-haiku-20240307 (fast, free-tier friendly)
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const EMBEDDING_DIMENSION = 768; // Database expects vector(768)

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  provider: 'claude';
}

function truncateEmbedding(embedding: number[]): number[] {
  if (embedding.length <= EMBEDDING_DIMENSION) return embedding;
  console.warn('[AI] Truncating Claude embedding (1536→768-dim)');
  return embedding.slice(0, EMBEDDING_DIMENSION);
}

/**
 * Generates embedding using Claude text-embedding-3-small.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  const cleanText = text.replace(/\n/g, ' ').trim();
  if (!cleanText) return null;

  if (!ANTHROPIC_API_KEY) {
    console.error('[AI] ANTHROPIC_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: cleanText,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const embedding = data.embedding;
      
      if (embedding && Array.isArray(embedding) && embedding.length > 0) {
        return {
          embedding: truncateEmbedding(embedding),
          tokens: Math.ceil(cleanText.length / 4),
          provider: 'claude'
        };
      } else {
        console.error('[AI] Claude embedding invalid:', data);
      }
    } else {
      const errBody = await response.json().catch(() => ({}));
      console.error('[AI] Claude Embedding API Error:', response.status, errBody);
    }
  } catch (err) {
    console.error('[AI] Claude Embedding Fetch Error:', err instanceof Error ? err.message : String(err));
  }

  return null;
}

/**
 * Chat completion using Claude-3 Haiku.
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
        messages: messages,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (text) return text;
    } else {
      const errBody = await response.json().catch(() => ({}));
      console.error('[AI] Claude Chat API Error:', response.status, errBody);
    }
  } catch (err) {
    console.error('[AI] Claude Chat Fetch Error:', err instanceof Error ? err.message : String(err));
  }

  return '[AI UNAVAILABLE] Claude offline. Verify ANTHROPIC_API_KEY.';
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
        messages: messages,
      }),
    });

    if (response.ok && response.body) {
      const decoder = new TextDecoder();
      const reader = response.body.getReader();

      return new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.slice(6));
                    const delta = data.delta?.text;
                    if (delta) controller.enqueue(encoder.encode(delta));
                  } catch {
                    // Ignore parse errors
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
    } else {
      console.error('[AI] Claude Stream API Error:', response.status);
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('[AI ERROR] Claude stream failed.'));
          controller.close();
        }
      });
    }
  } catch (err) {
    console.error('[AI] Claude Stream Fetch Error:', err instanceof Error ? err.message : String(err));
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('[AI ERROR] Claude stream unavailable.'));
        controller.close();
      }
    });
  }
}


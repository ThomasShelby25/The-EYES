/**
 * AI Brain Core: OpenAI-Based
 * Embeddings: text-embedding-3-small (1536 dimensions)
 * Chat: gpt-4o-mini (fast, efficient, cost-effective replacement for Claude Haiku)
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const EMBEDDING_DIMENSION = 1536; // Update to match OpenAI standard or stay with 768 if DB is fixed

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  provider: 'openai';
}

/**
 * Generates embedding using OpenAI text-embedding-3-small.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  const cleanText = text.replace(/\n/g, ' ').trim();
  if (!cleanText) return null;

  if (!OPENAI_API_KEY) {
    console.error('[AI] OPENAI_API_KEY not configured');
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
      } else {
        console.error('[AI] OpenAI embedding invalid:', data);
      }
    } else {
      const errBody = await response.json().catch(() => ({}));
      console.error('[AI] OpenAI Embedding API Error:', response.status, errBody);
    }
  } catch (err) {
    console.error('[AI] OpenAI Embedding Fetch Error:', err instanceof Error ? err.message : String(err));
  }

  return null;
}

/**
 * Chat completion using GPT-4o Mini or similar.
 */
export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!OPENAI_API_KEY) {
    return '[AI UNAVAILABLE] OPENAI_API_KEY not configured.';
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1024,
        temperature: 0.1,
        messages: messages,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) return text;
    } else {
      const errBody = await response.json().catch(() => ({}));
      console.error('[AI] OpenAI Chat API Error:', response.status, errBody);
    }
  } catch (err) {
    console.error('[AI] OpenAI Chat Fetch Error:', err instanceof Error ? err.message : String(err));
  }

  return '[AI UNAVAILABLE] Brain offline. Verify OPENAI_API_KEY.';
}

/**
 * Streaming chat completion using OpenAI.
 */
export async function chatCompletionStream(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  
  if (!OPENAI_API_KEY) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('[AI UNAVAILABLE] OPENAI_API_KEY not configured.'));
        controller.close();
      }
    });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1024,
        temperature: 0.1,
        stream: true,
        messages: messages,
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
                if (line.trim().startsWith('data: ') && line.trim() !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(line.trim().slice(6));
                    const delta = data.choices?.[0]?.delta?.content;
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
      console.error('[AI] OpenAI Stream API Error:', response.status);
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('[AI ERROR] Brain stream failed.'));
          controller.close();
        }
      });
    }
  } catch (err) {
    console.error('[AI] OpenAI Stream Fetch Error:', err instanceof Error ? err.message : String(err));
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('[AI ERROR] Brain stream unavailable.'));
        controller.close();
      }
    });
  }
}


/**
 * AI Brain Core: Groq (Llama 3)
 * Chat: Groq llama3-70b-8192 (Free Tier)
 * Embeddings: OpenAI text-embedding-3-small (Note: Requires valid OpenAI key for embeddings)
 */

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
 * Chat completion using OpenAI.
 */
export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[AI] chatCompletion failed: OPENAI_API_KEY is missing from environment.');
    return '[AI UNAVAILABLE] OPENAI_API_KEY not configured.';
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        max_tokens: 1024,
        temperature: 0.1,
        messages: messages
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } else {
      const errBody = await response.json().catch(() => ({}));
      console.error('[AI] Groq Chat API Error:', response.status, JSON.stringify(errBody));
      
      // Provide more specific error feedback in the string if possible
      if (response.status === 401) return '[AI UNAVAILABLE] Invalid OpenAI API Key.';
      if (response.status === 429) return '[AI UNAVAILABLE] OpenAI Rate Limit or Insufficient Credits.';
    }
  } catch (err) {
    console.error('[AI] OpenAI Chat Fetch Error:', err);
  }

  return '[AI UNAVAILABLE] Neural Core offline. Verify platform connectivity and credits.';
}

/**
 * Streaming chat completion using OpenAI.
 */
export async function chatCompletionStream(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder();
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('[AI UNAVAILABLE] OPENAI_API_KEY not configured.'));
        controller.close();
      }
    });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        max_tokens: 1024,
        temperature: 0.1,
        stream: true,
        messages: messages
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
                if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                  try {
                    const data = JSON.parse(trimmed.slice(6));
                    const text = data.choices?.[0]?.delta?.content;
                    if (text) {
                      controller.enqueue(encoder.encode(text));
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
    console.error('[AI] OpenAI Stream Error:', err);
  }

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('[AI ERROR] Neural stream failed.'));
      controller.close();
    }
  });
}


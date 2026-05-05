import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

/**
 * AI Brain Core: Hybrid Architecture
 * Chat: Anthropic Claude (Primary) with Gemini Fallback (Free)
 * Embeddings: Google Gemini (Free, 3072 dimensions)
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const CLAUDE_MODEL = "claude-3-5-sonnet-20240620";
const GEMINI_FALLBACK_MODELS = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
const EMBED_MODEL = "gemini-embedding-001";

export type EmbeddingResult = {
  embedding: number[];
};

/**
 * Generate vector embeddings for search using Google Gemini
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  if (!GEMINI_API_KEY) return null;
  try {
    const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
    const result = await model.embedContent(text.slice(0, 8000));
    return { embedding: Array.from(result.embedding.values) };
  } catch (err) {
    console.error('[AI] Embedding Error:', err);
    return null;
  }
}

/**
 * Standard Chat Completion using Claude with Gemini Fallback
 */
export async function chatCompletion(messages: { role: string; content: string }[]): Promise<string | null> {
  const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
  const history = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ 
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, 
      content: m.content 
    }));

  if (ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    try {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        temperature: 0.1,
        system: systemInstruction,
        messages: history,
      });

      const contentBlock = response.content[0];
      if (contentBlock.type === 'text') return contentBlock.text;
    } catch (err) {
      console.warn('[AI] Claude failed, trying Gemini...');
    }
  }

  // Gemini Fallback
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent({
      contents: history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
      systemInstruction,
    });
    return result.response.text();
  } catch (err) {
    console.error('[AI] All models failed.');
    return null;
  }
}

/**
 * Streaming Chat Completion
 */
export async function chatCompletionStream(messages: { role: string; content: string }[]): Promise<ReadableStream> {
  const encoder = new TextEncoder();
  const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
  const history = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ 
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, 
      content: m.content 
    }));

  if (ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    try {
      const stream = await anthropic.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        temperature: 0.1,
        system: systemInstruction,
        messages: history,
      });

      return new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
            }
          } catch (e) {
            console.error('[AI] Stream loop error:', e);
          } finally {
            controller.close();
          }
        }
      });
    } catch (err) {
      console.warn('[AI] Claude stream failed, using Gemini.');
    }
  }

  // Gemini Fallback Stream (Non-streaming implementation for reliability)
  return new ReadableStream({
    async start(controller) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent({
          contents: history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
          systemInstruction,
        });
        controller.enqueue(encoder.encode(result.response.text()));
      } catch (err) {
        console.error('[AI] Gemini stream fallback failed.');
      } finally {
        controller.close();
      }
    }
  });
}

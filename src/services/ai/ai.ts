import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

/**
 * AI Brain Core: Hybrid Architecture
 * Chat: Anthropic Claude (via OPENAI_API_KEY env slot)
 * Embeddings: Google Gemini (gemini-embedding-001)
 */

const CLAUDE_API_KEY = process.env.OPENAI_API_KEY || ''; // User pasted Claude key here
const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const getModel = (name: string) => genAI.getGenerativeModel({ model: name });
const EMBED_MODEL = "gemini-embedding-001";
const CLAUDE_MODEL = "claude-3-haiku-20240307";

export type EmbeddingResult = {
  embedding: number[];
};

/**
 * Generate vector embeddings for search using Google Gemini
 * Note: Claude does not support embeddings natively, so we must retain Gemini for Vector Search.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[AI] GEMINI_API_KEY not configured.');
    return null;
  }

  try {
    const model = getModel(EMBED_MODEL);
    const result = await model.embedContent(text.slice(0, 8000));
    return {
      embedding: Array.from(result.embedding.values)
    };
  } catch (err) {
    console.error('[AI] Gemini Embedding Error:', err);
    return null;
  }
}

/**
 * Standard Chat Completion (Non-streaming) using Claude
 */
export async function chatCompletion(messages: { role: string; content: string }[]): Promise<string | null> {
  if (!CLAUDE_API_KEY || !CLAUDE_API_KEY.startsWith('sk-ant-')) {
    return 'CLAUDE_API_KEY not configured correctly (must start with sk-ant-).';
  }

  try {
    const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
    const history = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ 
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, 
        content: m.content 
      }));

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      temperature: 0.1,
      system: systemInstruction,
      messages: history,
    });

    const contentBlock = response.content[0];
    return contentBlock.type === 'text' ? contentBlock.text : null;
  } catch (err: any) {
    console.error('[AI] Claude Chat Error:', err);
    return `Neural link failure: ${err?.message || 'Unknown error'}`;
  }
}

/**
 * Streaming Chat Completion using Claude
 */
export async function chatCompletionStream(messages: { role: string; content: string }[]): Promise<ReadableStream> {
  const encoder = new TextEncoder();

  if (!CLAUDE_API_KEY || !CLAUDE_API_KEY.startsWith('sk-ant-')) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('[AI UNAVAILABLE] CLAUDE_API_KEY not configured correctly.'));
        controller.close();
      }
    });
  }

  try {
    const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
    const history = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ 
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, 
        content: m.content 
      }));

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
          controller.close();
        } catch (err: any) {
          console.error('[AI] Claude Stream Error Detail:', err);
          const errorMsg = err?.message || 'Neural stream failed.';
          controller.enqueue(encoder.encode(`[AI ERROR] ${errorMsg}.`));
          controller.close();
        }
      }
    });
  } catch (err: any) {
    console.error('[AI] Claude Stream Setup Error:', err);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`[AI ERROR] Setup failed: ${err?.message}`));
        controller.close();
      }
    });
  }
}

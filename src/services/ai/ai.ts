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
 * Generate vector embeddings for search using Google Gemini (Free tier)
 * Note: Claude does not support embeddings natively.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[AI] GEMINI_API_KEY not configured.');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
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
 * Standard Chat Completion (Non-streaming) using Claude with Gemini Fallback
 */
export async function chatCompletion(messages: { role: string; content: string }[]): Promise<string | null> {
  const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
  const history = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ 
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, 
      content: m.content 
    }));

  // Try Claude First
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
    } catch (err: any) {
      console.warn('[AI] Claude Chat Error, falling back to Gemini:', err.message);
      
      // Real Gemini Fallback
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const lastMessage = history[history.length - 1]?.content || "";
        const chatHistory = history.slice(0, -1).map(h => ({ 
          role: h.role === 'assistant' ? 'model' : 'user', 
          parts: [{ text: h.content }] 
        }));

        const chat = model.startChat({
          history: chatHistory,
          systemInstruction: systemInstruction,
        });
        const result = await chat.sendMessage(lastMessage);
        return result.response.text();
      } catch (geminiErr: any) {
        console.error('[AI] Gemini Fallback also failed:', geminiErr.message);
        return null;
      }
    }
  }

  return null;
}

/**
 * Streaming Chat Completion using Claude with Gemini Fallback
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

  // Try Claude First
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
            controller.close();
          } catch (err: any) {
            controller.close();
          }
        }
      });
    } catch (err: any) {
      console.warn('[AI] Claude Stream Setup Error, falling back to Gemini:', err.message);
      
      // Real Gemini Fallback (non-streaming for reliability in fallback)
      return new ReadableStream({
        async start(controller) {
          try {
            const model = genAI.getGenerativeModel({ model: GEMINI_FALLBACK_MODELS[0] });
            const result = await model.generateContent({
              contents: history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
              systemInstruction: systemInstruction,
            });
            controller.enqueue(encoder.encode(result.response.text()));
            controller.close();
          } catch (geminiErr: any) {
            controller.close();
          }
        }
      });
    }
  }

  return new ReadableStream({
    start(controller) {
      controller.close();
    }
  });
}



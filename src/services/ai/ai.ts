import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * AI Brain Core: Google Gemini (Unified Brain)
 * Chat: Gemini 1.5 Flash (Free Tier)
 * Embeddings: text-embedding-004 (Free Tier)
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
// Use v1beta for full feature support (System Instructions, text-embedding-004)
const getModel = (name: string) => genAI.getGenerativeModel({ model: name });
const CHAT_MODEL = "gemini-1.5-flash";
const EMBED_MODEL = "text-embedding-004";

export type EmbeddingResult = {
  embedding: number[];
};

/**
 * Generate vector embeddings for search using Google Gemini
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
 * Standard Chat Completion (Non-streaming)
 */
export async function chatCompletion(messages: { role: string; content: string }[]): Promise<string | null> {
  if (!GEMINI_API_KEY) return 'GEMINI_API_KEY not configured.';

  try {
    const model = getModel(CHAT_MODEL);
    
    const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
    const history = messages
      .filter(m => m.role !== 'system' && m.role !== 'user')
      .map(m => ({ role: "model", parts: [{ text: m.content }] }));
    
    const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || "";

    const chat = model.startChat({
      history: history as any,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.1 },
      systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
    });

    const result = await chat.sendMessage(lastUserMessage);
    return result.response.text();
  } catch (err: any) {
    console.error('[AI] Gemini Chat Error:', err);
    return `Neural link failure: ${err?.message || 'Unknown error'}`;
  }
}

/**
 * Streaming Chat Completion
 */
export async function chatCompletionStream(messages: { role: string; content: string }[]): Promise<ReadableStream> {
  const encoder = new TextEncoder();

  if (!GEMINI_API_KEY) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('[AI UNAVAILABLE] GEMINI_API_KEY not configured.'));
        controller.close();
      }
    });
  }

  try {
    const model = getModel(CHAT_MODEL);
    
    const systemInstruction = messages.find(m => m.role === 'system')?.content || "";
    const history = messages
      .slice(0, -1)
      .filter(m => m.role !== 'system')
      .map(m => ({ 
        role: m.role === 'assistant' ? 'model' : 'user', 
        parts: [{ text: m.content }] 
      }));
    
    const lastUserMessage = messages[messages.length - 1].content;

    const chat = model.startChat({
      history: history as any,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.1 },
      systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
    });

    return new ReadableStream({
      async start(controller) {
        try {
          const result = await chat.sendMessageStream(lastUserMessage);
          for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              controller.enqueue(encoder.encode(chunkText));
            }
          }
          controller.close();
        } catch (err: any) {
          console.error('[AI] Gemini Stream Error Detail:', err);
          const errorMsg = err?.message || 'Neural stream failed.';
          controller.enqueue(encoder.encode(`[AI ERROR] ${errorMsg}. Verify API key permissions and quotas.`));
          controller.close();
        }
      }
    });
  } catch (err: any) {
    console.error('[AI] Gemini Stream Setup Error:', err);
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`[AI ERROR] Setup failed: ${err?.message}`));
        controller.close();
      }
    });
  }
}

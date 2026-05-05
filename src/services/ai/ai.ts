import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from '@/utils/supabase/server';
import crypto from 'crypto';

/**
 * AI Brain Core: V1 Mistral Abstraction Layer (Section 07 Specification)
 * All model invocations must route through the unified 'invokeModel' interface.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''; 
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const CLAUDE_MODEL = "claude-3-5-sonnet-20240620";
const GEMINI_CHAT_MODEL = "gemini-1.5-flash";
const EMBED_MODEL = "gemini-embedding-001";

export type AIPreference = 'claude' | 'mistral' | 'openai' | 'auto';
export type AICapability = 'chat' | 'embed' | 'classify';

export interface AIHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIInvokeOptions {
  capability: AICapability;
  messages?: AIHistoryMessage[];
  system?: string;
  preference?: AIPreference;
  capture?: boolean; // For future behavioral data capture (Section 07.Decision 2)
}

/**
 * Unified Model Invocation Interface (The Specification Requirement)
 */
export async function invokeModel(options: AIInvokeOptions): Promise<any> {
  const { capability, messages = [], system = "", preference = 'auto', capture = true } = options;

  if (capability === 'embed') {
    return handleEmbedding(messages[0]?.content || "");
  }

  if (capability === 'chat' || capability === 'classify') {
    const startedAt = Date.now();
    const result = await handleChat(messages, system, preference);
    
    if (capture) {
      void captureBehavioralData({
        queryText: messages[messages.length - 1]?.content || "",
        queryType: capability,
        modelUsed: preference === 'auto' ? 'claude' : (preference || 'claude'),
        latencyMs: Date.now() - startedAt,
        resultCount: messages.length, // approximation
        responseLength: result?.length || 0
      });
    }

    return result;
  }

  throw new Error(`AI Capability ${capability} not supported.`);
}

/**
 * Internal: Handle 768d Embeddings via Gemini (Production Standard)
 */
async function handleEmbedding(text: string) {
  if (!GEMINI_API_KEY) return null;
  try {
    const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
    const result = await model.embedContent({
      content: { role: 'user', parts: [{ text: text.slice(0, 8000) }] },
      taskType: TaskType.RETRIEVAL_QUERY,
    });
    return { embedding: Array.from(result.embedding.values) };
  } catch (err) {
    console.error('[AI Abstraction] Embedding Error:', err);
    return null;
  }
}

/**
 * Internal: Handle Chat via Claude with Gemini Fallback
 */
async function handleChat(messages: AIHistoryMessage[], system: string, preference: AIPreference) {
  const isClassification = system.includes('commitment') || system.includes('classify');
  
  const history = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ 
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, 
      content: m.content 
    }));

  const targetProvider = (preference === 'auto' || preference === 'claude') ? 'claude' : 'gemini';

  if (targetProvider === 'claude' && ANTHROPIC_API_KEY && ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    try {
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: isClassification ? 500 : 1024,
        temperature: 0, // Cold tone for classification
        system: system,
        messages: history,
      });

      const contentBlock = response.content[0];
      if (contentBlock.type === 'text') return contentBlock.text;
    } catch (err) {
      console.warn('[AI Abstraction] Claude failed, falling back to Gemini.');
    }
  }

  // Gemini Execution (Fallback or Explicit)
  try {
    const model = genAI.getGenerativeModel({ model: GEMINI_CHAT_MODEL });
    const result = await model.generateContent({
      contents: history.map(h => ({ 
        role: h.role === 'assistant' ? 'model' : 'user', 
        parts: [{ text: h.content }] 
      })),
      systemInstruction: system,
    });
    return result.response.text();
  } catch (err) {
    console.error('[AI Abstraction] All models failed in handleChat.');
    return null;
  }
}

/**
 * Streaming version of the unified interface
 */
export async function invokeModelStream(options: AIInvokeOptions): Promise<ReadableStream> {
  const { messages = [], system = "", preference = 'auto' } = options;
  const encoder = new TextEncoder();

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
        system: system,
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
            console.error('[AI Stream] Loop error:', e);
          } finally {
            controller.close();
          }
        }
      });
    } catch (err) {
      console.warn('[AI Stream] Claude failed, using Gemini.');
    }
  }

  // Gemini Fallback Stream
  return new ReadableStream({
    async start(controller) {
      try {
        const model = genAI.getGenerativeModel({ model: GEMINI_CHAT_MODEL });
        const result = await model.generateContent({
          contents: history.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })),
          systemInstruction: system,
        });
        controller.enqueue(encoder.encode(result.response.text()));
      } catch (err) {
        console.error('[AI Stream] Gemini fallback failed.');
      } finally {
        controller.close();
      }
    }
  });
}

/**
 * Legacy Compatibility Wrappers
 */
export async function generateEmbedding(text: string) {
  return invokeModel({ capability: 'embed', messages: [{ role: 'user', content: text }] });
}

export async function chatCompletion(messages: AIHistoryMessage[]) {
  return invokeModel({ capability: 'chat', messages });
}

export async function chatCompletionStream(messages: AIHistoryMessage[]) {
  return invokeModelStream({ capability: 'chat', messages });
}

/**
 * Section 07.Decision 2: Anonymized Behavioral Logging
 */
async function captureBehavioralData(data: {
  queryText: string;
  queryType: string;
  modelUsed: string;
  latencyMs: number;
  resultCount: number;
  responseLength: number;
}) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // GDPR Requirement: SHA-256 of user_id + salt
    const salt = process.env.BEHAVIOR_SALT || 'eyes-neural-moat';
    const userHash = crypto.createHash('sha256').update(user.id + salt).digest('hex');

    await supabase.from('query_behavior').insert({
      user_hash: userHash,
      query_text: data.queryText,
      query_type: data.queryType,
      model_used: data.modelUsed,
      latency_ms: data.latencyMs,
      result_count: data.resultCount,
      response_length: data.responseLength,
      sources_used: [], // to be populated from context
      coarse_geography: 'unknown',
      coarse_time_bucket: getTimeBucket()
    });
  } catch (err) {
    console.warn('[AI Behavioral] Logging failed:', err);
  }
}

function getTimeBucket(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

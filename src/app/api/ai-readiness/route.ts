import { NextResponse } from 'next/server';

type ReadinessStatus = 'online' | 'degraded' | 'offline';

type CheckStatus = 'pass' | 'fail' | 'skip';

type ReadinessCheck = {
  status: CheckStatus;
  latencyMs: number;
  error?: string;
};

type ReadinessPayload = {
  status: ReadinessStatus;
  provider: string;
  model: string;
  reason: string;
  checks: {
    openaiEmbeddings: ReadinessCheck;
    openaiChat: ReadinessCheck;
    supabase: ReadinessCheck;
  };
  lastCheckedAt: string;
};

const HEALTH_CACHE_TTL_MS = 45_000;
let cachedResult: { expiresAt: number; payload: ReadinessPayload } | null = null;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

async function runAnthropicChatProbe(apiKey: string | undefined): Promise<ReadinessCheck> {
  if (!apiKey) {
    return { status: 'skip', latencyMs: 0, error: 'Missing ANTHROPIC_API_KEY.' };
  }

  const started = Date.now();
  try {
    const response = await withTimeout(
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 4,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      }),
      3500
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        status: 'fail',
        latencyMs: Date.now() - started,
        error: `Anthropic chat probe failed (${response.status}): ${body.slice(0, 160)}`,
      };
    }

    const data = await response.json();
    if (data.content && data.content[0] && data.content[0].text) {
      return { status: 'pass', latencyMs: Date.now() - started };
    } else {
      return {
        status: 'fail',
        latencyMs: Date.now() - started,
        error: 'Anthropic returned empty response',
      };
    }
  } catch (error) {
    return {
      status: 'fail',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runSupabaseProbe(url: string | undefined, anonKey: string | undefined): Promise<ReadinessCheck> {
  if (!url || !anonKey) {
    return { status: 'skip', latencyMs: 0, error: 'Missing Supabase configuration.' };
  }

  const started = Date.now();
  try {
    const response = await withTimeout(
      fetch(`${url}/rest/v1/`, {
        method: 'GET',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      }),
      2500
    );

    if ([200, 401, 404].includes(response.status)) {
      return { status: 'pass', latencyMs: Date.now() - started };
    }

    return {
      status: 'fail',
      latencyMs: Date.now() - started,
      error: `Supabase probe failed with status ${response.status}`,
    };
  } catch (error) {
    return {
      status: 'fail',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET() {
  const now = Date.now();
  if (cachedResult && cachedResult.expiresAt > now) {
    return NextResponse.json(cachedResult.payload, { status: 200 });
  }

  const anthropicChatCheck = await runAnthropicChatProbe(process.env.ANTHROPIC_API_KEY);
  const supabaseCheck = await runSupabaseProbe(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  let status: ReadinessStatus = 'online';
  let reason = 'Neural AI Core ready (Anthropic).';
  let provider = 'Anthropic Claude';
  let model = 'Claude-3 Haiku';

  if (anthropicChatCheck.status !== 'pass') {
    status = 'offline';
    model = 'N/A';
    reason = 'Neural AI Core offline. Verify ANTHROPIC_API_KEY.';
  }

  if (supabaseCheck.status === 'skip' || supabaseCheck.status === 'fail') {
    if (status !== 'offline') {
      status = 'degraded';
      reason = (reason || '') + ' [Supabase disconnected]';
    }
  }

  const payload: ReadinessPayload = {
    status,
    provider,
    model,
    reason,
    checks: {
      anthropicChat: anthropicChatCheck,
      supabase: supabaseCheck,
    } as any,
    lastCheckedAt: new Date().toISOString(),
  };

  cachedResult = {
    payload,
    expiresAt: now + HEALTH_CACHE_TTL_MS,
  };

  return NextResponse.json(payload, { status: 200 });
}

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
    claudeEmbeddings: ReadinessCheck;
    claudeChat: ReadinessCheck;
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









async function runClaudeEmbeddingProbe(apiKey: string | undefined): Promise<ReadinessCheck> {
  if (!apiKey) {
    return { status: 'skip', latencyMs: 0, error: 'Missing ANTHROPIC_API_KEY.' };
  }

  const started = Date.now();
  try {
    const response = await withTimeout(
      fetch('https://api.anthropic.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: 'health-check',
        }),
      }),
      3500
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        status: 'fail',
        latencyMs: Date.now() - started,
        error: `Claude embedding probe failed (${response.status}): ${body.slice(0, 160)}`,
      };
    }

    const data = await response.json();
    if (data.embedding && Array.isArray(data.embedding)) {
      return { status: 'pass', latencyMs: Date.now() - started };
    } else {
      return {
        status: 'fail',
        latencyMs: Date.now() - started,
        error: 'Claude returned invalid embedding structure',
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

async function runClaudeChatProbe(apiKey: string | undefined): Promise<ReadinessCheck> {
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
          temperature: 0,
          messages: [{ role: 'user', content: 'health-check' }],
        }),
      }),
      3500
    );

    if (!response.ok) {
      const body = await response.text();
      return {
        status: 'fail',
        latencyMs: Date.now() - started,
        error: `Claude chat probe failed (${response.status}): ${body.slice(0, 160)}`,
      };
    }

    const data = await response.json();
    if (data.content && data.content[0] && data.content[0].text) {
      return { status: 'pass', latencyMs: Date.now() - started };
    } else {
      return {
        status: 'fail',
        latencyMs: Date.now() - started,
        error: 'Claude returned empty response',
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

    // 200/401/404 all indicate the service is reachable over network.
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

// Check Claude
  const claudeEmbeddingCheck = await runClaudeEmbeddingProbe(process.env.ANTHROPIC_API_KEY);
  const claudeChatCheck = await runClaudeChatProbe(process.env.ANTHROPIC_API_KEY);
  const supabaseCheck = await runSupabaseProbe(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  let status: ReadinessStatus = 'online';
  let reason = 'AI memory assistant is ready.';
  let provider = '';
  let model = '';

// Determine Claude status
  const claudeOnline = claudeEmbeddingCheck.status === 'pass' && claudeChatCheck.status === 'pass';

  if (claudeOnline) {
    provider = 'Anthropic Claude';
    model = 'claude-3-haiku + text-embedding-3-small';
    reason = 'AI memory assistant is ready (Claude).';
  } else {
    status = 'offline';
    provider = 'Claude';
    model = 'N/A';
    reason = 'Claude offline. Verify ANTHROPIC_API_KEY.';
  }

  // Check Supabase secondary
  if (supabaseCheck.status === 'skip' || supabaseCheck.status === 'fail') {
    if (status !== 'offline') {
      status = 'degraded';
      reason = (reason || '') + ' [Supabase unavailable]';
    }
  }

const payload: ReadinessPayload = {
    status,
    provider,
    model,
    reason,
    checks: {
      claudeEmbeddings: claudeEmbeddingCheck,
      claudeChat: claudeChatCheck,
      supabase: supabaseCheck,
    },
    lastCheckedAt: new Date().toISOString(),
  };

  cachedResult = {
    payload,
    expiresAt: now + HEALTH_CACHE_TTL_MS,
  };

  return NextResponse.json(payload, { status: 200 });
}

import { SupabaseClient } from '@supabase/supabase-js';
import { encryptToken, decryptToken } from './tokens';

const GOOGLE_REFRESH_MAX_ATTEMPTS = Math.max(1, Math.floor(Number(process.env.GOOGLE_REFRESH_MAX_ATTEMPTS || 3)));
const GOOGLE_REFRESH_BASE_DELAY_MS = Math.max(100, Math.floor(Number(process.env.GOOGLE_REFRESH_BASE_DELAY_MS || 400)));
const GOOGLE_REFRESH_MAX_DELAY_MS = Math.max(GOOGLE_REFRESH_BASE_DELAY_MS, Math.floor(Number(process.env.GOOGLE_REFRESH_MAX_DELAY_MS || 5000)));
const GOOGLE_REFRESH_JITTER_RATIO = Math.max(0, Math.min(1, Number(process.env.GOOGLE_REFRESH_JITTER_RATIO || 0.2)));

function isMissingTable(errorCode?: string) {
  return errorCode === '42P01';
}

export function computeBackoffDelayMs(attempt: number, randomValue = Math.random()) {
  const exponent = Math.max(0, attempt - 1);
  const base = Math.min(GOOGLE_REFRESH_MAX_DELAY_MS, GOOGLE_REFRESH_BASE_DELAY_MS * Math.pow(2, exponent));
  const minFactor = 1 - GOOGLE_REFRESH_JITTER_RATIO;
  const maxFactor = 1 + GOOGLE_REFRESH_JITTER_RATIO;
  const factor = minFactor + (maxFactor - minFactor) * Math.max(0, Math.min(1, randomValue));
  return Math.max(100, Math.min(GOOGLE_REFRESH_MAX_DELAY_MS, Math.round(base * factor)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeRefreshTelemetry(params: {
  supabase: SupabaseClient;
  userId: string;
  platform: 'gmail' | 'google_calendar';
  status: 'success' | 'error' | 'skipped';
  attempt: number;
  latencyMs: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  const { supabase, userId, platform, status, attempt, latencyMs, errorMessage, metadata } = params;

  const { error } = await supabase.from('oauth_refresh_logs').insert({
    user_id: userId,
    platform,
    status,
    attempt,
    latency_ms: Math.max(0, Math.floor(latencyMs)),
    error_message: errorMessage || null,
    metadata: metadata ?? {},
  });

  if (!error) {
    return;
  }

  if (isMissingTable(error.code)) {
    console.warn('[OAuth] oauth_refresh_logs table not found. Apply migration 009_oauth_refresh_logs.sql.');
    return;
  }

  console.warn('[OAuth] Failed to write refresh telemetry:', error.message);
}

export function isRetryableGoogleRefreshFailure(status: number | null, body: unknown) {
  if (!status) {
    return true;
  }

  if (status >= 500 || status === 429) {
    return true;
  }

  if (status >= 400 && status < 500) {
    const payload = body as { error?: string; error_description?: string } | null;
    const errorText = `${payload?.error || ''} ${payload?.error_description || ''}`.toLowerCase();

    if (errorText.includes('invalid_grant') || errorText.includes('invalid_client')) {
      return false;
    }

    return false;
  }

  return true;
}

/**
 * Checks if a Google OAuth access token is valid (using a 5-minute safety margin).
 * If expired, it uses the refresh_token to obtain a new one from Google.
 */
export async function getValidGoogleToken(
  supabase: SupabaseClient,
  userId: string,
  platform: 'gmail' | 'google_calendar'
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .maybeSingle();

  if (!tokenRow || !tokenRow.access_token) return null;

  const now = new Date();
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;
  
  // If we have at least 5 minutes left, use the existing token
  if (expiresAt && (expiresAt.getTime() - now.getTime()) > 5 * 60 * 1000) {
    return decryptToken(tokenRow.access_token);
  }

  // Otherwise, we need to refresh
  if (!tokenRow.refresh_token) {
    console.warn(`[OAuth] Cannot refresh ${platform} for ${userId}: No refresh_token found.`);
    await writeRefreshTelemetry({
      supabase,
      userId,
      platform,
      status: 'skipped',
      attempt: 1,
      latencyMs: 0,
      errorMessage: 'Missing refresh token.',
      metadata: {
        reason: 'missing_refresh_token',
      },
    });
    return decryptToken(tokenRow.access_token); // Try anyway, but likely to fail
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Google OAuth environment variables for token refresh.');
  }

  const refreshToken = decryptToken(tokenRow.refresh_token);

  for (let attempt = 1; attempt <= GOOGLE_REFRESH_MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const latencyMs = Date.now() - startedAt;
      const payload = (await response.json().catch(() => null)) as {
        access_token?: string;
        expires_in?: number;
        error?: string;
        error_description?: string;
      } | null;

      if (!response.ok || !payload?.access_token) {
        const message = payload?.error_description || payload?.error || `Refresh failed (${response.status})`;
        await writeRefreshTelemetry({
          supabase,
          userId,
          platform,
          status: 'error',
          attempt,
          latencyMs,
          errorMessage: message,
          metadata: {
            httpStatus: response.status,
          },
        });

        const retryable = isRetryableGoogleRefreshFailure(response.status, payload);
        if (!retryable || attempt >= GOOGLE_REFRESH_MAX_ATTEMPTS) {
          console.error(`[OAuth] Refresh failed for ${platform}:`, payload);
          return null;
        }

        await sleep(computeBackoffDelayMs(attempt));
        continue;
      }

      const newAccessToken = payload.access_token;
      const newExpiresIn = payload.expires_in;
      const newExpiresAt = newExpiresIn
        ? new Date(Date.now() + newExpiresIn * 1000).toISOString()
        : null;

      const { error: updateError } = await supabase
        .from('oauth_tokens')
        .update({
          access_token: encryptToken(newAccessToken),
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('platform', platform);

      if (updateError) {
        await writeRefreshTelemetry({
          supabase,
          userId,
          platform,
          status: 'error',
          attempt,
          latencyMs,
          errorMessage: updateError.message,
          metadata: {
            reason: 'token_persist_failed',
          },
        });
        return null;
      }

      await writeRefreshTelemetry({
        supabase,
        userId,
        platform,
        status: 'success',
        attempt,
        latencyMs,
        metadata: {
          expiresIn: newExpiresIn ?? null,
        },
      });

      return newAccessToken;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const latencyMs = Date.now() - startedAt;

      await writeRefreshTelemetry({
        supabase,
        userId,
        platform,
        status: 'error',
        attempt,
        latencyMs,
        errorMessage: message,
        metadata: {
          reason: 'network_or_runtime_error',
        },
      });

      if (attempt >= GOOGLE_REFRESH_MAX_ATTEMPTS) {
        console.error(`[OAuth] Unexpected error during ${platform} refresh:`, err);
        return null;
      }

      await sleep(computeBackoffDelayMs(attempt));
    }
  }

  return null;
}

/**
 * Utility for GitHub token refreshing (if configured as App or with refresh tokens enabled)
 * Note: standard GitHub PATs or simple OAuth apps without refresh enabled don't expire tokens.
 */
export async function getValidGithubToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: tokenRow } = await supabase
    .from('oauth_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .eq('platform', 'github')
    .maybeSingle();

  if (!tokenRow) return null;
  return decryptToken(tokenRow.access_token);
}


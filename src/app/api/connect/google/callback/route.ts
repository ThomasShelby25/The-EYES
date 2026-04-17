import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';
import { encryptToken } from '@/utils/tokens';

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

function googleRedirectUri(request: Request) {
  let requestOrigin = appBaseUrl();
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    requestOrigin = appBaseUrl();
  }

  const requestDerived = new URL('/api/connect/google/callback', requestOrigin).toString();
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!explicit) return requestDerived;

  try {
    const parsed = new URL(explicit);
    if (process.env.NODE_ENV !== 'production' && parsed.origin !== requestOrigin) {
      console.warn(
        `[Google OAuth] GOOGLE_REDIRECT_URI origin (${parsed.origin}) does not match request origin (${requestOrigin}). Using request-derived callback URL.`
      );
      return requestDerived;
    }

    return parsed.toString();
  } catch {
    console.warn('[Google OAuth] GOOGLE_REDIRECT_URI is invalid. Using request-derived callback URL.');
    return requestDerived;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/connect/gmail?oauth=error&reason=missing_google_env', appBaseUrl()));
  }

  const [requestedPlatformFromState] = (state || '').split(':');
  const platformFromState = requestedPlatformFromState === 'google-calendar' ? 'google-calendar' : 'gmail';

  if (oauthError) {
    const mappedReason = oauthError === 'access_denied' ? 'google_access_denied_unverified_or_not_tester' : `google_oauth_${oauthError}`;
    return NextResponse.redirect(
      new URL(`/connect/${platformFromState}?oauth=error&reason=${encodeURIComponent(mappedReason)}`, appBaseUrl())
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/connect/gmail?oauth=error&reason=missing_code_or_state', appBaseUrl()));
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('google_oauth_state')?.value;

  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(new URL('/connect/gmail?oauth=error&reason=invalid_state', appBaseUrl()));
  }

  cookieStore.delete('google_oauth_state');

  const [requestedPlatform] = state.split(':');
  const platform = requestedPlatform === 'google-calendar' ? 'google-calendar' : 'gmail';

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.redirect(new URL('/login', appBaseUrl()));
  }

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(request),
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(new URL(`/connect/${platform}?oauth=error&reason=token_exchange_failed`, appBaseUrl()));
  }

  const tokenBody = (await tokenResponse.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
    error?: string;
  };

  if (!tokenBody.access_token) {
    return NextResponse.redirect(
      new URL(`/connect/${platform}?oauth=error&reason=${encodeURIComponent(tokenBody.error || 'no_access_token')}`, appBaseUrl())
    );
  }

  const userId = authData.user.id;
  const now = new Date().toISOString();
  const expiresAt = tokenBody.expires_in
    ? new Date(Date.now() + tokenBody.expires_in * 1000).toISOString()
    : null;

  const accessToken = encryptToken(tokenBody.access_token);
  const refreshToken = tokenBody.refresh_token ? encryptToken(tokenBody.refresh_token) : null;

  const platforms = ['gmail', 'google_calendar'];

  const tokenUpserts = platforms.map((dbPlatform) =>
    supabase.from('oauth_tokens').upsert({
      user_id: userId,
      platform: dbPlatform,
      access_token: accessToken,
      refresh_token: refreshToken,
      scope: tokenBody.scope || 'gmail.readonly calendar.readonly',
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    }, { onConflict: 'user_id,platform' })
  );

  const syncUpserts = platforms.map((dbPlatform) =>
    supabase.from('sync_status').upsert({
      user_id: userId,
      platform: dbPlatform,
      status: 'authenticating',
      sync_progress: 5,
      total_items: 0,
      last_sync_at: null,
      next_sync_at: null,
      error_message: null,
    }, { onConflict: 'user_id,platform' })
  );

  const results = await Promise.all([...tokenUpserts, ...syncUpserts]);
  const hasError = results.some((result) => (result as { error?: unknown }).error);

  if (hasError) {
    return NextResponse.redirect(new URL(`/connect/${platform}?oauth=error&reason=token_persist_failed`, appBaseUrl()));
  }

  return NextResponse.redirect(new URL(`/connect/${platform}?oauth=success`, appBaseUrl()));
}

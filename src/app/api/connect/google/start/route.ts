import crypto from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

const allowedPlatforms = new Set(['gmail', 'google-calendar']);

const googleSharedScopes = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

function googleRedirectUri(request: Request) {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  let requestOrigin = appBaseUrl();
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    requestOrigin = appBaseUrl();
  }

  return new URL('/api/connect/google/callback', requestOrigin).toString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const platform = (url.searchParams.get('platform') || 'gmail').toLowerCase();

  if (!allowedPlatforms.has(platform)) {
    return NextResponse.redirect(new URL('/connect/gmail?oauth=error&reason=invalid_platform', appBaseUrl()));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(new URL(`/connect/${platform}?oauth=error&reason=missing_google_client_id`, appBaseUrl()));
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return NextResponse.redirect(new URL('/login', appBaseUrl()));
  }

  const nonce = crypto.randomUUID();
  const state = `${platform}:${nonce}`;

  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const callbackUrl = googleRedirectUri(request);
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('include_granted_scopes', 'true');
  authUrl.searchParams.set('state', state);
  // We persist Google OAuth credentials to both Gmail and Calendar connectors,
  // so request the union of scopes up-front to prevent connector-specific 403s later.
  authUrl.searchParams.set('scope', googleSharedScopes.join(' '));

  return NextResponse.redirect(authUrl);
}

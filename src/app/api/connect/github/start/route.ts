import crypto from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

function getAppBaseUrl(request: Request) {
  const host = request.headers.get('host') || 'localhost:3000';
  let protocol = 'https';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    protocol = 'http';
  }
  return process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;
}

function githubRedirectUri(request: Request) {
  const explicit = process.env.GITHUB_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return new URL('/api/connect/github/callback', getAppBaseUrl(request)).toString();
}

export async function GET(request: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const baseUrl = getAppBaseUrl(request);

  if (!clientId) {
    return NextResponse.redirect(new URL('/connect/github?oauth=error&reason=missing_client_id', baseUrl));
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const callbackUrl = githubRedirectUri(request);
  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('scope', 'read:user repo');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('allow_signup', 'false');

  return NextResponse.redirect(authUrl);
}

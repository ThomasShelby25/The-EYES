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

function redditRedirectUri(request: Request) {
  const explicit = process.env.REDDIT_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return new URL('/api/connect/reddit/callback', getAppBaseUrl(request)).toString();
}

export async function GET(request: Request) {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const baseUrl = getAppBaseUrl(request);

  if (!clientId) {
    return NextResponse.redirect(new URL('/connect/reddit?oauth=error&reason=missing_reddit_client_id', baseUrl));
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('reddit_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const callbackUrl = redditRedirectUri(request);
  const authUrl = new URL('https://www.reddit.com/api/v1/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('duration', 'permanent');
  authUrl.searchParams.set('scope', 'identity history read mysubreddits');

  return NextResponse.redirect(authUrl);
}

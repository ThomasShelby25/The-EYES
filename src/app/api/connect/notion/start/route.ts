import crypto from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createClient } from '@/utils/supabase/server';

function getRequestBaseUrl(request: Request) {
  const host = request.headers.get('host') || 'localhost:3000';
  let protocol = 'https';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    protocol = 'http';
  }
  return process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;
}

function notionRedirectUri(baseUrl: string) {
  const explicit = process.env.NOTION_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return new URL('/api/connect/notion/callback', baseUrl).toString();
}

export async function GET(request: Request) {
  const baseUrl = getRequestBaseUrl(request);
  const clientId = process.env.NOTION_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(new URL('/connect/notion?oauth=error&reason=missing_notion_client_id', baseUrl));
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('notion_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const callbackUrl = notionRedirectUri(baseUrl);
  const authUrl = new URL('https://api.notion.com/v1/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('owner', 'user');
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl);
}

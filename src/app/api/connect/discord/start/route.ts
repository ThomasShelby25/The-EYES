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

function discordRedirectUri(request: Request) {
  const explicit = process.env.DISCORD_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return new URL('/api/connect/discord/callback', getAppBaseUrl(request)).toString();
}

export async function GET(request: Request) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const baseUrl = getAppBaseUrl(request);

  if (!clientId) {
    return NextResponse.redirect(new URL('/connect/discord?oauth=error&reason=missing_client_id', baseUrl));
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.redirect(new URL('/login', baseUrl));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('discord_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const callbackUrl = discordRedirectUri(request);
  const authUrl = new URL('https://discord.com/api/oauth2/authorize');
  
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'identify email'); // messages.read requires bot/privileged scopes
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'consent');

  return NextResponse.redirect(authUrl);
}

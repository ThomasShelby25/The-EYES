import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  if (!clientId) {
    return NextResponse.redirect(new URL('/connect/linkedin?oauth=error&reason=missing_client_id', siteUrl));
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return NextResponse.redirect(new URL('/login', siteUrl));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set('linkedin_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const callbackUrl = new URL('/api/connect/linkedin/callback', siteUrl);
  const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
  
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'r_liteprofile r_emailaddress w_member_social'); // Adjusted for common scopes

  return NextResponse.redirect(authUrl);
}

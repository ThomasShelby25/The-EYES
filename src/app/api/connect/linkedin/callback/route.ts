import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const cookieStore = await cookies();
  const savedState = cookieStore.get('linkedin_oauth_state')?.value;

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL('/connect/linkedin?oauth=error&reason=invalid_state', siteUrl));
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/connect/linkedin?oauth=error&reason=missing_config', siteUrl));
  }

  try {
    const callbackUrl = new URL('/api/connect/linkedin/callback', siteUrl);
    
    const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl.toString(),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('LinkedIn Token Error:', data);
      return NextResponse.redirect(new URL('/connect/linkedin?oauth=error&reason=token_exchange_failed', siteUrl));
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(new URL('/login', siteUrl));
    }

    const expiresAt = data.expires_in 
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    const { error: tokenError } = await supabase
      .from('oauth_tokens')
      .upsert({
        user_id: user.id,
        platform: 'linkedin',
        access_token: data.access_token,
        refresh_token: data.refresh_token || null,
        expires_at: expiresAt,
        scope: data.scope || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' });

    if (tokenError) {
      console.error('Database Error:', tokenError);
      return NextResponse.redirect(new URL('/connect/linkedin?oauth=error&reason=db_save_failed', siteUrl));
    }

    // Initialize sync status
    await supabase
      .from('sync_status')
      .upsert({
        user_id: user.id,
        platform: 'linkedin',
        status: 'idle',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,platform' });

    return NextResponse.redirect(new URL('/connect/linkedin?oauth=success', siteUrl));
  } catch (err) {
    console.error('LinkedIn Auth Error:', err);
    return NextResponse.redirect(new URL('/connect/linkedin?oauth=error&reason=server_error', siteUrl));
  }
}

import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/';
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  console.log(`[Auth Callback] Processing request to: ${request.url}`);

  if (error || errorDescription) {
    console.error(`[Auth Callback] OAuth Error: ${error} - ${errorDescription}`);
    return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(errorDescription || error || 'Authentication failed')}`);
  }

  if (code) {
    const supabase = await createClient();
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!exchangeError && data.session) {
      console.log('[Auth Callback] Successfully exchanged code for session.');
      return NextResponse.redirect(`${requestUrl.origin}${next}`);
    }
    
    if (exchangeError) {
      console.error('[Auth Callback] Exchange Error:', exchangeError.message);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(exchangeError.message)}`);
    }
  }

  console.warn('[Auth Callback] No code found in URL and no specific error reported.');
  return NextResponse.redirect(`${requestUrl.origin}/login?error=Authentication failed. Please try again.`);
}

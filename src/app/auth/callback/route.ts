import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.session) {
      console.log('[Auth Callback] Successfully exchanged code for session.');
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    if (error) {
      console.error('[Auth Callback] Exchange Error:', error.message);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
    }
  }

  console.warn('[Auth Callback] No code found in URL or session exchange failed.');
  return NextResponse.redirect(`${origin}/login?error=Authentication failed. Please try again.`);
}

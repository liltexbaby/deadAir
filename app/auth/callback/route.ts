import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Magic-link landing point. Exchanges the one-time code for a session cookie.
 *
 * Being on the allowlist is checked separately by requireAdmin() — a valid link
 * proves the person owns the inbox, not that they are staff.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/admin';

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/admin/login?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

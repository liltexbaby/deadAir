import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Magic-link landing point. Exchanges the one-time code for a session cookie.
 *
 * Being on the allowlist is checked separately by requireAdmin() — a valid link
 * proves the person owns the inbox, not that they are staff.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const origin = publicOrigin(request);
  // Only paths on this site: "//evil.com" or a full URL would turn the
  // sign-in link into an open redirect.
  const requested = searchParams.get('next') ?? '/admin';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/admin';

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

/**
 * The address the visitor actually used. Behind a host's proxy (DigitalOcean
 * runs the app on port 8080) `request.nextUrl.origin` is the server's own
 * address — http://localhost:8080 — so a redirect built from it sends people
 * there. The proxy passes the real host along in the headers.
 */
function publicOrigin(request: NextRequest): string {
  if (process.env.NODE_ENV === 'development') return request.nextUrl.origin;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!host) return request.nextUrl.origin;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'https';
  return `${proto}://${host.split(',')[0].trim()}`;
}

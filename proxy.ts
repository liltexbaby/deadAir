import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next 16 renamed `middleware` to `proxy`; the old filename and the `middleware`
 * export are deprecated.
 *
 * This is an OPTIMISTIC check only. The docs are explicit that proxy "should not
 * be used as a full session management or authorization solution" — it runs on
 * every request including prefetches, so it does no database work. The real
 * boundary is requireAdmin() in lib/dal.ts, called by the admin layout and by
 * every Server Action. All this does is refresh the auth cookie and bounce
 * obviously-signed-out visitors before they render an admin page.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // supabase/ssr passes no-store headers alongside auth cookies so a CDN
          // can't serve one user's session to somebody else. Dropping these is a
          // real cache-poisoning risk, so they get copied onto the response.
          for (const [key, val] of Object.entries(headers ?? {})) {
            response.headers.set(key, val);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname.startsWith('/admin/login');

  if (!user && pathname.startsWith('/admin') && !isLoginRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};

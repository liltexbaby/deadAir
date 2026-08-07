import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Per-request Supabase client. Never share one across requests.
 *
 * Two version-specific details:
 *  - `cookies()` is async in Next 16; synchronous access was removed entirely.
 *  - @supabase/ssr deprecates get/set/remove in favour of getAll/setAll, and
 *    warns that implementing them incorrectly causes random logouts and hard
 *    to debug auth bugs.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Cookies cannot be written during a Server Component render.
            // proxy.ts refreshes the session on each request, so dropping the
            // write here is safe rather than fatal.
          }
        },
      },
    },
  );
}

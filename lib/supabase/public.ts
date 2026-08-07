import { createClient } from '@supabase/supabase-js';

/**
 * Cookie-less client for public content reads.
 *
 * The SSR client in ./server.ts calls cookies(), which opts the route out of
 * static rendering entirely — with it, `/` is rebuilt on every request and
 * `export const revalidate` has no effect. Public panels need no user session,
 * so reading through a plain anon client lets the homepage prerender and
 * revalidate on a timer instead.
 *
 * RLS still applies: this key can only see published rows and cannot write.
 */
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client. Used only by the admin login form to request a magic link —
 * all reads and writes otherwise happen on the server.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

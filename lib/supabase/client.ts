import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client. Used by the admin login form to request a magic link, and by
 * admin uploads, which go straight to storage with the admin's own session
 * (see lib/uploadMedia.ts). Everything else reads and writes on the server.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

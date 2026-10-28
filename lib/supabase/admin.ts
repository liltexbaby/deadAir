import 'server-only';

import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client: bypasses RLS and can manage auth users. Only for the
 * few things an admin's own session can't do — creating a login for a new
 * team member and writing the admin_users allowlist. Always behind
 * requireAdmin(); never import this into a client component.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY isn't configured (e.g. it was
 * never added to the host's environment), so callers can say so plainly.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

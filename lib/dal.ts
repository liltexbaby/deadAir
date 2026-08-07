import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Data Access Layer — the actual authorization boundary.
 *
 * The Next 16 auth guide is explicit that proxy.ts (formerly middleware) is an
 * optimistic check only and "should not be used as a full session management or
 * authorization solution". Server Actions compound this: they are reachable by
 * direct POST, not just through the UI, so route-level protection alone can be
 * bypassed entirely. Every action and every admin page calls requireAdmin()
 * itself.
 *
 * cache() dedupes within a single request, so calling this from a layout and
 * again from an action costs one round trip, not two.
 */

export const verifySession = cache(async () => {
  const supabase = await createClient();

  // getUser() revalidates the JWT against Supabase. getSession() only decodes
  // the cookie, which is spoofable, so it must not be used for authorization.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Authentication is not authorization: a valid Supabase account still has to
  // appear in the allowlist.
  const { data: admin } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  return { user, isAdmin: Boolean(admin) };
});

/** Throws the caller out to login unless they are an allowlisted admin. */
export async function requireAdmin() {
  const session = await verifySession();

  if (!session) redirect('/admin/login');
  if (!session.isAdmin) redirect('/admin/login?error=not_authorized');

  return session;
}

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/dal';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ActionState } from './types';

const NO_SERVICE_KEY =
  'adding people needs SUPABASE_SERVICE_ROLE_KEY in the site’s environment — ask whoever set up hosting';

/**
 * Give someone admin access. Creates their Supabase login if they don't have
 * one (confirmed, no password — they sign in with an emailed link) and adds
 * them to the allowlist. They then just go to /admin/login.
 */
export async function addAdmin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.email('that email doesn’t look right').safeParse(String(formData.get('email') ?? '').trim().toLowerCase());
  if (!parsed.success) return { fieldErrors: { email: [parsed.error.issues[0].message] } };
  const email = parsed.data;

  const admin = createAdminClient();
  if (!admin) return { error: NO_SERVICE_KEY };

  // Existing login? (Small team: the first pages of users are plenty.)
  let userId: string | null = null;
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { error: error.message };
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (error || !data.user) return { error: error?.message ?? 'couldn’t create the login' };
    userId = data.user.id;
  }

  const { error } = await admin.from('admin_users').upsert({ user_id: userId, email }, { onConflict: 'user_id' });
  if (error) return { error: error.message };

  revalidatePath('/admin/team');
  return { ok: true };
}

/** Take someone off the allowlist. Their login remains but opens nothing. */
export async function removeAdmin(userId: string) {
  const { user } = await requireAdmin();
  if (userId === user.id) throw new Error('you can’t remove yourself');

  const admin = createAdminClient();
  if (!admin) throw new Error(NO_SERVICE_KEY);

  const { count } = await admin.from('admin_users').select('user_id', { count: 'exact', head: true });
  if ((count ?? 0) <= 1) throw new Error('there has to be at least one admin');

  const { error } = await admin.from('admin_users').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/team');
}

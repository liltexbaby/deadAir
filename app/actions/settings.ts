'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from './types';

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

const optionalUrl = optionalText.refine(
  (v) => v === null || /^https?:\/\//.test(v),
  'must start with http:// or https://',
);

const SettingsSchema = z.object({
  about_text: optionalText,
  contact_email: optionalText.refine(
    (v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
    'not a valid email',
  ),
  merch_note: optionalText,
  instagram_url: optionalUrl,
  youtube_url: optionalUrl,
  store_url: optionalUrl,
});

export async function updateSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = SettingsSchema.safeParse({
    about_text: formData.get('about_text') ?? '',
    contact_email: formData.get('contact_email') ?? '',
    merch_note: formData.get('merch_note') ?? '',
    instagram_url: formData.get('instagram_url') ?? '',
    youtube_url: formData.get('youtube_url') ?? '',
    store_url: formData.get('store_url') ?? '',
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  // Credits are a free-form list; one per line is friendlier than JSON for staff.
  const credits = String(formData.get('credits') ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const supabase = await createClient();
  // upsert rather than update: the singleton row may not exist on a fresh DB.
  const { error } = await supabase
    .from('site_settings')
    .upsert({ id: 1, ...parsed.data, credits }, { onConflict: 'id' });

  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath('/admin/settings');
  return { ok: true };
}

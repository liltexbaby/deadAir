'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from './types';


const CONTACT_ROLES = ['management', 'booking', 'booking_eu', 'press', 'label'] as const;

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

const ContactSchema = z.object({
  role: z.enum(CONTACT_ROLES),
  name: optionalText,
  email: optionalText,
  url: optionalText,
});

const ArtistSchema = z.object({
  name: z.string().trim().min(1, 'name is required'),
  slug: z
    .string()
    .trim()
    .min(1, 'slug is required')
    .regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers and hyphens only'),
  external_label: optionalText,
  is_managed: z.coerce.boolean(),
  // Columns from migration 0002 — saving fails until it has been run.
  is_publishing: z.coerce.boolean(),
  email_subject: optionalText,
  email_body: optionalText,
  published: z.coerce.boolean(),
  position: z.coerce.number().int().min(0),
});

/**
 * Contacts are variable-length per artist, so the form serialises its rows to
 * JSON in a hidden field rather than using indexed input names.
 */
function parseContacts(raw: FormDataEntryValue | null) {
  if (typeof raw !== 'string' || raw.trim() === '') return { success: true as const, data: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { success: false as const, error: 'contacts payload was malformed' };
  }
  const result = z.array(ContactSchema).safeParse(parsed);
  if (!result.success) return { success: false as const, error: 'a contact row is invalid' };

  // A row with no email and no url carries nothing; drop rather than store noise.
  return { success: true as const, data: result.data.filter((c) => c.email || c.url || c.name) };
}

/** Uploads a replacement portrait if one was supplied; returns its storage path. */
async function uploadImage(formData: FormData, slug: string): Promise<string | null> {
  const file = formData.get('image') as File | null;
  if (!file || file.size === 0) return null;

  const supabase = await createClient();
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase();
  // Timestamped so a replacement never collides with the cached old URL.
  const path = `artists/${slug}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, { contentType: file.type || undefined, upsert: true });

  if (error) throw new Error(`image upload failed: ${error.message}`);
  return path;
}

function parseArtist(formData: FormData) {
  return ArtistSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    external_label: formData.get('external_label') ?? '',
    is_managed: formData.get('is_managed') === 'on',
    is_publishing: formData.get('is_publishing') === 'on',
    email_subject: formData.get('email_subject') ?? '',
    email_body: formData.get('email_body') ?? '',
    published: formData.get('published') === 'on',
    position: formData.get('position') || 0,
  });
}

export async function updateArtist(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = parseArtist(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const contacts = parseContacts(formData.get('contacts'));
  if (!contacts.success) return { error: contacts.error };

  const supabase = await createClient();

  let imagePath: string | null = null;
  try {
    imagePath = await uploadImage(formData, parsed.data.slug);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'image upload failed' };
  }

  const { error: artistErr } = await supabase
    .from('artists')
    .update({ ...parsed.data, ...(imagePath ? { image_path: imagePath } : {}) })
    .eq('id', id);
  if (artistErr) {
    return { error: artistErr.code === '23505' ? 'that slug is already taken' : artistErr.message };
  }

  // Replace the contact set wholesale. Simpler and less error-prone than
  // diffing rows, and the counts here are tiny.
  const { error: delErr } = await supabase.from('artist_contacts').delete().eq('artist_id', id);
  if (delErr) return { error: delErr.message };

  if (contacts.data.length > 0) {
    const { error: insErr } = await supabase.from('artist_contacts').insert(
      contacts.data.map((c, i) => ({ ...c, artist_id: id, position: (i + 1) * 10 })),
    );
    if (insErr) return { error: insErr.message };
  }

  revalidatePath('/');
  revalidatePath('/admin/artists');
  return { ok: true };
}

export async function createArtist(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = parseArtist(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const contacts = parseContacts(formData.get('contacts'));
  if (!contacts.success) return { error: contacts.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from('artists').insert(parsed.data).select('id').single();

  if (error) {
    return { error: error.code === '23505' ? 'that slug is already taken' : error.message };
  }

  if (contacts.data.length > 0) {
    await supabase.from('artist_contacts').insert(
      contacts.data.map((c, i) => ({ ...c, artist_id: data.id, position: (i + 1) * 10 })),
    );
  }

  revalidatePath('/');
  revalidatePath('/admin/artists');
  redirect('/admin/artists');
}

export async function deleteArtist(id: string) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from('artists').delete().eq('id', id);

  if (error) {
    // 23503 = FK violation: releases reference this artist (on delete restrict).
    if (error.code === '23503') {
      throw new Error('this artist still has releases — reassign or delete those first');
    }
    throw new Error(error.message);
  }

  revalidatePath('/');
  revalidatePath('/admin/artists');
  redirect('/admin/artists');
}

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from './types';

/**
 * Server Actions are reachable by direct POST, not only through the admin UI —
 * the Next docs are explicit that route protection alone is insufficient. Every
 * action below therefore calls requireAdmin() as its first statement, and RLS
 * independently rejects the write even if that were ever missed.
 */

// Empty form inputs arrive as '' — normalise to null so the DB stores a real
// absence rather than an empty string.
const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .refine((v) => v === null || /^https?:\/\//.test(v), { message: 'must start with http:// or https://' });

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

const ReleaseSchema = z.object({
  catalog_number: z.coerce.number().int().min(1, 'must be 1 or greater'),
  title: z.string().trim().min(1, 'title is required'),
  artist_id: z.string().uuid('pick an artist'),
  format: optionalText,
  release_date: optionalText,
  spotify_url: optionalUrl,
  apple_music_url: optionalUrl,
  bandcamp_url: optionalUrl,
  youtube_url: optionalUrl,
  soundcloud_url: optionalUrl,
  store_url: optionalUrl,
  published: z.coerce.boolean(),
});

function parse(formData: FormData) {
  return ReleaseSchema.safeParse({
    catalog_number: formData.get('catalog_number'),
    title: formData.get('title'),
    artist_id: formData.get('artist_id'),
    format: formData.get('format') ?? '',
    release_date: formData.get('release_date') ?? '',
    spotify_url: formData.get('spotify_url') ?? '',
    apple_music_url: formData.get('apple_music_url') ?? '',
    bandcamp_url: formData.get('bandcamp_url') ?? '',
    youtube_url: formData.get('youtube_url') ?? '',
    soundcloud_url: formData.get('soundcloud_url') ?? '',
    store_url: formData.get('store_url') ?? '',
    published: formData.get('published') === 'on',
  });
}

/** Uploads a replacement cover if one was supplied; returns its storage path. */
async function uploadCover(
  formData: FormData,
  catalogNumber: number,
): Promise<string | null> {
  const file = formData.get('cover') as File | null;
  if (!file || file.size === 0) return null;

  const supabase = await createClient();
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  // Timestamped so a replacement never collides with the cached old URL.
  const path = `covers/${String(catalogNumber).padStart(2, '0')}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, { contentType: file.type || undefined, upsert: true });

  if (error) throw new Error(`cover upload failed: ${error.message}`);
  return path;
}

export async function updateRelease(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const supabase = await createClient();

  let coverPath: string | null = null;
  try {
    coverPath = await uploadCover(formData, parsed.data.catalog_number);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'cover upload failed' };
  }

  const { error } = await supabase
    .from('releases')
    .update({ ...parsed.data, ...(coverPath ? { cover_path: coverPath } : {}) })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath('/admin');
  return { ok: true };
}

export async function createRelease(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const supabase = await createClient();

  let coverPath: string | null = null;
  try {
    coverPath = await uploadCover(formData, parsed.data.catalog_number);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'cover upload failed' };
  }

  const { error } = await supabase
    .from('releases')
    .insert({ ...parsed.data, ...(coverPath ? { cover_path: coverPath } : {}) });

  if (error) {
    // 23505 = unique violation, which here always means the catalog number.
    return { error: error.code === '23505' ? 'that catalog number already exists' : error.message };
  }

  revalidatePath('/');
  revalidatePath('/admin');
  redirect('/admin');
}

export async function deleteRelease(id: string) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from('releases').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/');
  revalidatePath('/admin');
  redirect('/admin');
}

'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from './types';

/*
 * GALLERY admin. Images never pass through these actions: the browser
 * compresses each one and uploads it straight to the `media` bucket with the
 * admin's own session (storage RLS allows admins to write), then calls
 * addGalleryItems with just the paths. That sidesteps the Server Action body
 * limit, so a whole batch can go up at once.
 */

const NewItem = z.object({
  title: z.string().trim().min(1).max(200),
  image_path: z.string().trim().min(1).max(500),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

function done() {
  revalidatePath('/');
  revalidatePath('/admin/gallery');
}

/** Append uploaded pieces to the end of the gallery, in the order given. */
export async function addGalleryItems(items: unknown): Promise<ActionState> {
  await requireAdmin();
  const parsed = z.array(NewItem).min(1).max(200).safeParse(items);
  if (!parsed.success) return { error: 'some uploads were malformed' };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from('gallery_items')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.position ?? 0) + 10;

  const { error } = await supabase
    .from('gallery_items')
    .insert(parsed.data.map((item, i) => ({ ...item, position: start + i * 10, published: true })));
  if (error) return { error: error.message };

  done();
  return { ok: true };
}

const ItemSchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  caption: z
    .string()
    .trim()
    .max(1000)
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  published: z.coerce.boolean(),
  // Set only when the image was replaced (uploaded by the browser first).
  image_path: z.string().trim().optional(),
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
});

export async function updateGalleryItem(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = ItemSchema.safeParse({
    title: formData.get('title'),
    caption: formData.get('caption') ?? '',
    published: formData.get('published') === 'on',
    image_path: formData.get('image_path') || undefined,
    width: formData.get('width') || undefined,
    height: formData.get('height') || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  const { image_path, width, height, ...rest } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from('gallery_items')
    .update({ ...rest, ...(image_path ? { image_path, width: width ?? null, height: height ?? null } : {}) })
    .eq('id', id);
  if (error) return { error: error.message };

  done();
  return { ok: true };
}

export async function deleteGalleryItem(id: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { data: row } = await supabase.from('gallery_items').select('image_path').eq('id', id).maybeSingle();
  const { error } = await supabase.from('gallery_items').delete().eq('id', id);
  if (error) throw new Error(error.message);
  // Tidy the file too; a failure here only leaves an orphan in storage.
  if (row?.image_path && !row.image_path.startsWith('http')) {
    await supabase.storage.from('media').remove([row.image_path]);
  }
  done();
  redirect('/admin/gallery');
}

/** Swap a piece with its neighbour, for the up/down arrows in the list. */
export async function moveGalleryItem(id: string, dir: 'up' | 'down') {
  await requireAdmin();
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from('gallery_items')
    .select('id, position')
    .order('position', { ascending: true });
  if (error || !rows) return;

  const i = rows.findIndex((r) => r.id === id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return;

  // Renumber everything in steps of 10 with the pair swapped, so equal or
  // gappy positions (from older edits) can't make a swap a no-op.
  const order = rows.map((r) => r.id);
  [order[i], order[j]] = [order[j], order[i]];
  await Promise.all(
    order.map((rowId, k) => supabase.from('gallery_items').update({ position: (k + 1) * 10 }).eq('id', rowId)),
  );
  done();
}

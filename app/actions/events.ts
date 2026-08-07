'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import type { ActionState } from './types';

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : v))
  .nullable();

const EventSchema = z.object({
  title: z.string().trim().min(1, 'title is required'),
  // Nullable throughout: the label's listings are often just a promo + link.
  artist_id: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .refine((v) => v === null || z.string().uuid().safeParse(v).success, 'invalid artist'),
  event_date: optionalText,
  venue: optionalText,
  city: optionalText,
  country: optionalText,
  ticket_url: optionalText.refine(
    (v) => v === null || /^https?:\/\//.test(v),
    'must start with http:// or https://',
  ),
  status: z.enum(['announced', 'on_sale', 'sold_out', 'cancelled']),
  published: z.coerce.boolean(),
  position: z.coerce.number().int().min(0),
});

function parse(formData: FormData) {
  return EventSchema.safeParse({
    title: formData.get('title'),
    artist_id: formData.get('artist_id') ?? '',
    event_date: formData.get('event_date') ?? '',
    venue: formData.get('venue') ?? '',
    city: formData.get('city') ?? '',
    country: formData.get('country') ?? '',
    ticket_url: formData.get('ticket_url') ?? '',
    status: formData.get('status') ?? 'announced',
    published: formData.get('published') === 'on',
    position: formData.get('position') || 0,
  });
}

async function uploadImage(formData: FormData): Promise<string | null> {
  const file = formData.get('image') as File | null;
  if (!file || file.size === 0) return null;

  const supabase = await createClient();
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `events/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('media')
    .upload(path, file, { contentType: file.type || undefined, upsert: true });

  if (error) throw new Error(`image upload failed: ${error.message}`);
  return path;
}

export async function updateEvent(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  let imagePath: string | null = null;
  try {
    imagePath = await uploadImage(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'image upload failed' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('events')
    .update({ ...parsed.data, ...(imagePath ? { image_path: imagePath } : {}) })
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath('/admin/live');
  return { ok: true };
}

export async function createEvent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = parse(formData);
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]> };
  }

  let imagePath: string | null = null;
  try {
    imagePath = await uploadImage(formData);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'image upload failed' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('events')
    .insert({ ...parsed.data, ...(imagePath ? { image_path: imagePath } : {}) });

  if (error) return { error: error.message };

  revalidatePath('/');
  revalidatePath('/admin/live');
  redirect('/admin/live');
}

export async function deleteEvent(id: string) {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/');
  revalidatePath('/admin/live');
  redirect('/admin/live');
}

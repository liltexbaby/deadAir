'use client';

import { createClient } from '@/lib/supabase/client';
import { compressImageFile } from '@/lib/compressImage';

export interface UploadedImage {
  path: string;
  width: number | null;
  height: number | null;
}

/**
 * Compress an image in the browser and upload it straight to the `media`
 * bucket under `folder/`, as the signed-in admin (storage RLS only lets admins
 * write). Going direct rather than through a Server Action means there's no
 * request-size cap, so large batches are fine.
 */
export async function uploadImage(file: File, folder: string): Promise<UploadedImage> {
  const small = await compressImageFile(file);

  let width: number | null = null;
  let height: number | null = null;
  try {
    const bmp = await createImageBitmap(small);
    width = bmp.width;
    height = bmp.height;
    bmp.close();
  } catch {
    // Unknown size just means the site shows it in a square frame.
  }

  const base = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  const ext = (small.name.split('.').pop() ?? 'jpg').toLowerCase();
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${base || 'image'}.${ext}`;

  const { error } = await createClient()
    .storage.from('media')
    .upload(path, small, { contentType: small.type || undefined, upsert: false });
  if (error) throw new Error(`${file.name}: ${error.message}`);

  return { path, width, height };
}

/** A filename as a title: extension dropped, as the gallery has used so far. */
export const titleFromFilename = (name: string) => name.replace(/\.[^.]+$/, '');

import type { ChangeEvent } from 'react';

/**
 * Browser-side image compression for admin uploads (covers, posters).
 *
 * Has to happen in the browser, not the Server Action: Server Actions cap the
 * request body (see serverActions.bodySizeLimit in next.config.ts) and the host
 * caps it again at ~4.5 MB, while label artwork routinely arrives at 5-35 MB.
 * Shrinking before upload keeps every upload small and fast, and stops the
 * catalog from filling back up with multi-megabyte originals.
 *
 * Same rules as scripts/compress-media.ts: max 1600px on the long side, JPEG,
 * or WebP when the image actually uses transparency. Small files already within
 * the size cap pass through untouched.
 */

const MAX_SIDE = 1600;
const SKIP_UNDER_BYTES = 400 * 1024;

export async function compressImageFile(file: File): Promise<File> {
  // Animated / vector formats would be flattened to a still — leave them be.
  if (!file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;   // a format this browser can't decode; let the server have it
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < SKIP_UNDER_BYTES) return file;

  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  // Only keep alpha if some pixel actually uses it.
  const alpha = ctx.getImageData(0, 0, w, h).data;
  let transparent = false;
  for (let i = 3; i < alpha.length; i += 4) {
    if (alpha[i] < 255) {
      transparent = true;
      break;
    }
  }
  if (!transparent) {
    // JPEG has no alpha; paint behind rather than let edges go black.
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }

  const type = transparent ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, transparent ? 0.9 : 0.86),
  );
  if (!blob || (scale === 1 && blob.size >= file.size)) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + (transparent ? '.webp' : '.jpg');
  return new File([blob], name, { type });
}

/**
 * onChange for an `<input type="file">`: swaps the picked file for its
 * compressed version in place, so the form submits it unchanged otherwise.
 */
export async function compressPickedImage(e: ChangeEvent<HTMLInputElement>): Promise<void> {
  const input = e.currentTarget;
  const file = input.files?.[0];
  if (!file) return;
  const compressed = await compressImageFile(file);
  if (compressed === file) return;
  const dt = new DataTransfer();
  dt.items.add(compressed);
  input.files = dt.files;
}

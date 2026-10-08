/**
 * One-off: make web-sized copies of oversized catalog covers and tour posters
 * and point the database at them.
 *
 * The originals imported from deadairrecords.com run up to 34 MB (dA-23's
 * cover); 89 MB across the catalog. next/image resizes for visitors, but it
 * has to download and decode the full original on every cache miss, which is
 * what made covers slow to appear — and very large sources can fail to
 * optimise at all.
 *
 * Copies are max 1600px on the long side (covers render at ~300px, posters
 * ~500px, so this is generous even on retina), JPEG — or WebP where the image
 * actually uses transparency. Originals are left in storage as masters.
 * Idempotent: already-compressed (`-web`) paths and small files are skipped.
 *
 * Run:  node --experimental-strip-types scripts/compress-media.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
// Ships with Next.js (its image optimiser); not a direct dependency.
import sharp from 'sharp';

function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // fall back to the real environment
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const MAX_SIDE = 1600;
const SKIP_UNDER_BYTES = 400 * 1024;

async function compress(path: string): Promise<{ path: string; before: number; after: number } | null> {
  if (/-web\.(jpg|webp)$/.test(path)) return null;
  const { data, error } = await supabase.storage.from('media').download(path);
  if (error) throw new Error(`${path}: ${error.message}`);
  const input = Buffer.from(await data.arrayBuffer());

  const img = sharp(input);
  const meta = await img.metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (input.length < SKIP_UNDER_BYTES && longest <= MAX_SIDE) return null;

  // Only treat it as transparent if some pixel actually is — many PNG covers
  // carry an alpha channel that's fully opaque.
  const transparent = meta.hasAlpha && !(await img.stats()).isOpaque;
  const resized = sharp(input).resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
  const output = transparent
    ? await resized.webp({ quality: 90 }).toBuffer()
    : await resized.flatten({ background: '#ffffff' }).jpeg({ quality: 86, mozjpeg: true }).toBuffer();

  const ext = transparent ? 'webp' : 'jpg';
  const target = path.replace(/\.[^.]+$/, '') + `-web.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('media')
    .upload(target, output, { contentType: transparent ? 'image/webp' : 'image/jpeg', upsert: true });
  if (upErr) throw new Error(`${target}: ${upErr.message}`);
  return { path: target, before: input.length, after: output.length };
}

async function run(table: 'releases' | 'events', column: 'cover_path' | 'image_path', label: (r: Record<string, unknown>) => string) {
  const { data, error } = await supabase.from(table).select(`id, ${column}, *`);
  if (error) throw error;
  let before = 0;
  let after = 0;
  for (const row of data as Record<string, unknown>[]) {
    const path = row[column] as string | null;
    if (!path || path.startsWith('http')) continue;
    const result = await compress(path);
    if (!result) {
      console.log(`  skip  ${label(row)}`);
      continue;
    }
    const { error: updErr } = await supabase.from(table).update({ [column]: result.path }).eq('id', row.id as string);
    if (updErr) throw new Error(`${label(row)}: ${updErr.message}`);
    before += result.before;
    after += result.after;
    console.log(
      `  ok    ${label(row)}  ${(result.before / 1048576).toFixed(1)} MB -> ${(result.after / 1024).toFixed(0)} KB  (${result.path})`,
    );
  }
  console.log(`  ${table}: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(1)} MB`);
}

async function main() {
  console.log('covers');
  await run('releases', 'cover_path', (r) => `dA-${String(r.catalog_number).padStart(2, '0')} ${r.title}`);
  console.log('posters');
  await run('events', 'image_path', (r) => String(r.title));
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

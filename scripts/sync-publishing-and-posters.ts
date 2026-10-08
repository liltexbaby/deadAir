/**
 * One-off: bring the database in line with the original deadairrecords.com
 * (checked page by page against pub.html, mgmt.html and live.html):
 *
 *   - PUBLISHING roster: Full Body 2, Jane Remover, kuru, quannnic — in that
 *     order. Full Body 2 didn't exist yet; quannnic had no portrait.
 *   - LIVE posters for the three current events.
 *   - MGMT order matching mgmt.html (DAZEGXD first, kmoe before kuru).
 *
 * Same shape as scripts/import-artist-images.ts: images are re-hosted in the
 * `media` bucket rather than hotlinked, so nothing breaks when the old static
 * site is retired. Idempotent — safe to run again.
 *
 * Run:  node --experimental-strip-types scripts/sync-publishing-and-posters.ts
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
const SOURCE_BASE = 'https://deadairrecords.com';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/**
 * Copy a file from the old site into the media bucket; returns its path.
 * With `poster`, it's also downscaled to a web size: the originals are huge
 * (the RMP poster is a 22 MB PNG), which next/image chokes on and no visitor
 * needs. Pixel-art portraits are left untouched.
 */
async function rehost(filename: string, target: string, poster = false): Promise<string> {
  const res = await fetch(`${SOURCE_BASE}/${filename}`);
  if (!res.ok) throw new Error(`${filename}: HTTP ${res.status}`);
  let bytes = new Uint8Array(await res.arrayBuffer());
  let contentType = res.headers.get('content-type') ?? 'image/png';
  if (poster) {
    bytes = new Uint8Array(
      await sharp(bytes)
        .resize({ height: 2000, withoutEnlargement: true })
        .jpeg({ quality: 86, mozjpeg: true })
        .toBuffer(),
    );
    contentType = 'image/jpeg';
  }
  const { error } = await supabase.storage
    .from('media')
    .upload(target, bytes, { contentType, upsert: true });
  if (error) throw new Error(`${target}: ${error.message}`);
  return target;
}

async function artistByName(name: string) {
  const { data, error } = await supabase
    .from('artists')
    .select('id, name, slug, position, image_path, is_publishing')
    .ilike('name', name)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`no artist named ${name}`);
  return data;
}

async function update(table: string, id: string, patch: Record<string, unknown>, what: string) {
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) throw new Error(`${what}: ${error.message}`);
  console.log(`  ok    ${what}`);
}

async function main() {
  // ---------------------------------------------------------- MGMT order
  // mgmt.html order. Positions also order the PUBLISHING panel.
  const MGMT_ORDER = ['Dazegxd', 'Jane Remover', 'kmoe', 'kuru', 'Lucy Bedroque', 'Racing Mount Pleasant', 'Dagmar Zuniga'];
  console.log('mgmt order');
  for (const [i, name] of MGMT_ORDER.entries()) {
    const a = await artistByName(name);
    await update('artists', a.id, { position: (i + 1) * 10 }, `${a.name} -> position ${(i + 1) * 10}`);
  }

  // ---------------------------------------------------------- publishing
  console.log('publishing');
  // Full Body 2 leads pub.html, so it sorts first (position 5).
  const fullBodyImage = await rehost('fullbodysonic.png', 'artists/full-body-2.png');
  const { error: fbErr } = await supabase.from('artists').upsert(
    {
      slug: 'full-body-2',
      name: 'Full Body 2',
      is_managed: false,
      is_publishing: true,
      published: true,
      position: 5,
      image_path: fullBodyImage,
    },
    { onConflict: 'slug' },
  );
  if (fbErr) throw new Error(`Full Body 2: ${fbErr.message}`);
  console.log('  ok    Full Body 2 created/updated (with portrait)');

  for (const name of ['Jane Remover', 'kuru']) {
    const a = await artistByName(name);
    await update('artists', a.id, { is_publishing: true }, `${a.name} flagged publishing`);
  }

  const quannnic = await artistByName('quannnic');
  const qImage = await rehost('leezquannnic-export.png', `artists/${quannnic.slug}.png`);
  await update('artists', quannnic.id, { is_publishing: true, image_path: qImage }, 'quannnic flagged publishing (with portrait)');

  // ---------------------------------------------------------- live posters
  console.log('live posters');
  const POSTERS: Record<string, [string, string]> = {
    'Bedroque :002': ['bedroquetour2.PNG', 'events/bedroque-002.jpg'],
    'Flutters Away': ['operellyfluttertour.png', 'events/flutters-away.jpg'],
    'Racing Mount Pleasant Tour': ['rmp.png.png', 'events/racing-mount-pleasant-tour.jpg'],
  };
  for (const [title, [file, target]] of Object.entries(POSTERS)) {
    const { data: ev, error } = await supabase.from('events').select('id').eq('title', title).maybeSingle();
    if (error) throw error;
    if (!ev) throw new Error(`no event titled ${title}`);
    const path = await rehost(file, target, true);
    await update('events', ev.id, { image_path: path }, `${title} poster`);
  }
}

main().catch((err) => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});

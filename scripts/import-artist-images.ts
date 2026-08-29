/**
 * One-off: pull the pixel-art artist portraits from the original
 * deadairrecords.com mgmt page into the `media` bucket and set
 * artists.image_path.
 *
 * Same shape as scripts/import-covers.ts — re-hosting rather than hotlinking,
 * so nothing breaks when the old static site is retired.
 *
 * Run:  node --experimental-strip-types scripts/import-artist-images.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

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

/** artist slug -> filename on the original site */
const PORTRAITS: Record<string, string> = {
  'jane-remover': 'leezjane-export.png',
  dazegxd: 'leezdaze-export.png',
  kuru: 'leezkeeg-export.png',
  kmoe: 'kmoe8bit.png',
  'lucy-bedroque': 'leezlucy.png',
  'racing-mount-pleasant': 'leezRMP.png',
  'dagmar-zuniga': 'dagmar8bit.png',
};

async function main() {
  let uploaded = 0;
  const failures: string[] = [];

  for (const [slug, filename] of Object.entries(PORTRAITS)) {
    const url = `${SOURCE_BASE}/${filename}`;
    try {
      const { data: artist, error: findErr } = await supabase
        .from('artists')
        .select('id, name, image_path')
        .eq('slug', slug)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!artist) {
        failures.push(`${slug}: no matching artist row`);
        console.error(`  MISS  ${slug} — no artist with that slug`);
        continue;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());

      const target = `artists/${slug}.png`;
      const { error: upErr } = await supabase.storage
        .from('media')
        .upload(target, bytes, { contentType: 'image/png', upsert: true });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from('artists')
        .update({ image_path: target })
        .eq('id', artist.id);
      if (updErr) throw updErr;

      console.log(`  ok    ${artist.name.padEnd(24)} ${target}`);
      uploaded++;
    } catch (err) {
      // Supabase rejects with plain objects, not Error instances, so String()
      // on them yields a useless "[object Object]".
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null
            ? JSON.stringify(err)
            : String(err);
      console.error(`  FAIL  ${slug} — ${msg}`);
      failures.push(`${slug}: ${msg}`);
    }
  }

  console.log(`\nuploaded ${uploaded}, failed ${failures.length}`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

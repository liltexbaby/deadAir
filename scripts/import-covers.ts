/**
 * One-off: download each release cover from the live deadairrecords.com site,
 * upload it to the Supabase `media` bucket, and rewrite releases.cover_path to
 * the storage path.
 *
 * Re-hosting rather than hotlinking, so the site keeps working when the old
 * static site is retired.
 *
 * Run:  npx tsx scripts/import-covers.ts
 * Needs SUPABASE_SERVICE_ROLE_KEY — it bypasses RLS, so this is server-side only
 * and must never be imported by application code.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Minimal .env.local loader so this runs without extra deps.
function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // fall back to real environment variables
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

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

async function main() {
  const { data: releases, error } = await supabase
    .from('releases')
    .select('id, catalog_number, title, cover_path')
    .order('catalog_number');

  if (error) throw error;

  let uploaded = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const release of releases ?? []) {
    const source = release.cover_path;

    // Already migrated (seed values are bare filenames; storage paths are prefixed).
    if (!source || source.startsWith('covers/')) {
      skipped++;
      continue;
    }

    const url = `${SOURCE_BASE}/${source}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const bytes = new Uint8Array(await res.arrayBuffer());
      const ext = source.split('.').pop()!.toLowerCase();
      const target = `covers/${String(release.catalog_number).padStart(2, '0')}-${source}`;

      const { error: upErr } = await supabase.storage
        .from('media')
        .upload(target, bytes, {
          contentType: CONTENT_TYPES[ext] ?? 'application/octet-stream',
          upsert: true,
        });
      if (upErr) throw upErr;

      const { error: updErr } = await supabase
        .from('releases')
        .update({ cover_path: target })
        .eq('id', release.id);
      if (updErr) throw updErr;

      console.log(`  ok    dA-${String(release.catalog_number).padStart(2, '0')}  ${target}`);
      uploaded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL  dA-${String(release.catalog_number).padStart(2, '0')}  ${url} — ${msg}`);
      failures.push(`${release.title}: ${msg}`);
    }
  }

  console.log(`\nuploaded ${uploaded}, skipped ${skipped}, failed ${failures.length}`);
  if (failures.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

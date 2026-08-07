import Link from 'next/link';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { createRelease } from '@/app/actions/releases';
import ReleaseForm from '../ReleaseForm';

export const dynamic = 'force-dynamic';

export default async function NewRelease() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data: artists }, { data: last }] = await Promise.all([
    supabase.from('artists').select('id, name').order('name'),
    supabase
      .from('releases')
      .select('catalog_number')
      .order('catalog_number', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <>
      <Link
        href="/admin"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors"
      >
        ← releases
      </Link>

      <h1 className="mt-6 font-mono text-sm text-white/90">new release</h1>

      <div className="mt-8">
        <ReleaseForm
          action={createRelease}
          submitLabel="create release"
          artists={artists ?? []}
          values={{
            // Pre-fill the next number in sequence — it's always the same edit.
            catalog_number: (last?.catalog_number ?? 0) + 1,
            title: '',
            artist_id: '',
            format: '',
            release_date: '',
            spotify_url: '',
            apple_music_url: '',
            bandcamp_url: '',
            youtube_url: '',
            soundcloud_url: '',
            store_url: '',
            published: true,
            coverUrl: null,
          }}
        />
      </div>
    </>
  );
}

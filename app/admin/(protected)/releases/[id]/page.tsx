import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { updateRelease, deleteRelease } from '@/app/actions/releases';
import type { ActionState } from '@/app/actions/types';
import ReleaseForm from '../ReleaseForm';

export const dynamic = 'force-dynamic';

function publicUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

// params is a Promise in Next 16; synchronous access was removed.
export default async function EditRelease({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: release }, { data: artists }] = await Promise.all([
    supabase.from('releases').select('*').eq('id', id).maybeSingle(),
    supabase.from('artists').select('id, name').order('name'),
  ]);

  if (!release) notFound();

  // Bind the row id; useActionState supplies (prevState, formData).
  async function action(prev: ActionState, formData: FormData) {
    'use server';
    return updateRelease(id, prev, formData);
  }

  async function remove() {
    'use server';
    await deleteRelease(id);
  }

  return (
    <>
      <div className="flex items-baseline justify-between">
        <Link
          href="/admin"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors"
        >
          ← releases
        </Link>
        <form action={remove}>
          <button
            type="submit"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400/60 hover:text-red-400 transition-colors cursor-pointer"
          >
            delete
          </button>
        </form>
      </div>

      <h1 className="mt-6 font-mono text-sm text-white/90">
        dA - {String(release.catalog_number).padStart(2, '0')} — {release.title}
      </h1>

      <div className="mt-8">
        <ReleaseForm
          action={action}
          submitLabel="save changes"
          artists={artists ?? []}
          values={{
            catalog_number: release.catalog_number,
            title: release.title ?? '',
            artist_id: release.artist_id ?? '',
            format: release.format ?? '',
            release_date: release.release_date ?? '',
            spotify_url: release.spotify_url ?? '',
            apple_music_url: release.apple_music_url ?? '',
            bandcamp_url: release.bandcamp_url ?? '',
            youtube_url: release.youtube_url ?? '',
            soundcloud_url: release.soundcloud_url ?? '',
            store_url: release.store_url ?? '',
            published: release.published,
            coverUrl: publicUrl(release.cover_path),
          }}
        />
      </div>
    </>
  );
}

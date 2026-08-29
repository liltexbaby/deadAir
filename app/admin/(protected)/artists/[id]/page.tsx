import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { updateArtist, deleteArtist } from '@/app/actions/artists';
import type { ActionState } from '@/app/actions/types';
import ArtistForm from '../ArtistForm';

export const dynamic = 'force-dynamic';

export default async function EditArtist({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: artist } = await supabase
    .from('artists')
    .select('*, artist_contacts(role, name, email, url, position)')
    .eq('id', id)
    .maybeSingle();

  if (!artist) notFound();

  async function action(prev: ActionState, formData: FormData) {
    'use server';
    return updateArtist(id, prev, formData);
  }

  async function remove() {
    'use server';
    await deleteArtist(id);
  }

  const contacts = ((artist.artist_contacts ?? []) as {
    role: string;
    name: string | null;
    email: string | null;
    url: string | null;
    position: number;
  }[])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ role: c.role, name: c.name ?? '', email: c.email ?? '', url: c.url ?? '' }));

  return (
    <>
      <div className="flex items-baseline justify-between">
        <Link
          href="/admin/artists"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors"
        >
          ← artists
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

      <h1 className="mt-6 font-mono text-sm text-white/90">{artist.name}</h1>

      <div className="mt-8">
        <ArtistForm
          action={action}
          submitLabel="save changes"
          values={{
            name: artist.name ?? '',
            slug: artist.slug ?? '',
            external_label: artist.external_label ?? '',
            is_managed: artist.is_managed,
            published: artist.published,
            position: artist.position ?? 0,
            contacts,
            imageUrl: artist.image_path
              ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${artist.image_path}`
              : null,
          }}
        />
      </div>
    </>
  );
}

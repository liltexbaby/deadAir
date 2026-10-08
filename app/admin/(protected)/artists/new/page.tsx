import Link from 'next/link';
import { requireAdmin } from '@/lib/dal';
import { createArtist } from '@/app/actions/artists';
import ArtistForm from '../ArtistForm';

export const dynamic = 'force-dynamic';

export default async function NewArtist() {
  await requireAdmin();

  return (
    <>
      <Link
        href="/admin/artists"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors"
      >
        ← artists
      </Link>

      <h1 className="mt-6 font-mono text-sm text-white/90">new artist</h1>

      <div className="mt-8">
        <ArtistForm
          action={createArtist}
          submitLabel="create artist"
          values={{
            name: '',
            slug: '',
            external_label: '',
            is_managed: true,
            is_publishing: false,
            email_subject: '',
            email_body: '',
            published: true,
            position: 0,
            contacts: [],
            imageUrl: null,
          }}
        />
      </div>
    </>
  );
}

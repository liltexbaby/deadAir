import Link from 'next/link';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminArtists() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: artists, error } = await supabase
    .from('artists')
    .select('id, name, slug, external_label, is_managed, published, position, artist_contacts(id)')
    .order('position', { ascending: true });

  if (error) {
    return <p className="font-mono text-xs text-red-400/80">failed to load: {error.message}</p>;
  }

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          artists — {artists?.length ?? 0}
        </h2>
        <Link
          href="/admin/artists/new"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
        >
          + new artist
        </Link>
      </div>

      <ul className="mt-5 divide-y divide-white/10 border-t border-white/10">
        {(artists ?? []).map((a) => (
          <li key={a.id}>
            <Link
              href={`/admin/artists/${a.id}`}
              className="flex items-baseline gap-4 py-3 hover:bg-white/[0.03] transition-colors"
            >
              <span className="font-mono text-xs text-white/90 flex-1">{a.name}</span>

              {a.external_label && (
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
                  {a.external_label}
                </span>
              )}

              {a.is_managed && (
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
                  roster · {(a.artist_contacts as { id: string }[] | null)?.length ?? 0} contact(s)
                </span>
              )}

              {!a.published && (
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400/70">
                  draft
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

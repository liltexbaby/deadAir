import Link from 'next/link';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminReleases() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: releases, error } = await supabase
    .from('releases')
    .select('id, catalog_number, title, published, artists(name)')
    .order('catalog_number', { ascending: true });

  if (error) {
    return <p className="font-mono text-xs text-red-400/80">failed to load: {error.message}</p>;
  }

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          releases — {releases?.length ?? 0}
        </h2>
        <Link
          href="/admin/releases/new"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
        >
          + new release
        </Link>
      </div>

      <ul className="mt-5 divide-y divide-white/10 border-t border-white/10">
        {(releases ?? []).map((r) => {
          const rel = r.artists as { name: string } | { name: string }[] | null;
          const artist = Array.isArray(rel) ? rel[0]?.name : rel?.name;
          return (
            <li key={r.id}>
              <Link
                href={`/admin/releases/${r.id}`}
                className="flex items-baseline gap-4 py-3 hover:bg-white/[0.03] transition-colors"
              >
                <span className="font-mono text-[10px] text-white/35 w-16 shrink-0">
                  dA - {String(r.catalog_number).padStart(2, '0')}
                </span>
                <span className="font-mono text-xs text-white/90 flex-1">{r.title}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                  {artist ?? '—'}
                </span>
                {!r.published && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-400/70">
                    draft
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

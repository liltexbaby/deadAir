import Link from 'next/link';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AdminLive() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, event_date, venue, city, status, published, position, artists(name)')
    .order('position', { ascending: true });

  if (error) {
    return <p className="font-mono text-xs text-red-400/80">failed to load: {error.message}</p>;
  }

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
          events — {events?.length ?? 0}
        </h2>
        <Link
          href="/admin/live/new"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
        >
          + new event
        </Link>
      </div>

      <ul className="mt-5 divide-y divide-white/10 border-t border-white/10">
        {(events ?? []).map((e) => {
          const rel = e.artists as { name: string } | { name: string }[] | null;
          const artist = Array.isArray(rel) ? rel[0]?.name : rel?.name;
          const place = [e.venue, e.city].filter(Boolean).join(', ');
          return (
            <li key={e.id}>
              <Link
                href={`/admin/live/${e.id}`}
                className="flex items-baseline gap-4 py-3 hover:bg-white/[0.03] transition-colors"
              >
                <span className="font-mono text-[10px] text-white/35 w-24 shrink-0">
                  {e.event_date ?? 'no date'}
                </span>
                <span className="font-mono text-xs text-white/90 flex-1">{e.title}</span>
                {artist && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                    {artist}
                  </span>
                )}
                {place && <span className="font-mono text-[10px] text-white/30">{place}</span>}
                {e.status !== 'announced' && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
                    {e.status.replace('_', ' ')}
                  </span>
                )}
                {!e.published && (
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

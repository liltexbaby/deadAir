import Image from 'next/image';
import type { EventDTO } from '@/lib/queries';

const STATUS_LABELS: Record<string, string> = {
  sold_out: 'sold out',
  cancelled: 'cancelled',
  on_sale: 'on sale',
};

/**
 * Dates are optional by design: the label's current live listings are promo
 * cards with a ticket link and nothing else. Every date/venue line is therefore
 * conditional rather than a fixed slot, so an event with no details renders as
 * a clean title + link instead of empty rows.
 */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toLowerCase();
}

export default function LivePanel({ events }: { events: EventDTO[] }) {
  if (events.length === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        no dates announced
      </p>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        dates — {events.length}
      </div>

      <ul className="divide-y divide-white/10 border-t border-white/10">
        {events.map((event) => {
          const place = [event.venue, event.city].filter(Boolean).join(', ');
          const statusLabel = STATUS_LABELS[event.status];
          const isDead = event.status === 'cancelled' || event.status === 'sold_out';

          return (
            <li key={event.id} className="py-5 flex gap-4">
              {event.imageUrl && (
                <Image
                  src={event.imageUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 border border-white/10 object-cover"
                />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-3">
                  <h3 className="font-mono text-xs text-white/90">{event.title}</h3>
                  {statusLabel && (
                    <span
                      className={`font-mono text-[9px] uppercase tracking-[0.2em] ${
                        isDead ? 'text-white/30' : 'text-emerald-400/70'
                      }`}
                    >
                      {statusLabel}
                    </span>
                  )}
                </div>

                {event.artist && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                    {event.artist}
                  </p>
                )}

                {(event.date || place) && (
                  <p className="mt-1.5 font-mono text-[11px] text-white/55">
                    {event.date && formatDate(event.date)}
                    {event.date && place && <span className="text-white/25"> · </span>}
                    {place}
                  </p>
                )}

                {event.ticketUrl && !isDead && (
                  <a
                    href={event.ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2.5 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white border-b border-white/15 hover:border-white/50 transition-colors"
                  >
                    tickets
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

import type { ManagedArtistDTO } from '@/lib/queries';

/**
 * Artist -> contacts, matching how the label's own mgmt page is organised.
 * Contact counts vary per artist (kuru has two management emails and no
 * booking), so rows are rendered from the data rather than fixed slots.
 */
export default function MgmtPanel({ artists }: { artists: ManagedArtistDTO[] }) {
  if (artists.length === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        no artists listed yet
      </p>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        roster — {artists.length}
      </div>

      <ul className="divide-y divide-white/10 border-t border-white/10">
        {artists.map((artist) => (
          <li key={artist.id} className="py-5">
            <div className="flex items-baseline gap-3">
              <h3 className="font-mono text-xs text-white/90">{artist.name}</h3>
              {artist.externalLabel && (
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
                  {artist.externalLabel}
                </span>
              )}
            </div>

            {artist.contacts.length > 0 && (
              <dl className="mt-3 space-y-1.5">
                {artist.contacts.map((contact, i) => (
                  <div key={`${contact.role}-${contact.email ?? contact.url ?? i}`} className="flex gap-4">
                    <dt className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                      {contact.label}
                    </dt>
                    <dd className="font-mono text-[11px] text-white/70">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="hover:text-white border-b border-transparent hover:border-white/40 transition-colors"
                        >
                          {contact.email}
                        </a>
                      ) : contact.url ? (
                        <a
                          href={contact.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-white border-b border-transparent hover:border-white/40 transition-colors"
                        >
                          {contact.url}
                        </a>
                      ) : (
                        contact.name ?? '—'
                      )}
                      {contact.name && contact.email && (
                        <span className="ml-2 text-white/30">{contact.name}</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

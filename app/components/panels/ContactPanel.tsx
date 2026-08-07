import type { SiteSettingsDTO } from '@/lib/queries';

export default function ContactPanel({ settings }: { settings: SiteSettingsDTO | null }) {
  if (!settings) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        no contact details yet
      </p>
    );
  }

  const links = [
    ['instagram', settings.instagramUrl],
    ['youtube', settings.youtubeUrl],
    ['store', settings.storeUrl],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <div className="w-full font-mono">
      {settings.aboutText && (
        <p className="text-sm leading-relaxed text-white/75">{settings.aboutText}</p>
      )}

      {settings.contactEmail && (
        <div className="mt-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">general</p>
          <a
            href={`mailto:${settings.contactEmail}`}
            className="mt-1.5 inline-block text-[11px] text-white/75 hover:text-white border-b border-transparent hover:border-white/40 transition-colors"
          >
            {settings.contactEmail}
          </a>
        </div>
      )}

      {settings.merchNote && (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">merch</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-white/55">{settings.merchNote}</p>
        </div>
      )}

      {links.length > 0 && (
        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">elsewhere</p>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
            {links.map(([label, url]) => (
              <li key={label}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-white/60 hover:text-white border-b border-white/15 hover:border-white/50 transition-colors"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {settings.credits.length > 0 && (
        <div className="mt-10 border-t border-white/10 pt-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">site visuals by</p>
          <p className="mt-2 text-[11px] leading-relaxed text-white/45">
            {settings.credits.join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}

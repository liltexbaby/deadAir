'use client';

import { useState } from 'react';
import AlbumCard from './AlbumCard';
import type { ReleaseDTO } from '@/lib/queries';

export default function CatalogGrid({ releases }: { releases: ReleaseDTO[] }) {
  // The one open card (hovered, or tapped on touch). Opening one closes the rest.
  const [openId, setOpenId] = useState<string | null>(null);

  if (releases.length === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">
        no releases yet
      </p>
    );
  }

  return (
    <div className="@container w-full">
      {/* Container queries, not viewport ones: this grid lives inside a
          half-width panel, so `lg:` was firing off a 1024px viewport and forcing
          3 columns into a ~636px box. */}
      <div className="grid grid-cols-1 @xs:grid-cols-2 @2xl:grid-cols-3 gap-5 @sm:gap-6">
        {releases.map((release) => (
          <AlbumCard
            key={release.id}
            release={release}
            isHovered={openId === release.id}
            // Closing only clears it if this card is still the open one, so a
            // late mouseleave can't shut a card that's just been opened.
            setIsHovered={(open) =>
              setOpenId((cur) => (open ? release.id : cur === release.id ? null : cur))
            }
          />
        ))}
      </div>

      {/* Bottom rule */}
      <div className="mt-10 border-t border-black/10" />
    </div>
  );
}

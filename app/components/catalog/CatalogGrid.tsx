'use client';

import AlbumCard from './AlbumCard';
import type { ReleaseDTO } from '@/lib/queries';

export default function CatalogGrid({ releases }: { releases: ReleaseDTO[] }) {
  if (releases.length === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        no releases yet
      </p>
    );
  }

  return (
    <div className="@container w-full">
      {/* Grid info header */}
      <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        total releases — {releases.length}
      </div>

      {/* Container queries, not viewport ones: this grid lives inside a
          half-width panel, so `lg:` was firing off a 1024px viewport and forcing
          3 columns into a ~636px box. */}
      <div className="grid grid-cols-1 @xs:grid-cols-2 @2xl:grid-cols-3 gap-5 @sm:gap-6">
        {releases.map((release) => (
          <AlbumCard key={release.id} release={release} />
        ))}
      </div>

      {/* Bottom rule */}
      <div className="mt-10 border-t border-white/10" />
    </div>
  );
}

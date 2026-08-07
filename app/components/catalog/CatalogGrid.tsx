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
    <div className="w-full">
      {/* Grid info header */}
      <div className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        total releases — {releases.length}
      </div>

      {/* Album grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {releases.map((release) => (
          <AlbumCard key={release.id} release={release} />
        ))}
      </div>

      {/* Bottom rule */}
      <div className="mt-10 border-t border-white/10" />
    </div>
  );
}

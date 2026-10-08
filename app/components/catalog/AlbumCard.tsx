'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import Image from 'next/image';
import type { ReleaseDTO } from '@/lib/queries';
import { useCoarsePointer } from '@/lib/useCoarsePointer';

export default function AlbumCard({ release }: { release: ReleaseDTO }) {
  const [isHovered, setIsHovered] = useState(false);
  const coarse = useCoarsePointer();

  // Tailwind v4 wraps every `hover:` utility in @media (hover: hover), and this
  // overlay was gated on mouse events alone — so on a phone the Spotify/Apple
  // links were unreachable entirely. That's lost content, not lost polish.
  // On touch the artwork toggles the overlay instead.
  const showLinks = isHovered && release.links.length > 0;

  return (
    <motion.div
      className="relative group"
      onMouseEnter={() => !coarse && setIsHovered(true)}
      onMouseLeave={() => !coarse && setIsHovered(false)}
      // No entrance animation on touch. All 25 cards mount in one commit, so on
      // a phone this fired 25 simultaneous framer animations at exactly the
      // moment the panel finished sliding in — the frame budget is already
      // spent on the slide itself and the panel's full-screen backdrop blur.
      initial={coarse ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Album art container */}
      <div
        className="aspect-square relative border border-black/15 bg-black/[0.03] overflow-hidden"
        onClick={() => coarse && setIsHovered((v) => !v)}
        role={coarse && release.links.length > 0 ? 'button' : undefined}
        aria-label={coarse && release.links.length > 0 ? `Show links for ${release.title}` : undefined}
      >
        {release.coverUrl ? (
          <Image
            src={release.coverUrl}
            alt={`${release.title} by ${release.artist}`}
            fill
            sizes="(min-width: 1024px) 20vw, (min-width: 768px) 30vw, 45vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-black/25">
            {release.catalogLabel}
          </div>
        )}

        {/* Hover overlay with streaming links. Built from the links array, so a
            release with only Spotify simply shows one row. */}
        {showLinks && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-white/75 backdrop-blur-md flex flex-col items-center justify-center gap-2 p-4"
          >
            {release.links.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-black/60 hover:text-black border-b border-black/10 hover:border-black/40 transition-colors text-center"
              >
                {link.label}
              </a>
            ))}
          </motion.div>
        )}
      </div>

      {/* Album info */}
      <div className="mt-2.5 font-mono">
        <p className="text-[10px] uppercase tracking-[0.2em] text-black/40">
          {release.catalogLabel} — {release.artist}
        </p>
        <p className="text-xs text-black/90 mt-1">{release.title}</p>
      </div>
    </motion.div>
  );
}

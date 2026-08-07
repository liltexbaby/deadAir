'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import Image from 'next/image';
import type { ReleaseDTO } from '@/lib/queries';

export default function AlbumCard({ release }: { release: ReleaseDTO }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Album art container */}
      <div className="aspect-square relative border border-white/15 bg-white/[0.03] overflow-hidden">
        {release.coverUrl ? (
          <Image
            src={release.coverUrl}
            alt={`${release.title} by ${release.artist}`}
            fill
            sizes="(min-width: 1024px) 20vw, (min-width: 768px) 30vw, 45vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-white/25">
            {release.catalogLabel}
          </div>
        )}

        {/* Hover overlay with streaming links. Built from the links array, so a
            release with only Spotify simply shows one row. */}
        {isHovered && release.links.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center gap-2 p-4"
          >
            {release.links.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white border-b border-white/10 hover:border-white/40 transition-colors text-center"
              >
                {link.label}
              </a>
            ))}
          </motion.div>
        )}
      </div>

      {/* Album info */}
      <div className="mt-2.5 font-mono">
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          {release.catalogLabel} — {release.artist}
        </p>
        <p className="text-xs text-white/90 mt-1">{release.title}</p>
      </div>
    </motion.div>
  );
}

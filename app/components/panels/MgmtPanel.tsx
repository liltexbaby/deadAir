'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

import type { ManagedArtistDTO } from '@/lib/queries';

const SWIPE_DISTANCE = 50;   // px of drag that counts as a deliberate swipe
const SWIPE_VELOCITY = 400;  // ...or a flick this fast, however short

/**
 * Artist -> contacts as a one-at-a-time carousel, matching how the label's own
 * mgmt page presents its roster.
 *
 * The track holds every slide in normal flow and is translated by index, rather
 * than absolutely positioning one slide at a time. That way the container takes
 * the height of the tallest artist and never jumps as you page through — contact
 * counts vary (kuru has two management emails and no booking), so a
 * self-sizing container would resize on almost every transition.
 */
export default function MgmtPanel({ artists }: { artists: ManagedArtistDTO[] }) {
  const [index, setIndex] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Translate in pixels, not percentages: drag reports pixel offsets, and mixing
  // the two units on the same `x` makes the track jump when a swipe ends.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = artists.length;
  // Clamped rather than wrapping: the prev/next controls disable at the ends,
  // so a swipe past the last artist should stop there too.
  const go = useCallback(
    (next: number) => setIndex(Math.min(Math.max(next, 0), Math.max(count - 1, 0))),
    [count],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Left/right only. Up/down still scroll the panel, and Escape still
      // closes it via SiteShell.
      if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'ArrowRight') go(index + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, go]);

  if (count === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        no artists listed yet
      </p>
    );
  }

  const atStart = index === 0;
  const atEnd = index === count - 1;

  return (
    // @container so slides respond to the panel's width, not the viewport's —
    // the panel is half-width on desktop, so viewport breakpoints measure the
    // wrong box entirely.
    <div className="@container w-full" aria-roledescription="carousel" aria-label="Managed roster">
      <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        <span>roster — {count}</span>
        <span aria-live="polite" className="tabular-nums text-white/55">
          {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </span>
      </div>

      {/* Controls sit above the carousel, not below it.
          Now that the portrait fills the panel width, a full slide is taller
          than the viewport on a phone — controls underneath landed ~50px below
          the fold, so paging required scrolling first. Above the image they are
          always in view on both sizes, and it avoids a sticky bar that would
          have to fake the panel's translucent background. */}
      <div className="mb-5 flex items-center justify-between gap-4 border-y border-white/10 py-2.5">
        <button
          onClick={() => go(index - 1)}
          disabled={atStart}
          aria-label="Previous artist"
          // -my keeps the ~44px tap target without inflating the row.
          className="-my-3 py-3 pr-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/45 transition-colors hover:text-white disabled:pointer-events-none disabled:text-white/15 cursor-pointer"
        >
          ‹ prev
        </button>

        <ol className="flex items-center gap-2">
          {artists.map((artist, i) => (
            <li key={artist.id}>
              <button
                onClick={() => go(i)}
                aria-label={artist.name}
                aria-current={i === index}
                className={`block h-1.5 w-1.5 rotate-45 transition-colors cursor-pointer ${
                  i === index ? 'bg-white/80' : 'bg-white/20 hover:bg-white/45'
                }`}
              />
            </li>
          ))}
        </ol>

        <button
          onClick={() => go(index + 1)}
          disabled={atEnd}
          aria-label="Next artist"
          className="-my-3 py-3 pl-3 font-mono text-[11px] uppercase tracking-[0.2em] text-white/45 transition-colors hover:text-white disabled:pointer-events-none disabled:text-white/15 cursor-pointer"
        >
          next ›
        </button>
      </div>

      <div ref={viewport} className="overflow-hidden">
        <motion.ul
          className="flex items-stretch"
          animate={{ x: -index * width }}
          transition={{ type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={(_, info) => {
            const { offset, velocity } = info;
            if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) go(index + 1);
            else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) go(index - 1);
          }}
        >
          {artists.map((artist, i) => (
            <li
              key={artist.id}
              // Off-screen slides stay in the DOM to hold the track's height, so
              // they must be hidden from assistive tech and taken out of the tab
              // order — otherwise focus walks into invisible contact links.
              aria-hidden={i !== index}
              inert={i !== index}
              className="w-full shrink-0 select-none"
            >
              {artist.imageUrl && (
                <Image
                  src={artist.imageUrl}
                  alt=""
                  width={640}
                  height={640}
                  draggable={false}
                  // The panel is half-width on desktop and full-width on a
                  // phone; without this next/image would size for the whole
                  // viewport and ship a needlessly large file on desktop.
                  sizes="(min-width: 640px) 50vw, 100vw"
                  // Sources are square, so a square box crops nothing.
                  // They're also pixel art — smoothing them defeats the look,
                  // and upscaling to the full panel width is the point.
                  className="mb-5 aspect-square w-full border border-white/10 object-cover [image-rendering:pixelated]"
                />
              )}

              <div className="flex items-baseline gap-3">
                <h3 className="font-mono text-sm text-white/90">{artist.name}</h3>
                {artist.externalLabel && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
                    {artist.externalLabel}
                  </span>
                )}
              </div>

              {artist.contacts.length > 0 && (
                <dl className="mt-4 space-y-2">
                  {artist.contacts.map((contact, ci) => (
                    <div
                      key={`${contact.role}-${contact.email ?? contact.url ?? ci}`}
                      className="flex flex-col gap-0.5 @sm:flex-row @sm:gap-4"
                    >
                      <dt className="@sm:w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-white/35">
                        {contact.label}
                      </dt>
                      <dd className="min-w-0 break-all font-mono text-[11px] text-white/70">
                        {contact.email ? (
                          <a
                            href={`mailto:${contact.email}`}
                            className="border-b border-transparent transition-colors hover:border-white/40 hover:text-white"
                          >
                            {contact.email}
                          </a>
                        ) : contact.url ? (
                          <a
                            href={contact.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="border-b border-transparent transition-colors hover:border-white/40 hover:text-white"
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
        </motion.ul>
      </div>

    </div>
  );
}

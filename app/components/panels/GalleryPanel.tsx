'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

import type { GalleryItemDTO } from '@/lib/queries';
import { playSfx } from '@/lib/sound';
import PixelPortrait from './PixelPortrait';
import { StepButton } from './MgmtPanel';

const SWIPE_DISTANCE = 50;   // px of drag that counts as a deliberate swipe
const SWIPE_VELOCITY = 400;  // ...or a flick this fast, however short

const num = (i: number) => String(i + 1).padStart(2, '0');

/**
 * GALLERY: a grid of the label's artwork, and a viewer for one piece at a
 * time.
 *
 * Grid — square thumbnails with the catalog's caption and hover bar.
 * Viewer — the whole image (never cropped: flyers, mockups and logos are all
 * different shapes), changing with the same pixel break-up / resolve as the
 * MGMT portraits; prev/next, swipe and arrow keys step through, and back (or
 * Escape) returns to the same place in the grid.
 */
export default function GalleryPanel({ items }: { items: GalleryItemDTO[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [pulse, setPulse] = useState({ prev: 0, next: 0 });
  const root = useRef<HTMLDivElement>(null);
  // Grid scroll position, restored when the viewer closes.
  const gridScroll = useRef(0);
  const count = items.length;

  const scroller = () => root.current?.closest<HTMLElement>('.overflow-y-auto') ?? null;

  const show = (i: number) => {
    const el = scroller();
    gridScroll.current = el?.scrollTop ?? 0;
    setOpen(i);
    requestAnimationFrame(() => scroller()?.scrollTo({ top: 0 }));
  };

  const close = useCallback(() => {
    setOpen(null);
    requestAnimationFrame(() => scroller()?.scrollTo({ top: gridScroll.current }));
  }, []);

  // The open index, readable synchronously so rapid steps (key repeat, a
  // swipe right after a tap) each move exactly one and sound exactly once.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const step = useCallback(
    (dir: 1 | -1) => {
      const i = openRef.current;
      if (i === null) return;
      const next = i + dir;
      if (next < 0 || next >= count) return;
      openRef.current = next;
      playSfx('press');
      setPulse((p) => (dir === 1 ? { ...p, next: p.next + 1 } : { ...p, prev: p.prev + 1 }));
      setOpen(next);
    },
    [count],
  );

  // Viewer keys. Captured on window so Escape closes the viewer first rather
  // than the whole panel (SiteShell's listener sits behind this one).
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open, close, step]);

  if (count === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">nothing here yet</p>
    );
  }

  // ------------------------------------------------------------------ viewer
  if (open !== null) {
    const item = items[open];
    return (
      <div ref={root} className="flex min-h-full flex-col">
        <div className="flex items-center justify-between border-b border-black/10 pb-3">
          <button
            onClick={close}
            className="-my-2 py-2 pr-3 font-mono text-[10px] uppercase tracking-[0.2em] text-black/50 transition-colors hover:text-black cursor-pointer"
          >
            ‹ back
          </button>
          <span aria-live="polite" className="font-mono text-[10px] tabular-nums tracking-[0.2em] text-black/45">
            {num(open)} / {num(count - 1)}
          </span>
        </div>

        {/* The frame keeps one size for every piece, so stepping through
            mixed shapes doesn't make the controls jump around. */}
        <motion.div
          className="relative mt-5 h-[62dvh] w-full touch-pan-y sm:h-[calc(100dvh-17rem)]"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            const { offset, velocity } = info;
            if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) step(1);
            else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) step(-1);
          }}
        >
          <PixelPortrait
            src={item.src}
            alt={item.title}
            fit="contain"
            pixelated={false}
            sizes="(min-width: 640px) 50vw, 100vw"
          />
        </motion.div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/10 pt-2">
          <StepButton
            label="‹ prev"
            aria-label="Previous image"
            disabled={open === 0}
            pulse={pulse.prev}
            onClick={() => step(-1)}
          />
          <p className="min-w-0 truncate text-center font-mono text-xs text-black/80">{item.title}</p>
          <StepButton
            label="next ›"
            aria-label="Next image"
            disabled={open === count - 1}
            pulse={pulse.next}
            onClick={() => step(1)}
          />
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------- grid
  return (
    <div ref={root} className="@container w-full">
      <div className="grid grid-cols-2 gap-5 @2xl:grid-cols-3 @sm:gap-6">
        {items.map((item, i) => (
          <button
            key={item.id}
            onClick={() => show(i)}
            aria-label={`Open ${item.title}`}
            className="group block text-left cursor-pointer"
          >
            <div className="relative aspect-square overflow-hidden border border-black/15 bg-black/[0.03]">
              <Image
                src={item.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 15vw, (min-width: 640px) 22vw, 45vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
            </div>
            {/* Caption with the catalog's hover wipe. */}
            <div className="relative mt-2 font-mono">
              <Caption index={i} title={item.title} />
              <div
                aria-hidden
                className="ui-wipe absolute inset-0 bg-black/80 transition-[clip-path] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] [clip-path:inset(0_100%_0_0)] group-hover:duration-300 group-hover:[clip-path:inset(0_0_0_0)] group-focus-visible:[clip-path:inset(0_0_0_0)]"
              >
                <Caption index={i} title={item.title} inverted />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Caption({ index, title, inverted = false }: { index: number; title: string; inverted?: boolean }) {
  return (
    <div className="px-2 py-1.5">
      <p className={`text-[10px] tabular-nums uppercase tracking-[0.2em] ${inverted ? 'text-white/60' : 'text-black/40'}`}>
        no. {num(index)}
      </p>
      <p className={`mt-1 truncate text-xs ${inverted ? 'text-white' : 'text-black/90'}`}>{title}</p>
    </div>
  );
}

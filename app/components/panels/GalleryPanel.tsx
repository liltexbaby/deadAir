'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { motion } from 'framer-motion';

import type { GalleryItemDTO } from '@/lib/queries';
import { playSfx } from '@/lib/sound';
import PixelPortrait from './PixelPortrait';
import { StepButton } from './MgmtPanel';

const SWIPE_DISTANCE = 50;   // px of drag that counts as a deliberate swipe
const SWIPE_VELOCITY = 400;  // ...or a flick this fast, however short

const num = (i: number) => String(i + 1).padStart(2, '0');

// Opening a piece: the tapped tile holds its "selected" state for a beat (the
// same bar and corner brackets as the MGMT roster), then the thumbnail glides
// from its spot in the grid into the viewer and hands over to the full image.
// Touch holds longer — a finger covers the tile, so the beat needs to land
// before it moves; with a mouse the glide is the point, so it starts sooner.
const SELECT_HOLD_MS = 140;
const SELECT_HOLD_TOUCH_MS = 320;
const GLIDE_S = 0.6;
const GLIDE_EASE = [0.16, 1, 0.3, 1] as const;

type Box = { left: number; top: number; width: number; height: number };
interface Glide {
  src: string;
  from: Box;
  /** Where the image sits in the viewer; measured once the viewer is laid out. */
  to: Box | null;
  /** 'fly' while moving, 'fade' while handing over to what's underneath. */
  phase: 'fly' | 'fade';
  /** open: tile -> viewer. close: viewer -> back down into its tile. */
  dir: 'open' | 'close';
  index: number;
}

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The box an image of `aspect` occupies when contained, centred, in `frame`. */
function containIn(frame: DOMRect, aspect: number): Box {
  let width = frame.width;
  let height = width / aspect;
  if (height > frame.height) {
    height = frame.height;
    width = height * aspect;
  }
  return { left: frame.left + (frame.width - width) / 2, top: frame.top + (frame.height - height) / 2, width, height };
}

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
  const [selecting, setSelecting] = useState<number | null>(null);
  const [glide, setGlide] = useState<Glide | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);
  // Grid scroll position, restored when the viewer closes.
  const gridScroll = useRef(0);
  const count = items.length;

  const scroller = () => root.current?.closest<HTMLElement>('.overflow-y-auto') ?? null;

  const show = (i: number) => {
    if (selecting !== null) return;
    const reduce = prefersReduced();
    const touch = window.matchMedia('(pointer: coarse)').matches;
    setSelecting(i);
    holdTimer.current = window.setTimeout(
      () => {
        const thumb = root.current?.querySelector<HTMLElement>(`[data-gal-thumb="${i}"]`);
        const img = thumb?.querySelector('img');
        const r = thumb?.getBoundingClientRect();
        gridScroll.current = scroller()?.scrollTop ?? 0;
        if (!reduce && r) {
          setGlide({
            // The thumbnail's own file when it has loaded (instant); the full
            // piece if it hasn't yet (a cold first visit).
            src: img?.currentSrc || items[i].src,
            from: { left: r.left, top: r.top, width: r.width, height: r.height },
            to: null,
            phase: 'fly',
            dir: 'open',
            index: i,
          });
        }
        setSelecting(null);
        setOpen(i);
        // Reset the scroll, then measure where the image will land.
        requestAnimationFrame(() => {
          scroller()?.scrollTo({ top: 0 });
          requestAnimationFrame(() => {
            const frame = frameRef.current?.getBoundingClientRect();
            if (!frame) return setGlide(null);
            const { width, height } = items[i];
            const to = containIn(frame, width && height ? width / height : 1);
            setGlide((g) => (g ? { ...g, to } : g));
          });
        });
      },
      reduce ? 0 : touch ? SELECT_HOLD_TOUCH_MS : SELECT_HOLD_MS,
    );
  };

  // Glide landed: wait for the viewer's own (sharper) image to be up, then
  // fade the travelling thumbnail off it.
  const landed = () => {
    const start = performance.now();
    const check = () => {
      const img = frameRef.current?.querySelector('img');
      if ((img && img.style.opacity === '1') || performance.now() - start > 1500) {
        setGlide((g) => (g ? { ...g, phase: 'fade' } : g));
      } else requestAnimationFrame(check);
    };
    check();
  };

  // The open index, readable synchronously so rapid steps (key repeat, a
  // swipe right after a tap) each move exactly one and sound exactly once.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Closing reverses the opening: the piece glides from the viewer back down
  // into its tile while the grid fades in around it. If the visitor stepped to
  // another piece, it's that piece's tile, scrolled into view.
  const close = useCallback(() => {
    const i = openRef.current;
    if (i === null) return;
    const frame = frameRef.current?.getBoundingClientRect();
    const img = frameRef.current?.querySelector('img');
    if (!prefersReduced() && frame && img?.currentSrc) {
      const { width, height } = items[i];
      setGlide({
        src: img.currentSrc,
        from: containIn(frame, width && height ? width / height : 1),
        to: null,
        phase: 'fly',
        dir: 'close',
        index: i,
      });
    } else setGlide(null);
    setOpen(null);
    requestAnimationFrame(() => {
      const el = scroller();
      el?.scrollTo({ top: gridScroll.current });
      requestAnimationFrame(() => {
        const thumb = root.current?.querySelector<HTMLElement>(`[data-gal-thumb="${i}"]`);
        if (!thumb) return setGlide(null);
        let r = thumb.getBoundingClientRect();
        const view = el?.getBoundingClientRect();
        if (el && view && (r.top < view.top || r.bottom > view.bottom)) {
          el.scrollTop += r.top - view.top - (view.height - r.height) / 2;
          r = thumb.getBoundingClientRect();
        }
        const to = { left: r.left, top: r.top, width: r.width, height: r.height };
        setGlide((g) => (g && g.dir === 'close' ? { ...g, to } : g));
      });
    });
  }, [items]);

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

  const overlay =
    glide &&
    createPortal(
      // The travelling image. Portalled to <body> so the panel's scroll box
      // and clip can't cut it off mid-flight. object-cover in a box that
      // morphs between the tile's square and the piece's own shape, so it
      // opens out from the tile's crop (and folds back into it on close).
      <motion.img
        key={`${glide.dir}-${glide.index}`}
        src={glide.src}
        alt=""
        aria-hidden
        className="pointer-events-none fixed z-[45] object-cover"
        style={{ position: 'fixed' }}
        initial={{ ...glide.from, opacity: 1 }}
        animate={{ ...(glide.to ?? glide.from), opacity: glide.phase === 'fade' ? 0 : 1 }}
        transition={{
          default: { duration: glide.dir === 'close' ? GLIDE_S * 0.85 : GLIDE_S, ease: GLIDE_EASE },
          opacity: { duration: 0.25 },
        }}
        onAnimationComplete={() => {
          if (glide.phase === 'fade') setGlide(null);
          else if (!glide.to) return;
          else if (glide.dir === 'open') landed();
          // Back in the tile: the tile's own image is right underneath.
          else setGlide((g) => (g ? { ...g, phase: 'fade' } : g));
        }}
      />,
      document.body,
    );

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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: glide?.dir === 'open' ? 0.25 : 0 }}
          className="flex items-center justify-between border-b border-black/10 pb-3"
        >
          <button
            onClick={close}
            className="-my-2 py-2 pr-3 font-mono text-[10px] uppercase tracking-[0.2em] text-black/50 transition-colors hover:text-black cursor-pointer"
          >
            ‹ back
          </button>
          <span aria-live="polite" className="font-mono text-[10px] tabular-nums tracking-[0.2em] text-black/45">
            {num(open)} / {num(count - 1)}
          </span>
        </motion.div>

        {/* The frame keeps one size for every piece, so stepping through
            mixed shapes doesn't make the controls jump around. */}
        <motion.div
          ref={frameRef}
          className="relative mt-5 h-[62dvh] w-full touch-pan-y sm:h-[calc(100dvh-17rem)]"
          // Hidden while the thumbnail glides in over it; revealed as it lands.
          initial={{ opacity: glide?.dir === 'open' ? 0 : 1 }}
          animate={{ opacity: glide?.dir === 'open' && glide.phase === 'fly' ? 0 : 1 }}
          transition={{ duration: 0.2 }}
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
            // The glide brings the first piece in; the pixel transition is
            // for stepping between pieces.
            intro={false}
            sizes="(min-width: 640px) 50vw, 100vw"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: glide?.dir === 'open' ? 0.3 : 0 }}
          className="mt-5 flex items-center justify-between gap-3 border-t border-black/10 pt-2"
        >
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
        </motion.div>

        {overlay}
      </div>
    );
  }

  // -------------------------------------------------------------------- grid
  return (
    <motion.div
      ref={root}
      className="@container w-full"
      // Coming back from the viewer: the grid settles in rather than snapping.
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Two columns at every width: the pieces are the point, so they stay big. */}
      <div className="grid grid-cols-2 gap-5 @sm:gap-6">
        {items.map((item, i) => {
          const chosen = selecting === i;
          return (
          <button
            key={item.id}
            onClick={() => show(i)}
            aria-label={`Open ${item.title}`}
            className={`group relative block text-left cursor-pointer transition-opacity duration-300 ${
              selecting !== null && !chosen ? 'opacity-40' : ''
            }`}
          >
            {/* Selected: the MGMT roster's corner brackets and white flash. */}
            {chosen && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute -inset-[4px] z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12 }}
              >
                <span className="absolute left-0 top-0 h-2.5 w-2.5 border-l border-t border-black/80" />
                <span className="absolute right-0 top-0 h-2.5 w-2.5 border-r border-t border-black/80" />
                <span className="absolute bottom-0 left-0 h-2.5 w-2.5 border-b border-l border-black/80" />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 border-b border-r border-black/80" />
              </motion.span>
            )}
            <div
              data-gal-thumb={i}
              className="relative aspect-square overflow-hidden border border-black/15 bg-black/[0.03]"
            >
              {/* While a closing piece glides back into this tile, its own
                  image waits underneath, revealed as the glide fades off. */}
              <div
                className={`absolute inset-0 transition-opacity duration-200 ${
                  glide?.dir === 'close' && glide.index === i && glide.phase === 'fly' ? 'opacity-0' : ''
                }`}
              >
              <Image
                src={item.src}
                alt=""
                fill
                sizes="(min-width: 640px) 24vw, 45vw"
                className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
              </div>
              {chosen && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 bg-white"
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              )}
            </div>
            {/* Caption with the catalog's hover wipe. */}
            <div className="relative mt-2 font-mono">
              <Caption index={i} title={item.title} />
              <div
                aria-hidden
                // Hover wipes the bar in; selecting holds it there (on touch,
                // where there's no hover, this is where it first appears).
                className={`ui-wipe absolute inset-0 bg-black/80 transition-[clip-path] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:duration-300 group-hover:[clip-path:inset(0_0_0_0)] group-focus-visible:[clip-path:inset(0_0_0_0)] ${
                  chosen ? '[clip-path:inset(0_0_0_0)] duration-300' : '[clip-path:inset(0_100%_0_0)]'
                }`}
              >
                <Caption index={i} title={item.title} inverted />
              </div>
            </div>
          </button>
          );
        })}
      </div>
      {overlay}
    </motion.div>
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

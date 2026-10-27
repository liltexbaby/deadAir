'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

/*
 * Artist portrait that changes the way the tower loads in: the old picture
 * breaks up into growing blocks while its cells blink out, then the new one
 * resolves down from chunky blocks as scattered cells arrive. Short, so
 * flicking through the roster stays snappy.
 *
 * Drawn on a 2D canvas laid over the real <Image>, which is hidden only while
 * a transition runs; at rest it's the plain image.
 */
const OUT_MS = 150;
const IN_MS = 340;
const MAX_BLOCK = 16;   // CSS px per block at the most broken-up frame
const CELL = 8;         // dissolve cell, CSS px
const FLICKER = 0.12;   // cells this close to arriving flicker on/off

// Shared scratch canvas for the low-resolution pass.
let scratch: HTMLCanvasElement | null = null;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function PixelPortrait({
  src,
  sizes,
  active = true,
  fit = 'cover',
  pixelated = true,
  alt = '',
  intro = true,
}: {
  src: string;
  sizes: string;
  /** Phone carousel: only the slide in view animates; leaving it plays the out half. */
  active?: boolean;
  /** 'contain' shows the whole image (GALLERY's mixed shapes); portraits crop. */
  fit?: 'cover' | 'contain';
  /** Nearest-neighbour scaling at rest — right for pixel-art portraits only. */
  pixelated?: boolean;
  alt?: string;
  /** False: the first image just appears (something else animated it in). */
  intro?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  // The last picture shown, kept so it can be broken up when it's replaced.
  const snapshot = useRef<{ src: string; image: HTMLCanvasElement } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const alive = () => !cancelled;
    const c = canvas.current;
    const box = frame.current;
    const img = box?.querySelector('img') ?? null;
    if (!c || !box || !img) return;

    const show = (on: boolean) => {
      img.style.opacity = on ? '1' : '0';
      c.style.visibility = on ? 'hidden' : 'visible';
    };

    if (reducedMotion()) {
      show(true);
      return;
    }

    const prev = snapshot.current;
    const leaving = prev !== null && (prev.src !== src || !active);
    if (!active && !leaving) {
      // Off-screen slide with nothing to break up: just show it, so it's
      // there when a swipe drags it into view.
      clear(c);
      show(true);
      return;
    }

    show(false);
    (async () => {
      if (leaving && prev) {
        await animate(c, prev.image, OUT_MS, 'out', alive, fit);
        if (!alive()) return;
      }
      if (!active) {
        // Off-screen slide: leave the plain image ready for the next swipe.
        clear(c);
        show(true);
        snapshot.current = null;
        return;
      }
      const raw = await whenLoaded(img, alive);
      if (!alive()) return;
      if (!raw) {
        show(true);
        return;
      }
      // Skipped for the very first image when the caller brings it in itself.
      if (intro || prev !== null) await animate(c, raw, IN_MS, 'in', alive, fit);
      if (!alive()) return;
      snapshot.current = { src, image: capture(raw) };
      clear(c);
      show(true);
    })();

    return () => {
      // A newer change takes over mid-animation; it starts from whatever was
      // last fully shown.
      cancelled = true;
    };
  }, [src, active, fit, intro]);

  return (
    <div ref={frame} className="absolute inset-0">
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        draggable={false}
        className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} ${
          // Pixel art: keep the edges hard when scaled up.
          pixelated ? '[image-rendering:pixelated]' : ''
        }`}
        style={{ opacity: 0 }}
      />
      <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}

/**
 * Once the <img> has loaded, the file it picked, decoded on its own (null on
 * timeout). Not the <img> itself: with a srcset its naturalWidth is corrected
 * for density (a 640px file chosen for a 432px slot reports 432), while
 * drawImage crops in the file's real pixels — drawing it directly zoomed in.
 */
function whenLoaded(img: HTMLImageElement, alive: () => boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const start = performance.now();
    const check = () => {
      if (!alive()) return resolve(null);
      if (img.complete && img.naturalWidth > 0 && img.currentSrc) {
        const raw = new window.Image();   // not next/image's Image
        raw.src = img.currentSrc;   // already in the cache
        raw.decode().then(() => resolve(raw), () => resolve(null));
        return;
      }
      if (performance.now() - start > 4000) return resolve(null);
      requestAnimationFrame(check);
    };
    // One frame first: next/image swaps the src attribute after this commit.
    requestAnimationFrame(check);
  });
}

function capture(img: HTMLImageElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = img.naturalWidth;
  out.height = img.naturalHeight;
  // Explicit size: the whole image into the canvas, whatever unit
  // naturalWidth turned out to be in.
  out.getContext('2d')?.drawImage(img, 0, 0, out.width, out.height);
  return out;
}

function clear(c: HTMLCanvasElement) {
  c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
}

function sourceSize(s: HTMLImageElement | HTMLCanvasElement): [number, number] {
  return s instanceof HTMLImageElement ? [s.naturalWidth, s.naturalHeight] : [s.width, s.height];
}

/**
 * One half of the transition. 'out' breaks the picture up (blocks grow, cells
 * vanish); 'in' does the reverse, with cells near arrival flickering.
 */
function animate(
  c: HTMLCanvasElement,
  source: HTMLImageElement | HTMLCanvasElement,
  ms: number,
  dir: 'in' | 'out',
  alive: () => boolean,
  fit: 'cover' | 'contain',
): Promise<void> {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(c.clientWidth * dpr));
  const h = Math.max(1, Math.round(c.clientHeight * dpr));
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  const ctx = c.getContext('2d');
  scratch ??= document.createElement('canvas');
  const sctx = scratch.getContext('2d');
  if (!ctx || !sctx) return Promise.resolve();

  const cell = CELL * dpr;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  // Fresh order every time, so no two transitions dissolve alike.
  const order = Float32Array.from({ length: cols * rows }, () => Math.random());

  // Only the source's aspect ratio is used, never its pixel size: browsers
  // disagree about an image's "natural" size (srcset density correction —
  // iOS Safari still zoomed in when cropping by it), but the shape is the
  // same in every unit.
  const [sw, sh] = sourceSize(source);
  const aspect = sw > 0 && sh > 0 ? sw / sh : 1;

  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = () => {
      if (!alive()) return resolve();
      const t = Math.min((performance.now() - t0) / ms, 1);
      // 0 = whole and sharp, 1 = fully broken up.
      const broken = dir === 'out' ? t : 1 - (1 - Math.pow(1 - t, 3));

      // Pixelate: draw small, then scale up without smoothing. Geometric so
      // each step changes block size by the same ratio.
      const block = Math.max(1, Math.round(Math.pow(MAX_BLOCK, broken) * dpr));
      const bw = Math.max(1, Math.ceil(w / block));
      const bh = Math.max(1, Math.ceil(h / block));
      scratch!.width = bw;
      scratch!.height = bh;
      sctx.imageSmoothingEnabled = true;
      sctx.clearRect(0, 0, bw, bh);
      // Matching the <Image> underneath, centred either way. cover: scaled
      // to fill, overflow cut off by the canvas. contain: scaled to fit, the
      // whole image inside the frame.
      let dw = bw;
      let dh = bw / aspect;
      if (fit === 'cover' ? dh < bh : dh > bh) {
        dh = bh;
        dw = bh * aspect;
      }
      sctx.drawImage(source, (bw - dw) / 2, (bh - dh) / 2, dw, dh);
      ctx.clearRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(scratch!, 0, 0, bw, bh, 0, 0, bw * block, bh * block);

      // Dissolve: erase the cells that haven't arrived (or have already gone).
      const reach = (1 - broken) * (1 + FLICKER);
      for (let i = 0; i < order.length; i++) {
        const lead = reach - order[i];
        const on = lead > FLICKER ? true : lead > 0 ? Math.random() < 0.5 + 0.5 * (lead / FLICKER) : false;
        if (!on) ctx.clearRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
      }

      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

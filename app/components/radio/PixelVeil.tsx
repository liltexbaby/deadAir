'use client';

import { useEffect, useRef } from 'react';

/*
 * The radio's change between shows, after the MGMT / PUBLISHING portraits
 * (panels/PixelPortrait.tsx): scattered cells blink in over the outgoing
 * player, then blink back out of the new one, the ones about to land
 * flickering. Same cell size, timings and flicker as the portraits.
 *
 * The player is a cross-origin iframe, so its pixels can't be broken up
 * themselves; the cells are the slot's own background laid over it. Fully
 * covered is just the empty slot — a pixel fade out to the background and a
 * pixel fade back in, with no half-broken picture held while the next show
 * loads.
 */
const OUT_MS = 220;
const IN_MS = 340;
const CELL = 8;         // CSS px
const FLICKER = 0.12;   // cells this close to arriving flicker on/off
// The empty slot's tone: the radio's paper with the slot's faint tint.
const BACKGROUND = '#ebe8e2';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function PixelVeil({ covered }: { covered: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // How much is covered right now (0..1), so a reversal mid-way picks up
  // from where it is rather than jumping.
  const coverage = useRef(covered ? 1 : 0);

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(c.clientWidth * dpr));
    const h = Math.max(1, Math.round(c.clientHeight * dpr));
    c.width = w;
    c.height = h;
    const cell = CELL * dpr;
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    // Fresh order every time, so no two changes dissolve alike.
    const order = Float32Array.from({ length: cols * rows }, () => Math.random());

    const draw = (amount: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BACKGROUND;
      const reach = amount * (1 + FLICKER);
      for (let i = 0; i < order.length; i++) {
        const lead = reach - order[i];
        const on = lead > FLICKER ? true : lead > 0 ? Math.random() < 0.5 + 0.5 * (lead / FLICKER) : false;
        if (!on) continue;
        ctx.fillRect((i % cols) * cell, Math.floor(i / cols) * cell, cell, cell);
      }
    };

    const from = coverage.current;
    const to = covered ? 1 : 0;
    if (from === to || reducedMotion()) {
      coverage.current = to;
      draw(to);
      return;
    }

    let raf = 0;
    const ms = (covered ? OUT_MS : IN_MS) * Math.abs(to - from);
    const t0 = performance.now();
    const step = () => {
      const t = Math.min((performance.now() - t0) / ms, 1);
      // Out at an even pace; in eases off, like the portraits resolving.
      const e = covered ? t : 1 - Math.pow(1 - t, 3);
      coverage.current = from + (to - from) * e;
      draw(coverage.current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [covered]);

  return <canvas ref={canvas} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}

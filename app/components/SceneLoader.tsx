'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { useCoarsePointer } from '@/lib/useCoarsePointer';

const SEGMENTS = 20;

/**
 * Boot readout, shown until the interface comes online (SiteShell's `booted`).
 *
 * The GLB is several MB, so on a cold visit there are seconds with nothing to
 * show. Rather than a loading bar floating over an otherwise finished page,
 * this is the only thing on screen — the logo and nav are held back too — and
 * reads like a system starting up: a label, a segmented meter and a count.
 * When it goes, everything else assembles at once (see SiteShell / Navigation
 * / ModelViewer's PixelReveal).
 *
 * Lives in the DOM rather than inside the Canvas (drei's <Html>) so it paints
 * before any WebGL context exists.
 *
 * Once everything's loaded (`ready`) it waits for the visitor: "tap to
 * receive". That tap is what boots the site — and, being a gesture, it's what
 * lets the boot-up sound and drone play (browsers allow no audio before one).
 * Anywhere on the screen, or Enter / Space.
 */
export default function SceneLoader({
  done,
  ready,
  onEnter,
}: {
  done: boolean;
  ready: boolean;
  onEnter: () => void;
}) {
  const { progress } = useProgress();
  const coarse = useCoarsePointer();
  // Ready can arrive by the fallback timer with the model still loading.
  const pct = ready ? Math.max(Math.round(progress), 100) : Math.round(progress);
  const lit = Math.round((pct / 100) * SEGMENTS);
  const waiting = ready && !done;
  // How much of the message has typed out: 0 title, 1 + line, 2 all in.
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    if (!waiting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onEnter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [waiting, onEnter]);

  return (
    <AnimatePresence>
      {!done && (
        <motion.div
          key="boot"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Flickers out rather than fading, like a readout cutting over.
          exit={{ opacity: [1, 0.2, 0.7, 0], transition: { duration: 0.35, times: [0, 0.3, 0.55, 1] } }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className={`fixed inset-0 z-40 flex items-center justify-center ${
            waiting ? 'cursor-pointer' : 'pointer-events-none'
          }`}
          role={waiting ? 'button' : 'status'}
          aria-label={waiting ? 'Receive the transmission' : `Loading, ${pct}%`}
          onClick={waiting ? onEnter : undefined}
        >
          <AnimatePresence mode="wait">
            {waiting ? (
              // Ready: a message from the label — its logo, what's coming in
              // (typed out), then the action. A see-through box, roomy inside.
              // Size, padding and edge are inline so it's the same box on any
              // screen even if a stylesheet arrives late or stale.
              <motion.div
                key="note"
                // Fades up gently rather than popping in.
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
                className="ui-surface backdrop-blur-md"
                style={{
                  position: 'relative',
                  width: 320,
                  maxWidth: 'calc(100vw - 2rem)',
                  padding: 20,
                  border: '1px solid rgba(0,0,0,0.15)',
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  boxSizing: 'border-box',
                }}
              >
                {/* Alert mark on the corner: a black square with a "!". */}
                <span
                  aria-hidden
                  className="flex items-center justify-center font-mono font-bold text-white"
                  style={{
                    position: 'absolute',
                    top: -9,
                    right: -9,
                    width: 18,
                    height: 18,
                    fontSize: 11,
                    lineHeight: 1,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                  }}
                >
                  !
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {/* The logo as it sits in the header: dark ink, no tile. */}
                  <Image
                    src="/dA.png"
                    alt="deadAir"
                    width={56}
                    height={55}
                    className="invert opacity-90"
                    style={{ width: 44, height: 'auto', flexShrink: 0 }}
                  />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <h3 className="text-sm leading-tight text-black/90">
                      <TypeOut text="Incoming transmission" onDone={() => setTyped(1)} />
                    </h3>
                    <span className="mt-1.5 block font-mono text-[11px] leading-snug text-black/55">
                      <TypeOut text="A signal from deadAir Records is incoming." speed={16} start={typed >= 1} onDone={() => setTyped(2)} />
                    </span>
                  </span>
                </div>
                {/* The action, once the message is in: fades in once, then the
                    site's dark bar breathes — back and forth, never restarting
                    from blank, so it doesn't stutter. */}
                <motion.span
                  className="block"
                  style={{ marginTop: 20 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: typed >= 2 ? 1 : 0 }}
                  transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <motion.span
                    className="ui-wipe block bg-black/80 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-white"
                    style={{ paddingTop: 10, paddingBottom: 10 }}
                    animate={{ opacity: 0.7 }}
                    initial={{ opacity: 1 }}
                    transition={{ duration: 1.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: 1.1 }}
                  >
                    [ {coarse ? 'tap' : 'click'} to receive ]
                  </motion.span>
                </motion.span>
              </motion.div>
            ) : (
              <motion.div
                key="load"
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="flex flex-col gap-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-black/55"
              >
                <span>detecting transmission..</span>
                <div className="flex gap-0.75" aria-hidden>
                  {Array.from({ length: SEGMENTS }, (_, i) => (
                    <span
                      key={i}
                      className={`h-2 w-1.5 transition-colors duration-150 ${i < lit ? 'bg-black/70' : 'bg-black/10'}`}
                    />
                  ))}
                </div>
                <span className="tabular-nums text-black/40">
                  {String(pct).padStart(3, '0')}%
                  <span className="ml-1 inline-block animate-pulse text-black/60">▮</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const TYPE_MS = 38;   // per character, unless a TypeOut sets its own speed
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Text typing itself out, with a block cursor while it goes. The untyped rest
 * is laid out invisibly, so the box is its final size from the start and
 * nothing reflows as the letters arrive.
 */
function TypeOut({
  text,
  start = true,
  speed = TYPE_MS,
  onDone,
}: {
  text: string;
  start?: boolean;
  /** ms per character */
  speed?: number;
  onDone?: () => void;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (reducedMotion()) {
      const t = setTimeout(() => {
        setN(text.length);
        onDone?.();
      }, 0);
      return () => clearTimeout(t);
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) {
        clearInterval(id);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(id);
    // onDone is a fresh arrow each render; the typing only depends on these.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, text, speed]);

  const typing = start && n < text.length;
  return (
    <>
      {text.slice(0, n)}
      {typing && <span aria-hidden className="inline-block w-[0.5em] -mb-px bg-current opacity-60" style={{ height: '0.9em' }} />}
      <span aria-hidden style={{ visibility: 'hidden' }}>{text.slice(n)}</span>
    </>
  );
}

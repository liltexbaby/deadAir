'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

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
  // Ready can arrive by the fallback timer with the model still loading.
  const pct = ready ? Math.max(Math.round(progress), 100) : Math.round(progress);
  const lit = Math.round((pct / 100) * SEGMENTS);
  const waiting = ready && !done;


  return (
    <AnimatePresence>
      {!done && !ready && (
        <motion.div
          key="load"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          // Flickers out rather than fading, like a readout cutting over.
          exit={{ opacity: [1, 0.2, 0.7, 0], transition: { duration: 0.35, times: [0, 0.3, 0.55, 1] } }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          role="status"
          aria-label={`Loading, ${pct}%`}
        >
          <div className="flex flex-col gap-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-black/55">
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
          </div>
        </motion.div>
      )}
      {waiting && <Gate key="gate" onEnter={onEnter} />}
    </AnimatePresence>
  );
}

/**
 * Ready: the label's logo and TUNE IN?, side by side in a see-through box,
 * fading in gently and out once tapped. Size, padding and edge are inline so
 * it's the same box on any screen even if a stylesheet is stale.
 */
function Gate({ onEnter }: { onEnter: () => void }) {
  const [used, setUsed] = useState(false);
  const go = () => {
    if (used) return;
    setUsed(true);
    onEnter();
  };
  // Enter / Space tune in too.
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      goRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <motion.div
      className={`fixed inset-0 z-40 flex items-center justify-center ${used ? 'pointer-events-none' : 'cursor-pointer'}`}
      role="button"
      aria-label="Tune in"
      onClick={go}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.4, ease: 'easeOut' } }}
      transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div
        className="ui-surface backdrop-blur-md"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: 20,
          border: '1px solid rgba(0,0,0,0.15)',
          backgroundColor: 'rgba(255,255,255,0.25)',
          boxSizing: 'border-box',
        }}
      >
        {/* The logo as it sits in the header: dark ink, no tile. */}
        <Image
          src="/dA.png"
          alt="deadAir"
          width={56}
          height={55}
          className="invert opacity-90"
          style={{ width: 44, height: 'auto', flexShrink: 0 }}
        />
        {/* The site's dark bar, breathing back and forth (never from blank). */}
        <motion.span
          // The typewriter face of the site's headings (Love Letter).
          className="ui-wipe block bg-black/80 text-center text-white"
          style={{
            padding: '10px 22px',
            fontFamily: 'var(--font-heading), var(--font-ui), monospace',
            fontSize: 15,
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap',
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0.7 }}
          transition={{ duration: 1.6, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: 1.1 }}
        >
          TUNE IN?
        </motion.span>
      </div>
    </motion.div>
  );
}

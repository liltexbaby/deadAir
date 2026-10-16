'use client';

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
 */
export default function SceneLoader({ done }: { done: boolean }) {
  const { progress } = useProgress();
  const pct = Math.round(progress);
  const lit = Math.round((progress / 100) * SEGMENTS);

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
          className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
          role="status"
          aria-label={`Loading, ${pct}%`}
        >
          <div className="flex flex-col gap-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-black/55">
            <span>
              deadAir <span className="text-black/25">{'//'}</span> signal
            </span>
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
    </AnimatePresence>
  );
}

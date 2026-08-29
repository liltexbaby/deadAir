'use client';

import { useProgress } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Load indicator for the tower.
 *
 * The GLB is ~15MB, so without this the canvas is simply blank for several
 * seconds on a cold visit — worst on the cellular connections this was hardest
 * on. Lives in the DOM rather than inside the Canvas (drei's <Html>) so it can
 * paint before any WebGL context exists.
 */
export default function SceneLoader() {
  const { active, progress } = useProgress();

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="fixed inset-0 z-40 flex items-end justify-center pb-[18vh] pointer-events-none"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-px w-32 sm:w-40 bg-white/15 overflow-hidden">
              <motion.div
                className="h-full bg-white/70"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'easeOut', duration: 0.3 }}
              />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/40 tabular-nums">
              {Math.round(progress)}%
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

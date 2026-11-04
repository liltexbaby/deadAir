'use client';

import { useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { isMuted, setMuted, subscribeMuted } from '@/lib/sound';

const notMuted = () => false;

/**
 * Sound on / off, top right. Mutes everything the site plays itself (UI
 * sounds, boot-up, drone); remembered on this device. Hidden while a section
 * panel is open, whose header owns that corner.
 */
export default function SoundToggle({ visible }: { visible: boolean }) {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, notMuted);

  return (
    <motion.button
      onClick={() => setMuted(!muted)}
      data-sfx="hover-only"
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      className="fixed right-3 z-50 flex items-center gap-2 px-2 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-black/50 transition-colors hover:text-black cursor-pointer sm:right-6"
      // Inline, like the radio notice: a fixed box must never lose its offset.
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 1.25rem)', pointerEvents: visible ? 'auto' : 'none' }}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.3, delay: visible ? 0.9 : 0 }}
      tabIndex={visible ? 0 : -1}
    >
      {/* Five bars: moving while sound is on, flat when it's off. */}
      <span className="flex h-2.5 items-end gap-px" aria-hidden>
        {[4, 7, 10, 7, 4].map((h, i) => (
          <motion.span
            key={i}
            style={{ width: 2, height: h, backgroundColor: 'currentColor' }}
            animate={muted ? { scaleY: 0.25 } : { scaleY: [0.4, 1, 0.4] }}
            transition={
              muted ? { duration: 0.2 } : { duration: 1.2, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }
            }
            className="origin-bottom"
          />
        ))}
      </span>
      {muted ? 'sound off' : 'sound on'}
    </motion.button>
  );
}

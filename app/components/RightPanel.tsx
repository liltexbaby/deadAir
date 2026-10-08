'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { ReactNode } from 'react';

interface RightPanelProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** dA logo in the header — resets the whole page (see SiteShell). */
  onReset: () => void;
}

export default function RightPanel({ isOpen, title, children, onClose, onReset }: RightPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Opaque backdrop for the status-bar strip only.
              `backdrop-filter` samples whatever is painted BELOW the panel, so
              behind the notch it was blurring the live canvas — the beacon
              pulsing and spotlights sweeping made that strip visibly shift
              colour under iOS's own clock and battery.
              Slipping an opaque page-coloured layer between the canvas (z-10)
              and the panel (z-40) makes the backdrop constant in just that
              band: blurring a solid colour returns that solid colour. The panel
              keeps its translucency and blur everywhere else.
              Height is TWICE the inset, not the inset itself. A 24px backdrop
              blur samples well past its own edge, so a strip that stopped
              exactly at the notch bled scene colour back up into the status bar
              (measured: red probe 76 -> 14 at inset+0, but -> 3 by inset+48).
              Doubling clears the blur's reach on any notched device and, since
              it is a multiple of the inset, collapses to zero on desktop and on
              phones without a notch — no breakpoint needed.

              It rides the same slide as the panel so no solid bar appears
              mid-transition. */}
          <motion.div
            aria-hidden
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
            className="pointer-events-none fixed top-0 right-0 w-full sm:w-1/2 z-30 bg-[#cccccf] h-[calc(env(safe-area-inset-top,0px)*2)]"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
            // Full-width sheet on phones: at 375px a half-width panel left ~123px
            // of usable content, narrower than a single email address.
            // h-dvh (not h-screen) so the bottom isn't buried under browser chrome.
            // No left border on mobile: as a full-width sheet there is nothing
            // to its left, so it reads as a stray 1px line down the edge.
            className="fixed top-0 right-0 w-full sm:w-1/2 h-dvh bg-white/70 sm:bg-white/40 backdrop-blur-xl sm:border-l sm:border-black/15 z-40 flex flex-col"
          >
          {/* Header height is now measured by the flex column rather than
              hardcoded — the old calc(100vh-72px) was already ~15px wrong. */}
          {/* Flex row rather than an absolutely-centred button. The close
              control used to be `top-1/2 -translate-y-1/2`, which centres it in
              the header box *including* the safe-area padding — while the title
              sits in normal flow below that padding. The taller the inset, the
              further apart they drifted, which is why they looked misaligned on
              a notched phone and fine on desktop. Centring both in the same row
              makes the inset irrelevant. */}
          <div className="shrink-0 flex items-center justify-between gap-4 px-5 sm:px-8 pb-4 sm:pb-5 pt-[calc(env(safe-area-inset-top,0px)+1.9rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] border-b border-black/10">
            <div className="flex items-center gap-4">
              {/* The page header (and its logo) is hidden behind the full-screen
                  phone sheet, so the logo's reset lives here too — "clicking
                  the dA logo always resets the page". */}
              <button onClick={onReset} aria-label="deadAir — back to start" className="-m-1 p-1 cursor-pointer">
                <Image src="/dA.png" alt="" width={56} height={55} className="w-6 h-auto opacity-80 invert" />
              </button>
              <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-black/90">
                {title}
              </h2>
            </div>

            <button
              onClick={onClose}
              aria-label="Close panel"
              // Negative margins keep the ~44px tap target without letting its
              // padding inflate the header's height or push it off the edge.
              className="-my-3 -mr-3 shrink-0 p-3 font-mono text-[10px] uppercase tracking-[0.2em] text-black/45 hover:text-black/90 pointer-coarse:text-black/70 transition-colors cursor-pointer"
            >
              {/* The key doesn't exist on a phone, so don't advertise it there. */}
              <span className="hidden sm:inline">[esc] </span>close
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 sm:px-8 pt-5 sm:pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
            {children}
          </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

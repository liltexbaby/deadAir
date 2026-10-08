'use client';

import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import Image from 'next/image';
import { ReactNode, useState } from 'react';

interface RightPanelProps {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  /** dA logo in the header — resets the whole page (see SiteShell). */
  onReset: () => void;
}

/*
 * NieR-style reveal, in two beats:
 *   1. the header bar slides in from the right on its own;
 *   2. the body unrolls downward beneath it, led by a scan line, and the
 *      content flickers on once it's open.
 * Closing plays it backwards (body rolls up, then the bar slides out).
 *
 * Switching section while open swaps the body under its own AnimatePresence
 * (keyed by title): the old body rolls up and the new one unrolls straight
 * away — the header-first delay only applies when the whole panel opens.
 */
const OPEN_EASE = [0.16, 1, 0.3, 1] as const;     // fast out, long settle
const UNROLL_EASE = [0.7, 0, 0.2, 1] as const;    // hesitate, then drop
const CLOSE_EASE = [0.5, 0, 0.9, 0.5] as const;
const UNROLL_S = 0.5;

const HEADER_LEAD_S = 0.3;   // body waits this long for the header on open

// Body wrapper: holds its children back until the header is in (first open only).
const bodyVariants: Variants = {
  open: (delay: number) => ({ transition: { delayChildren: delay } }),
  closed: {},
};

const headerVariants: Variants = {
  open: { x: 0, transition: { duration: 0.32, ease: OPEN_EASE } },
  // Delayed so the body rolls up first, then the bar leaves.
  closed: { x: '100%', transition: { delay: 0.2, duration: 0.24, ease: CLOSE_EASE } },
};

const bodyClipVariants: Variants = {
  open: { clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: UNROLL_S, ease: UNROLL_EASE } },
  closed: { clipPath: 'inset(0% 0% 100% 0%)', transition: { duration: 0.26, ease: CLOSE_EASE } },
};

// Rides the leading edge of the unroll, then fades once the body is down.
const scanVariants: Variants = {
  open: {
    top: ['0%', '100%', '100%'],
    opacity: [1, 1, 0],
    transition: { duration: UNROLL_S + 0.2, times: [0, UNROLL_S / (UNROLL_S + 0.2), 1], ease: UNROLL_EASE },
  },
  closed: { opacity: 0, transition: { duration: 0 } },
};

// A couple of quick dips before settling — the CRT-ish flicker NieR menus do.
const contentVariants: Variants = {
  open: {
    opacity: [0, 0.7, 0.15, 1],
    transition: { delay: UNROLL_S * 0.7, duration: 0.3, times: [0, 0.35, 0.55, 1] },
  },
  closed: { opacity: 0, transition: { duration: 0.1 } },
};

// prefers-reduced-motion: no sliding or unrolling, just a short fade.
const fade: Variants = {
  open: { opacity: 1, transition: { duration: 0.15 } },
  closed: { opacity: 0, transition: { duration: 0.15 } },
};

const SURFACE = 'bg-white/70 sm:bg-white/40 backdrop-blur-xl sm:border-l sm:border-black/15';

export default function RightPanel({ isOpen, title, children, onClose, onReset }: RightPanelProps) {
  const reduce = useReducedMotion();
  const header = reduce ? fade : headerVariants;
  const bodyClip = reduce ? fade : bodyClipVariants;
  const content = reduce ? fade : contentVariants;
  // True once the panel has finished opening, false again once it has closed:
  // a body mounted after that (a section switch) needn't wait for the header.
  const [settled, setSettled] = useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        /* Opaque backdrop for the status-bar strip only.
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

           It rides the header's slide so no solid bar appears mid-transition. */
        <motion.div
          key="status-strip"
          aria-hidden
          variants={header}
          initial="closed"
          animate="open"
          exit="closed"
          className="pointer-events-none fixed top-0 right-0 w-full sm:w-1/2 z-30 bg-[#cccccf] h-[calc(env(safe-area-inset-top,0px)*2)]"
        />
      )}

      {isOpen && (
        <motion.div
          key="panel"
          initial="closed"
          animate="open"
          exit="closed"
          onAnimationComplete={(def) => setSettled(def === 'open')}
          // Full-width sheet on phones: at 375px a half-width panel left ~123px
          // of usable content, narrower than a single email address.
          // h-dvh (not h-screen) so the bottom isn't buried under browser chrome.
          // The surface (tint, blur, left border) lives on the header and body
          // separately so each appears with its own beat; no left border on
          // mobile, where there's nothing to its left.
          className="fixed top-0 right-0 w-full sm:w-1/2 h-dvh z-40 flex flex-col"
        >
          {/* Flex row rather than an absolutely-centred button. The close
              control used to be `top-1/2 -translate-y-1/2`, which centres it in
              the header box *including* the safe-area padding — while the title
              sits in normal flow below that padding. The taller the inset, the
              further apart they drifted, which is why they looked misaligned on
              a notched phone and fine on desktop. Centring both in the same row
              makes the inset irrelevant. */}
          <motion.div
            variants={header}
            className={`${SURFACE} shrink-0 flex items-center justify-between gap-4 px-5 sm:px-8 pb-4 sm:pb-5 pt-[calc(env(safe-area-inset-top,0px)+1.9rem)] sm:pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] border-b border-black/10`}
          >
            <div className="flex items-center gap-4">
              {/* The page header (and its logo) is hidden behind the full-screen
                  phone sheet, so the logo's reset lives here too — "clicking
                  the dA logo always resets the page". */}
              <button onClick={onReset} aria-label="deadAir — back to start" className="-m-1 p-1 cursor-pointer">
                <Image src="/dA.png" alt="" width={56} height={55} className="w-6 h-auto opacity-80 invert" />
              </button>
              {/* Keyed so a section change re-runs the flicker on the new name. */}
              <motion.h2
                key={title}
                initial={{ opacity: 0 }}
                animate={{ opacity: reduce ? 1 : [0, 1, 0.25, 1] }}
                transition={{ delay: reduce ? 0 : 0.12, duration: reduce ? 0.15 : 0.3, times: reduce ? undefined : [0, 0.3, 0.5, 1] }}
                className="font-mono text-xs uppercase tracking-[0.25em] text-black/90"
              >
                {title}
              </motion.h2>
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
          </motion.div>

          <div className="relative flex-1 min-h-0">
            {/* propagate: closing the panel rolls the body up too. */}
            <AnimatePresence mode="wait" propagate>
              {/* No values of its own: the presence boundary for a section swap,
                  passing open/closed on to the clip, scan line and content. */}
              <motion.div
                key={title}
                variants={bodyVariants}
                custom={settled || reduce ? 0 : HEADER_LEAD_S}
                initial="closed"
                animate="open"
                exit="closed"
                className="absolute inset-0"
              >
                <motion.div
                  variants={bodyClip}
                  className={`${SURFACE} absolute inset-0 overflow-y-auto overscroll-contain px-5 sm:px-8 pt-5 sm:pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]`}
                >
                  <motion.div variants={content} className="h-full">
                    {children}
                  </motion.div>
                </motion.div>
                {!reduce && (
                  <motion.span
                    aria-hidden
                    variants={scanVariants}
                    className="pointer-events-none absolute inset-x-0 h-px bg-black/60 shadow-[0_0_6px_1px_rgba(0,0,0,0.25)]"
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

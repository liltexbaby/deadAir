'use client';

import { useEffect, useState } from 'react';

/**
 * True on touch-first devices.
 *
 * Starts false so server and first client render agree — flipping it in an
 * effect avoids a hydration mismatch. Anything gated on this must therefore
 * degrade gracefully for one frame.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    setCoarse(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return coarse;
}

/** Matches Tailwind's `sm` breakpoint (640px) so CSS and JS agree. */
export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    setNarrow(mq.matches);

    const onChange = (e: MediaQueryListEvent) => setNarrow(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return narrow;
}

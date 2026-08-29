'use client';

import { useSyncExternalStore } from 'react';

/**
 * Media queries as a shared external store.
 *
 * These were `useState` + `useEffect` that called `setState` in the effect body.
 * That is one MediaQueryList, one listener and one extra render pass *per
 * component instance* — and CatalogGrid mounts 25 AlbumCards at once, each of
 * which calls useCoarsePointer. Opening the catalog therefore created 25
 * matchMedia objects and 25 cascading re-renders of framer-motion components in
 * a single commit, right as the panel finished sliding in.
 *
 * useSyncExternalStore shares one MediaQueryList per query across every
 * consumer, and reads the value during render rather than after mount — so
 * there is no post-mount state flip to re-render for. The server snapshot is
 * `false`, matching the old starting value, so SSR output is unchanged and
 * there is still nothing for hydration to mismatch on.
 */
const lists = new Map<string, MediaQueryList>();

function list(query: string): MediaQueryList {
  let mql = lists.get(query);
  if (!mql) {
    mql = window.matchMedia(query);
    lists.set(query, mql);
  }
  return mql;
}

function subscriber(query: string) {
  return (onChange: () => void) => {
    const mql = list(query);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  };
}

// Hoisted so the identities stay stable across renders.
const COARSE = '(pointer: coarse)';
const NARROW = '(max-width: 639px)';        // matches Tailwind's `sm`, so CSS and JS agree
const subscribeCoarse = subscriber(COARSE);
const subscribeNarrow = subscriber(NARROW);
const getCoarse = () => list(COARSE).matches;
const getNarrow = () => list(NARROW).matches;
const getServerFalse = () => false;

/** True on touch-first devices. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarse, getCoarse, getServerFalse);
}

/** True below Tailwind's `sm` breakpoint (640px). */
export function useIsNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, getNarrow, getServerFalse);
}

'use client';

import { useEffect } from 'react';
import { playSfx, preloadSound, unlockSound } from '@/lib/sound';

/**
 * Wires the hover and press sounds to the whole site with two delegated
 * listeners, rather than an onClick in every component.
 *
 *   hover — the pointer arriving on something interactive: buttons, links,
 *           tabs, and anything marked data-sfx-hover (catalog cards, LIVE
 *           rows). Mouse/pen only; on touch a "hover" is just the tap.
 *   press — clicking a button, link or tab, or anything marked
 *           data-sfx-press (a LIVE row, a catalog cover on touch).
 *
 * data-sfx="hover-only" keeps an element's hover sound but drops its press:
 * the nav, the panel's close button and the logos, because SiteShell plays
 * panel-open / panel-close / press for those from the section state itself —
 * which also covers the same actions done from the tower or the keyboard.
 */
const UNLOCK_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
const HOVER_TARGET = 'button, a[href], [role="tab"], [data-sfx-hover]';
const PRESS_TARGET = 'button, a[href], [role="tab"], [data-sfx-press]';

function targetOf(el: EventTarget | null, selector: string): HTMLElement | null {
  if (!(el instanceof Element)) return null;
  const t = el.closest<HTMLElement>(selector);
  if (!t) return null;
  if (t instanceof HTMLButtonElement && t.disabled) return null;
  return t;
}

export default function SoundEffects() {
  useEffect(() => {
    preloadSound();
    let hovered: HTMLElement | null = null;

    const unlock = () => unlockSound();
    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const t = targetOf(e.target, HOVER_TARGET);
      if (t === hovered) return;
      hovered = t;
      if (t) playSfx('hover');
    };
    const click = (e: MouseEvent) => {
      const t = targetOf(e.target, PRESS_TARGET);
      if (t && !t.closest('[data-sfx="hover-only"]')) playSfx('press');
    };

    // Only some events count as the "user gesture" browsers require before
    // audio may start. pointerdown does for a mouse but NOT for a finger —
    // on touch it's the lift (pointerup / touchend) — so listen to all of
    // them; unlockSound is a no-op once running.
    for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, { capture: true });
    document.addEventListener('pointerover', over);
    document.addEventListener('click', click);
    return () => {
      for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, { capture: true });
      document.removeEventListener('pointerover', over);
      document.removeEventListener('click', click);
    };
  }, []);

  return null;
}

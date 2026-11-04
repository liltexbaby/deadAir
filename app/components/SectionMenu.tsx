'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { SECTIONS, SECTION_LABELS, type Section } from '@/lib/sections';

/**
 * Phone panel title that doubles as a section switcher: tap the name (or its
 * ▾) for a drop-down of the other sections. On a phone the page's own nav is
 * hidden behind the full-screen sheet, so this is the way across without
 * closing first. Desktop keeps the plain title; the nav sits beside it.
 */
export default function SectionMenu({
  title,
  current,
  onSelect,
}: {
  title: string;
  /** The section showing, if any (the radio isn't one). */
  current: Section | null;
  onSelect: (section: Section) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // Tap outside, or Escape, closes it (before Escape reaches the panel).
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    window.addEventListener('keydown', key, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', key, { capture: true });
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 cursor-pointer"
      >
        <span className="ui-title font-mono text-xs uppercase tracking-[0.25em] text-black/90">{title}</span>
        {/* A wide, line-drawn V, flipping when open. */}
        <motion.svg
          aria-hidden
          viewBox="0 0 14 8"
          width={14}
          height={8}
          className="shrink-0 text-black/70"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <path d="M1 1.25 L7 6.75 L13 1.25" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="square" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="menu"
            className="absolute left-0 top-full z-50 mt-3 min-w-[11rem]"
            // Solid page colour, so the panel content doesn't show through.
            style={{ border: '1px solid rgba(0,0,0,0.15)', backgroundColor: '#f6f3ee' }}
            // Unrolls downward, like the panels.
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {SECTIONS.map((s) => {
              const here = s === current;
              const label = SECTION_LABELS[s];
              return (
                <li key={s} role="none">
                  <button
                    role="menuitem"
                    aria-current={here}
                    onClick={() => {
                      setOpen(false);
                      if (!here) onSelect(s);
                    }}
                    className="relative block w-full px-4 py-3 text-left cursor-pointer"
                    // Flat: no shadow or smoothing effects on the letters.
                    style={{ textShadow: 'none', filter: 'none', WebkitFontSmoothing: 'antialiased' }}
                  >
                    {/* One label only — the current one simply sits on the dark bar
                        (a second copy under it read as a drop shadow). Typewriter
                        face set here directly, not via the nav's shared styles. */}
                    {here && <span aria-hidden className="absolute inset-0 bg-black/80" />}
                    <span
                      className={`relative ${here ? 'text-white' : 'text-black/80'}`}
                      style={{ fontFamily: 'var(--font-heading), var(--font-ui), monospace', fontSize: 13, letterSpacing: '0.04em' }}
                    >
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

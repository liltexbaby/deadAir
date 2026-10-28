'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import type { ManagedArtistDTO } from '@/lib/queries';
import InquiryForm, { EMPTY_DRAFT, type InquiryDraft } from './InquiryForm';
import PixelPortrait from './PixelPortrait';
import { playSfx } from '@/lib/sound';

const SWIPE_DISTANCE = 50;   // px of drag that counts as a deliberate swipe
const SWIPE_VELOCITY = 400;  // ...or a flick this fast, however short

/**
 * MGMT roster. Two layouts:
 *
 * Desktop: like LIVE — the roster as a menu on the left, and a portrait plus
 * a contact form for the hovered (or clicked) artist on the right.
 *
 * Phone: one artist at a time in a fixed frame, stepped like the GALLERY
 * viewer (swipe, prev/next, arrow keys), with the current artist's form beneath.
 */
/**
 * Also renders the PUBLISHING roster, with `showContacts={false}`: a public
 * list with no way to contact anyone.
 */
export default function MgmtPanel({
  artists,
  showContacts = true,
  label = 'Managed roster',
  emptyText = 'no artists listed yet',
}: {
  artists: ManagedArtistDTO[];
  showContacts?: boolean;
  label?: string;
  emptyText?: string;
}) {
  const [index, setIndex] = useState(0);
  // Desktop: the artist under the pointer previews over the clicked one.
  const [hovered, setHovered] = useState<number | null>(null);
  // Desktop: bumps on every roster click, to replay the selection snap.
  const [clicks, setClicks] = useState(0);
  // Phone: bumps per prev/next step, to replay that button's wipe.
  const [pulse, setPulse] = useState({ prev: 0, next: 0 });
  // One draft for the whole roster, so picking another artist keeps what's typed.
  const [draft, setDraft] = useState<InquiryDraft>(EMPTY_DRAFT);

  const count = artists.length;
  // Clamped rather than wrapping: the prev/next controls disable at the ends,
  // so a swipe past the last artist should stop there too.
  const go = useCallback(
    (next: number) => setIndex(Math.min(Math.max(next, 0), Math.max(count - 1, 0))),
    [count],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Left/right only. Up/down still scroll the panel, and Escape still
      // closes it via SiteShell.
      if (e.key === 'ArrowLeft') go(index - 1);
      else if (e.key === 'ArrowRight') go(index + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, go]);

  if (count === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">
        {emptyText}
      </p>
    );
  }

  // Prev/next, from the buttons or a swipe: also flashes the matching button,
  // so a swipe gets the same feedback as a tap.
  const step = (dir: 1 | -1) => {
    if (dir === 1 ? index >= count - 1 : index <= 0) return;
    go(index + dir);
    // Every step sounds, tapped or swiped (a swipe is a drag, so the
    // site-wide click listener never sees it; the buttons opt out of it).
    playSfx('press');
    setPulse((p) => (dir === 1 ? { ...p, next: p.next + 1 } : { ...p, prev: p.prev + 1 }));
  };

  const atStart = index === 0;
  const atEnd = index === count - 1;
  // Once a message is being written, hovering the menu stops previewing other
  // artists — otherwise reaching for the form would retarget it.
  const writing = draft.message.trim() !== '';
  const active = artists[(writing ? null : hovered) ?? index];
  const form = (artist: ManagedArtistDTO) =>
    showContacts && <InquiryForm key={artist.id} artist={artist} draft={draft} onDraft={setDraft} />;

  return (
    <>
    {/* ---------------------------------------------------------- desktop */}
    <div className="hidden sm:grid h-full grid-cols-[2fr_3fr] gap-6" aria-label={label}>
      <div className="flex min-h-0 flex-col">
        <ul
          // p-1: room for the selection brackets, which sit just outside the
          // row and would otherwise be clipped by the scroll box.
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-black/10 p-1"
          onMouseLeave={() => setHovered(null)}
        >
          {artists.map((artist, i) => {
            const isActive = active?.id === artist.id;
            return (
              <li key={artist.id}>
                <button
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onClick={() => {
                    go(i);
                    setClicks((n) => n + 1);
                  }}
                  aria-current={i === index}
                  className={`relative flex w-full items-baseline gap-3 py-3 pl-4 text-left cursor-pointer ${
                    isActive ? '' : 'hover:bg-black/2'
                  }`}
                >
                  {/* Marks whose portrait is showing. */}
                  <span
                    aria-hidden
                    className={`absolute left-1.5 font-mono text-[11px] text-black/70 transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    ›
                  </span>
                  {/* Name only — the external label shows beside the name on
                      the right, and here it pushed long names onto two lines. */}
                  <span className="pl-1 font-mono text-xs text-black/90">{artist.name}</span>

                  {/* NieR-style selection: a dark bar wipes in from the left
                      over a light copy of the row, so the text flips exactly
                      where the bar's edge passes. Retracts the same way. */}
                  <span
                    aria-hidden
                    className={`ui-wipe absolute inset-0 flex items-baseline gap-3 bg-black/80 py-3 pl-4 transition-[clip-path] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isActive ? '[clip-path:inset(0_0_0_0)] duration-300' : '[clip-path:inset(0_100%_0_0)] duration-200'
                    }`}
                  >
                    <span className="absolute left-1.5 font-mono text-[11px] text-white/80">›</span>
                    <span className="pl-1 font-mono text-xs text-white">{artist.name}</span>
                  </span>

                  {/* Selected (clicked), as opposed to just hovered: corner
                      brackets that stay put while the bar follows the pointer.
                      Keyed on the click count so every click — even on the
                      artist already selected — snaps them in again with a
                      flash across the row. */}
                  {i === index && (
                    <motion.span
                      key={clicks}
                      aria-hidden
                      className="pointer-events-none absolute -inset-[3px]"
                      initial={clicks ? { opacity: 0, scale: 1.12 } : false}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <span className="absolute left-0 top-0 h-2 w-2 border-l border-t border-black/80" />
                      <span className="absolute right-0 top-0 h-2 w-2 border-r border-t border-black/80" />
                      <span className="absolute bottom-0 left-0 h-2 w-2 border-b border-l border-black/80" />
                      <span className="absolute bottom-0 right-0 h-2 w-2 border-b border-r border-black/80" />
                      {clicks > 0 && (
                        <motion.span
                          className="absolute inset-[3px] bg-white"
                          initial={{ opacity: 0.85 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: 0.35, ease: 'easeOut' }}
                        />
                      )}
                    </motion.span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {active && (
        <div className="@container min-h-0 overflow-y-auto overscroll-contain">
          {/* Square frame; artists change with a pixel break-up / resolve
              (PixelPortrait). Fills the column; the column scrolls if the
              form runs past. */}
          <div className="relative aspect-square w-full border border-black/10">
            {active.imageUrl && (
              <PixelPortrait src={active.imageUrl} sizes="(min-width: 640px) 30vw, 100vw" />
            )}
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <h3 className="font-mono text-sm text-black/90">{active.name}</h3>
            {active.externalLabel && (
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-black/30">
                {active.externalLabel}
              </span>
            )}
          </div>
          {form(active)}
        </div>
      )}
    </div>

    {/* ------------------------------------------------------------ phone */}
    {/* Laid out like the GALLERY viewer: one frame that stays put, the
        portrait changing inside it with the pixel break-up / resolve, a swipe
        that rubber-bands under the finger, and prev / name / next beneath. */}
    <div className="w-full sm:hidden" aria-roledescription="carousel" aria-label={label}>
      {/* No visible count; screen readers still hear where they are. */}
      <span aria-live="polite" className="sr-only">
        {artists[index]?.name}, {index + 1} of {count}
      </span>

      {/* Squares that fill from the left — the same wipe as the desktop
          roster — and empty back out when you move on. Where the gallery
          viewer has its counter. */}
      <ol className="flex items-center justify-center border-b border-black/10 pb-1.5">
        {artists.map((artist, i) => (
          <li key={artist.id}>
            <button
              onClick={() => go(i)}
              aria-label={artist.name}
              aria-current={i === index}
              // Padding is the tap target; the square itself is 10px.
              className="block p-1.5 cursor-pointer"
            >
              <span className="relative block h-2.5 w-2.5 border border-black/40">
                <span
                  className={`ui-pip absolute inset-0 bg-black/80 transition-[clip-path] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                    i === index ? '[clip-path:inset(0_0_0_0)] duration-300' : '[clip-path:inset(0_100%_0_0)] duration-200'
                  }`}
                />
              </span>
            </button>
          </li>
        ))}
      </ol>

      {/* Sources are square, so a square frame crops nothing. */}
      <motion.div
        className="relative mt-5 aspect-square w-full touch-pan-y select-none border border-black/10"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          const { offset, velocity } = info;
          if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) step(1);
          else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) step(-1);
        }}
      >
        {artists[index].imageUrl && (
          <PixelPortrait
            src={artists[index].imageUrl}
            alt={artists[index].name}
            // The panel is full-width on a phone.
            sizes="100vw"
          />
        )}
      </motion.div>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/10 pt-2">
        <StepButton
          label="‹ prev"
          aria-label="Previous artist"
          disabled={atStart}
          pulse={pulse.prev}
          onClick={() => step(-1)}
        />
        <div className="min-w-0 text-center">
          <h3 className="truncate font-mono text-sm text-black/90">{artists[index].name}</h3>
          {artists[index].externalLabel && (
            <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.15em] text-black/30">
              {artists[index].externalLabel}
            </p>
          )}
        </div>
        <StepButton
          label="next ›"
          aria-label="Next artist"
          disabled={atEnd}
          pulse={pulse.next}
          onClick={() => step(1)}
        />
      </div>

      {form(artists[index])}
    </div>
    </>
  );
}

/**
 * Phone prev/next. Each press flips it to the dark/light selection colours,
 * then fades back — timed to the indicator square
 * filling in. Keyed on `pulse` so every step, tapped or swiped, replays it.
 */
export function StepButton({
  label,
  disabled,
  pulse,
  onClick,
  'aria-label': ariaLabel,
}: {
  label: string;
  disabled: boolean;
  pulse: number;
  onClick: () => void;
  'aria-label': string;
}) {
  const text = 'px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.2em]';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      // step() plays the press itself, so a tap doesn't sound twice.
      data-sfx="hover-only"
      className={`relative ${text} text-black/55 transition-colors disabled:pointer-events-none disabled:text-black/15 cursor-pointer`}
    >
      {label}
      {pulse > 0 && (
        <motion.span
          key={pulse}
          aria-hidden
          className={`ui-wipe absolute inset-0 bg-black/80 ${text} text-white`}
          // Snaps fully dark, holds while the square fills (300ms, see the
          // indicator), then eases back out. Opacity only — the size never changes.
          initial={{ opacity: 1 }}
          animate={{ opacity: [1, 1, 0] }}
          transition={{ duration: 0.65, times: [0, 0.46, 1], ease: 'easeOut' }}
        >
          {label}
        </motion.span>
      )}
    </button>
  );
}

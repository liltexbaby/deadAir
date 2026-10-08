'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';

import type { ManagedArtistDTO } from '@/lib/queries';

const SWIPE_DISTANCE = 50;   // px of drag that counts as a deliberate swipe
const SWIPE_VELOCITY = 400;  // ...or a flick this fast, however short

/**
 * mailto: with the artist's own subject/body pre-filled (set per artist in the
 * admin), so an inquiry lands in their mgmt's inbox already labelled. `{artist}`
 * in either field is replaced with the artist's name. Falls back to a generic
 * "<role> inquiry — <artist>" subject when none is set.
 */
function mailtoFor(
  artist: ManagedArtistDTO,
  contact: ManagedArtistDTO['contacts'][number],
): string {
  const fill = (t: string) => t.replaceAll('{artist}', artist.name);
  const subject = artist.emailSubject
    ? fill(artist.emailSubject)
    : `${contact.label} inquiry — ${artist.name}`;
  const params = [`subject=${encodeURIComponent(subject)}`];
  if (artist.emailBody) params.push(`body=${encodeURIComponent(fill(artist.emailBody))}`);
  return `mailto:${contact.email}?${params.join('&')}`;
}

/**
 * Contacts for one artist. Shared by the phone carousel and the desktop menu
 * view so both render identically. Sits inside an @container, so the role
 * column goes side-by-side only when the box (not the viewport) is wide enough.
 */
function ContactList({ artist }: { artist: ManagedArtistDTO }) {
  if (artist.contacts.length === 0) return null;
  return (
    <dl className="mt-4 space-y-2">
      {artist.contacts.map((contact, ci) => (
        <div
          key={`${contact.role}-${contact.email ?? contact.url ?? ci}`}
          className="flex flex-col gap-0.5 @sm:flex-row @sm:gap-4"
        >
          <dt className="@sm:w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-black/35">
            {contact.label}
          </dt>
          <dd className="min-w-0 break-all font-mono text-[11px] text-black/70">
            {contact.email ? (
              <a
                href={mailtoFor(artist, contact)}
                className="border-b border-transparent transition-colors hover:border-black/40 hover:text-black"
              >
                {contact.email}
              </a>
            ) : contact.url ? (
              <a
                href={contact.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border-b border-transparent transition-colors hover:border-black/40 hover:text-black"
              >
                {contact.url}
              </a>
            ) : (
              contact.name ?? '—'
            )}
            {contact.name && contact.email && (
              <span className="ml-2 text-black/30">{contact.name}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * MGMT roster. Two layouts:
 *
 * Desktop: like LIVE — the roster as a menu on the left, and a portrait plus
 * contacts for the hovered (or clicked) artist on the right, all on one screen
 * with no scrolling.
 *
 * Phone: artist -> contacts as a one-at-a-time swipe carousel, matching how the
 * label's own mgmt page presents its roster.
 *
 * The carousel track holds every slide in normal flow and is translated by index, rather
 * than absolutely positioning one slide at a time. That way the container takes
 * the height of the tallest artist and never jumps as you page through — contact
 * counts vary (kuru has two management emails and no booking), so a
 * self-sizing container would resize on almost every transition.
 */
/**
 * Also renders the PUBLISHING roster, with `showContacts={false}` — the client
 * wants that list public without exposing any email addresses.
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
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Translate in pixels, not percentages: drag reports pixel offsets, and mixing
  // the two units on the same `x` makes the track jump when a swipe ends.
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const atStart = index === 0;
  const atEnd = index === count - 1;
  const active = artists[hovered ?? index];

  return (
    <>
    {/* ---------------------------------------------------------- desktop */}
    <div className="hidden sm:grid h-full grid-cols-[2fr_3fr] gap-6" aria-label={label}>
      <div className="flex min-h-0 flex-col">
        <div className="border-b border-black/10 pb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">
          roster — {count}
        </div>
        <ul
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-black/10"
          onMouseLeave={() => setHovered(null)}
        >
          {artists.map((artist, i) => {
            const isActive = active?.id === artist.id;
            return (
              <li key={artist.id}>
                <button
                  onMouseEnter={() => setHovered(i)}
                  onFocus={() => setHovered(i)}
                  onClick={() => go(i)}
                  aria-current={i === index}
                  className={`relative flex w-full items-baseline gap-3 py-3 pl-4 text-left transition-colors cursor-pointer ${
                    isActive ? 'bg-black/4' : 'hover:bg-black/2'
                  }`}
                >
                  {/* Marks whose portrait is showing. */}
                  <span
                    aria-hidden
                    className={`absolute left-0 font-mono text-[11px] text-black/70 transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    ›
                  </span>
                  {/* Name only — the external label shows beside the name on
                      the right, and here it pushed long names onto two lines. */}
                  <span className="font-mono text-xs text-black/90">{artist.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {active && (
        <div className="@container min-h-0 overflow-y-auto overscroll-contain">
          {/* Square frame, crossfading between artists like the LIVE poster.
              Capped so portrait + contacts fit the screen together. */}
          <div className="relative aspect-square w-full max-w-[20rem] border border-black/10">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={active.id}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {active.imageUrl && (
                  <Image
                    src={active.imageUrl}
                    alt=""
                    fill
                    sizes="20rem"
                    // Pixel art: keep the edges hard when scaled up.
                    className="object-cover [image-rendering:pixelated]"
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <h3 className="font-mono text-sm text-black/90">{active.name}</h3>
            {active.externalLabel && (
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-black/30">
                {active.externalLabel}
              </span>
            )}
          </div>
          {showContacts && <ContactList artist={active} />}
        </div>
      )}
    </div>

    {/* ------------------------------------------------------------ phone */}
    {/* @container so slides respond to the panel's width, not the viewport's. */}
    <div className="@container w-full sm:hidden" aria-roledescription="carousel" aria-label={label}>
      <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">
        <span>roster — {count}</span>
        <span aria-live="polite" className="tabular-nums text-black/55">
          {String(index + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}
        </span>
      </div>

      {/* Controls sit above the carousel, not below it.
          Now that the portrait fills the panel width, a full slide is taller
          than the viewport on a phone — controls underneath landed ~50px below
          the fold, so paging required scrolling first. Above the image they are
          always in view on both sizes, and it avoids a sticky bar that would
          have to fake the panel's translucent background. */}
      <div className="mb-5 flex items-center justify-between gap-4 border-y border-black/10 py-2.5">
        <button
          onClick={() => go(index - 1)}
          disabled={atStart}
          aria-label="Previous artist"
          // -my keeps the ~44px tap target without inflating the row.
          className="-my-3 py-3 pr-3 font-mono text-[11px] uppercase tracking-[0.2em] text-black/45 transition-colors hover:text-black disabled:pointer-events-none disabled:text-black/15 cursor-pointer"
        >
          ‹ prev
        </button>

        <ol className="flex items-center gap-2">
          {artists.map((artist, i) => (
            <li key={artist.id}>
              <button
                onClick={() => go(i)}
                aria-label={artist.name}
                aria-current={i === index}
                className={`block h-1.5 w-1.5 rotate-45 transition-colors cursor-pointer ${
                  i === index ? 'bg-black/80' : 'bg-black/20 hover:bg-black/45'
                }`}
              />
            </li>
          ))}
        </ol>

        <button
          onClick={() => go(index + 1)}
          disabled={atEnd}
          aria-label="Next artist"
          className="-my-3 py-3 pl-3 font-mono text-[11px] uppercase tracking-[0.2em] text-black/45 transition-colors hover:text-black disabled:pointer-events-none disabled:text-black/15 cursor-pointer"
        >
          next ›
        </button>
      </div>

      <div ref={viewport} className="overflow-hidden">
        <motion.ul
          className="flex items-stretch"
          animate={{ x: -index * width }}
          transition={{ type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          drag="x"
          // Constrained around the *current* slide's resting position. These
          // are absolute x values, and the old { left: 0, right: 0 } meant
          // "slide 1" — so from any later artist, starting a swipe yanked the
          // track back toward the first one, and a short drag that didn't page
          // left it stranded there.
          dragConstraints={{ left: -index * width, right: -index * width }}
          dragElastic={0.25}
          onDragEnd={(_, info) => {
            const { offset, velocity } = info;
            if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) go(index + 1);
            else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) go(index - 1);
          }}
        >
          {artists.map((artist, i) => (
            <li
              key={artist.id}
              // Off-screen slides stay in the DOM to hold the track's height, so
              // they must be hidden from assistive tech and taken out of the tab
              // order — otherwise focus walks into invisible contact links.
              aria-hidden={i !== index}
              inert={i !== index}
              className="w-full shrink-0 select-none"
            >
              {artist.imageUrl && (
                <Image
                  src={artist.imageUrl}
                  alt=""
                  width={640}
                  height={640}
                  draggable={false}
                  // The panel is half-width on desktop and full-width on a
                  // phone; without this next/image would size for the whole
                  // viewport and ship a needlessly large file on desktop.
                  sizes="(min-width: 640px) 50vw, 100vw"
                  // Sources are square, so a square box crops nothing.
                  // They're also pixel art — smoothing them defeats the look,
                  // and upscaling to the full panel width is the point.
                  className="mb-5 aspect-square w-full border border-black/10 object-cover [image-rendering:pixelated]"
                />
              )}

              <div className="flex items-baseline gap-3">
                <h3 className="font-mono text-sm text-black/90">{artist.name}</h3>
                {artist.externalLabel && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-black/30">
                    {artist.externalLabel}
                  </span>
                )}
              </div>

              {showContacts && <ContactList artist={artist} />}
            </li>
          ))}
        </motion.ul>
      </div>

    </div>
    </>
  );
}

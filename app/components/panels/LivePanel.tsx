'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import type { EventDTO } from '@/lib/queries';

const STATUS_LABELS: Record<string, string> = {
  sold_out: 'sold out',
  cancelled: 'cancelled',
  on_sale: 'on sale',
};

const SWIPE_DISTANCE = 50;   // px of drag that counts as a deliberate swipe
const SWIPE_VELOCITY = 400;  // ...or a flick this fast, however short

type Tab = 'present' | 'past';

/**
 * Dates are optional by design: the label's live listings include promo cards
 * with a ticket link and nothing else. Every date/venue line is therefore
 * conditional, so an event with no details renders as a clean title + link.
 */
function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .toLowerCase();
}

/** Local YYYY-MM-DD, comparable as a string against event dates. */
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * PAST is anything dated before today, most recent first. Everything else —
 * including undated promo entries — is PRESENT, in the admin's own order.
 */
function split(events: EventDTO[]): Record<Tab, EventDTO[]> {
  const today = todayIso();
  const past = events
    .filter((e) => e.date !== null && e.date < today)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const present = events.filter((e) => e.date === null || e.date >= today);
  return { present, past };
}

function EventMeta({ event }: { event: EventDTO }) {
  const place = [event.venue, event.city].filter(Boolean).join(', ');
  const statusLabel = STATUS_LABELS[event.status];
  const isDead = event.status === 'cancelled' || event.status === 'sold_out';

  return (
    <>
      <div className="flex items-baseline gap-3">
        <h3 className="font-mono text-xs text-black/90">{event.title}</h3>
        {statusLabel && (
          <span
            className={`font-mono text-[9px] uppercase tracking-[0.2em] ${
              isDead ? 'text-black/30' : 'text-emerald-700/80'
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {event.artist && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-black/35">
          {event.artist}
        </p>
      )}

      {(event.date || place) && (
        <p className="mt-1.5 font-mono text-[11px] text-black/55">
          {event.date && formatDate(event.date)}
          {event.date && place && <span className="text-black/25"> · </span>}
          {place}
        </p>
      )}

      {event.ticketUrl && !isDead && (
        <a
          href={event.ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-black/60 hover:text-black border-b border-black/15 hover:border-black/50 transition-colors"
        >
          tickets
        </a>
      )}
    </>
  );
}

/** Poster with a crossfade between events; falls back to the title. */
function Poster({ event, sizes }: { event: EventDTO; sizes: string }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={event.id}
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {event.imageUrl ? (
          <Image
            src={event.imageUrl}
            alt={event.title}
            fill
            sizes={sizes}
            draggable={false}
            // contain, not cover: tour posters carry dates and names right to
            // the edge, so cropping them loses information.
            className="object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center border border-black/10">
            <span className="px-6 text-center font-mono text-sm uppercase tracking-[0.2em] text-black/40">
              {event.title}
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * LIVE: a menu of events beside a changing poster.
 *
 * Desktop: the usual half-width panel, with the menu on the left and the
 * poster in a portrait frame beside it, sized to fit the screen rather than
 * scroll. Hovering an event swaps the poster; clicking one pins it so the
 * poster stays put when the pointer leaves the menu.
 *
 * Phone: just the poster, with swipe and prev/next to move between events and
 * the details underneath.
 */
export default function LivePanel({ events }: { events: EventDTO[] }) {
  const groups = split(events);
  // Open on PRESENT unless there's nothing upcoming but there is history.
  const [tab, setTab] = useState<Tab>(
    groups.present.length === 0 && groups.past.length > 0 ? 'past' : 'present',
  );
  const [pinned, setPinned] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [index, setIndex] = useState(0);   // phone carousel position

  const list = groups[tab];

  if (events.length === 0) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">
        no dates announced
      </p>
    );
  }

  const switchTab = (next: Tab) => {
    setTab(next);
    setPinned(null);
    setHovered(null);
    setIndex(0);
  };

  const active =
    list.find((e) => e.id === hovered) ?? list.find((e) => e.id === pinned) ?? list[0] ?? null;

  const current = list[Math.min(index, Math.max(list.length - 1, 0))] ?? null;
  const go = (next: number) => setIndex(Math.min(Math.max(next, 0), Math.max(list.length - 1, 0)));

  const tabs = (
    <div role="tablist" className="flex gap-5 border-b border-black/10 pb-3">
      {(['present', 'past'] as const).map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={tab === t}
          onClick={() => switchTab(t)}
          className={`font-mono text-[10px] uppercase tracking-[0.2em] transition-colors cursor-pointer ${
            tab === t ? 'text-black font-bold' : 'text-black/40 hover:text-black/70'
          }`}
        >
          {t} <span className="tabular-nums font-normal text-black/35">{groups[t].length}</span>
        </button>
      ))}
    </div>
  );

  const empty = (
    <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">
      {tab === 'present' ? 'no upcoming dates' : 'no past dates'}
    </p>
  );

  return (
    <>
      {/* ---------------------------------------------------------- desktop */}
      <div className="hidden sm:grid h-full grid-cols-[2fr_3fr] gap-6">
        <div className="flex min-h-0 flex-col">
          {tabs}
          {list.length === 0 ? (
            empty
          ) : (
            <ul
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain divide-y divide-black/10"
              onMouseLeave={() => setHovered(null)}
            >
              {list.map((event) => {
                const isActive = active?.id === event.id;
                return (
                  <li
                    key={event.id}
                    onMouseEnter={() => setHovered(event.id)}
                    onFocus={() => setHovered(event.id)}
                    onClick={() => setPinned(event.id)}
                    className={`relative cursor-pointer py-4 pl-4 transition-colors ${
                      isActive ? 'bg-black/4' : 'hover:bg-black/2'
                    }`}
                  >
                    {/* Marks which event the poster is showing. */}
                    <span
                      aria-hidden
                      className={`absolute left-0 top-4 font-mono text-[11px] text-black/70 transition-opacity ${
                        isActive ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      ›
                    </span>
                    <EventMeta event={event} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Portrait frame (tour posters are ~3:4), top-aligned with the menu.
            max-h lets it shrink on short screens rather than overflow. */}
        <div className="min-h-0">
          <div className="relative aspect-[3/4] w-full max-h-full">
            {active && <Poster event={active} sizes="(min-width: 640px) 30vw, 100vw" />}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ phone */}
      <div className="sm:hidden">
        {tabs}
        {!current ? (
          empty
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => go(index - 1)}
                disabled={index === 0}
                aria-label="Previous event"
                className="-my-3 py-3 pr-3 font-mono text-[11px] uppercase tracking-[0.2em] text-black/45 disabled:text-black/15 cursor-pointer"
              >
                ‹ prev
              </button>
              <span aria-live="polite" className="font-mono text-[10px] tabular-nums text-black/55">
                {String(index + 1).padStart(2, '0')} / {String(list.length).padStart(2, '0')}
              </span>
              <button
                onClick={() => go(index + 1)}
                disabled={index >= list.length - 1}
                aria-label="Next event"
                className="-my-3 py-3 pl-3 font-mono text-[11px] uppercase tracking-[0.2em] text-black/45 disabled:text-black/15 cursor-pointer"
              >
                next ›
              </button>
            </div>

            <motion.div
              className="relative mt-4 h-[58dvh] touch-pan-y"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={(_, info) => {
                const { offset, velocity } = info;
                if (offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY) go(index + 1);
                else if (offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY) go(index - 1);
              }}
            >
              <Poster event={current} sizes="100vw" />
            </motion.div>

            <div className="mt-5">
              <EventMeta event={current} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

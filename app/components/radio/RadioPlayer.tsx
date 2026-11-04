'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { motion } from 'framer-motion';

import { SOUNDCLOUD_OPTIONS, STATIONS, embedFor, type Station } from '@/lib/radio';
import { duckAmbience, isMuted, playSfx, subscribeMuted } from '@/lib/sound';
import { useIsNarrow } from '@/lib/useCoarsePointer';
import type { Section } from '@/lib/sections';
import Image from 'next/image';
import SectionMenu from '../SectionMenu';
import { loadSoundCloudApi, startPlaying, type ScWidget } from './soundcloud';
import PixelVeil from './PixelVeil';

// Dial sweep: the knob turns through 270°, stations spread evenly across it.
const SWEEP = 270;
// Drag sensitivity: this many px of travel moves one station.
const PX_PER_STATION = 28;
// Frequency strip: two minor ticks between stations, TICK px apart.
const TICK = 16;
const STATION_GAP = TICK * 3;
// Before the next show is asked for: long enough for the pixel cells to
// cover the outgoing player (PixelVeil's OUT_MS).
const SCAN_MS = 240;
const WHEEL_GAP_MS = 220;
const EASE = [0.16, 1, 0.3, 1] as const;

const pad = (i: number) => String(i + 1).padStart(2, '0');

/**
 * deadAir Transmissions: the radio, offered from the home screen.
 *
 * Closed (the default) it's one line under the tower, a system notice:
 * "accept incoming radio signals? [10]". Accepting powers the radio on and
 * tunes the first station.
 *
 *   Desktop: a squat bar under the tower — dial | info | player | presets.
 *   Phone:   a full-screen sheet, like the section panels.
 *
 * Closing only hides it: the show keeps playing, and the notice becomes a
 * "receiving" line to bring it back or switch it off. The same goes for the
 * section panels — the radio steps aside while one is open, still playing.
 *
 * Turn the dial (drag, scroll over it, arrow keys once focused) or pick a
 * preset. Moving off a station breaks the player up into pixel cells (like
 * the MGMT portraits); settling on one starts its show and the cells clear.
 */
export default function RadioPlayer({
  visible,
  stations = STATIONS,
  onSelectSection,
}: {
  visible: boolean;
  stations?: Station[];
  /** Phone sheet: its title menu jumps to a section (the radio steps aside, still playing). */
  onSelectSection?: (section: Section) => void;
}) {
  // The station list comes from NTS (lib/nts.ts), so its length varies.
  const COUNT = stations.length;
  const LAST = COUNT - 1;
  const DEG_PER_STATION = SWEEP / Math.max(LAST, 1);
  const clamp = (v: number) => Math.min(Math.max(v, 0), LAST);
  const narrow = useIsNarrow();
  // The site's sound toggle silences the radio too.
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false);
  // Powered: the radio exists (and may be playing). Open: it's on screen.
  const [powered, setPowered] = useState(false);
  const [open, setOpen] = useState(false);

  // Continuous dial position, in stations (0..LAST). Fractional mid-drag.
  const [pos, setPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  // The station under the needle, and the one whose show is loaded.
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);

  // One SoundCloud player for the whole session, retuned in place (see
  // ./soundcloud.ts): after the first play, every station starts by itself.
  // The one Mixcloud show gets its own iframe while it's on.
  const [scSrc, setScSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<'sc' | 'mc' | null>(null);
  const scFrame = useRef<HTMLIFrameElement>(null);
  const widget = useRef<ScWidget | null>(null);
  // Bumped per request, so a slow load can't land after a newer tune.
  const seq = useRef(0);
  // The station most recently asked for.
  const wanted = useRef(0);

  const loadTimer = useRef<number | null>(null);
  const drag = useRef({ x: 0, y: 0, from: 0 });
  const wheel = useRef({ last: 0, accum: 0 });
  useEffect(() => () => {
    if (loadTimer.current) clearTimeout(loadTimer.current);
  }, []);

  /** The needle has moved onto a station: static now, the show after a beat. */
  const settle = (i: number) => {
    if (loadTimer.current) clearTimeout(loadTimer.current);
    setIndex(i);
    setPos(i);
    if (i === loaded) {
      setScanning(false);
      return;
    }
    setScanning(true);
    wanted.current = i;
    loadTimer.current = window.setTimeout(() => bringIn(i), SCAN_MS);
  };

  /** Ask the right player for station i; the cells clear once it's started. */
  const bringIn = (i: number) => {
    const n = ++seq.current;
    const s = stations[i];
    setLoaded(i);
    if (s.mixcloud) {
      widget.current?.pause();
      setMode('mc');
      return; // the Mixcloud iframe's onLoad clears the cells
    }
    setMode('sc');
    const w = widget.current;
    if (!w) {
      // First SoundCloud show: create the player. onScLoad takes it from there.
      if (!scSrc) setScSrc(embedFor(s).src);
      return;
    }
    w.load(s.soundcloud!, {
      ...SOUNDCLOUD_OPTIONS,
      callback: () => {
        if (n !== seq.current) return;
        // A new show comes in at the player's own volume; keep it silent if muted.
        w.setVolume(isMuted() ? 0 : 100);
        startPlaying(w, () => n === seq.current);
        setScanning(false);
      },
    });
  };

  /** The SoundCloud iframe has loaded: hook up its API, then play whatever's wanted. */
  const onScLoad = () => {
    const el = scFrame.current;
    if (!el || widget.current) return;
    loadSoundCloudApi()
      .then((SC) => {
        const w = SC.Widget(el);
        w.bind(SC.Widget.Events.READY, () => {
          if (widget.current) return;
          widget.current = w;
          w.setVolume(isMuted() ? 0 : 100);
          const want = stations[wanted.current];
          // Retuned to another SoundCloud show while the player was starting.
          if (want.soundcloud && el.src.indexOf(encodeURIComponent(want.soundcloud)) === -1) bringIn(wanted.current);
          else if (want.soundcloud) {
            const n = seq.current;
            startPlaying(w, () => n === seq.current);
            setScanning(false);
          }
        });
      })
      // No API (blocked script): the player still works by its own button.
      .catch(() => setScanning(false));
  };

  const tune = (i: number) => {
    const next = clamp(i);
    if (next !== index || loaded === null) playSfx('press');
    settle(next);
  };

  // ------------------------------------------------------------ open / close
  /** Accept the signal: power on, open, and tune in (the first station, or
   *  wherever the dial was left). The click is the gesture that lets it play. */
  const accept = () => {
    playSfx('panel-open');
    setPowered(true);
    setOpen(true);
    if (loaded === null) settle(index);
  };
  const reopen = () => {
    playSfx('panel-open');
    setOpen(true);
  };
  /** Hide the radio; whatever's on keeps playing. */
  const close = () => {
    playSfx('panel-close');
    setOpen(false);
  };
  /** Switch off: the show stops and the notice goes back to its offer. */
  const off = () => {
    playSfx('panel-close');
    if (loadTimer.current) clearTimeout(loadTimer.current);
    seq.current++;
    widget.current = null;
    setOpen(false);
    setPowered(false);
    setLoaded(null);
    setScanning(false);
    setScSrc(null);
    setMode(null);
  };

  // Sound off: the SoundCloud player goes silent (it keeps its place).
  useEffect(() => {
    widget.current?.setVolume(muted ? 0 : 100);
  }, [muted]);

  // The site's drone steps aside while a show is on.
  useEffect(() => {
    duckAmbience(powered && loaded !== null);
  }, [powered, loaded]);

  // Escape closes the radio (before SiteShell's listener, which is for panels).
  useEffect(() => {
    if (!open || !visible) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      playSfx('panel-close');
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [open, visible]);

  // ------------------------------------------------------------------ dial
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, from: pos };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    // Right or up turns it up the band, like most dials.
    const travel = e.clientX - drag.current.x - (e.clientY - drag.current.y);
    const next = clamp(drag.current.from + travel / PX_PER_STATION);
    setPos(next);
    const i = Math.round(next);
    if (i !== index) {
      // Passing a station ticks; the show only loads once the dial is let go.
      playSfx('hover');
      setIndex(i);
      setScanning(true);
      if (loadTimer.current) clearTimeout(loadTimer.current);
    }
  };
  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const i = Math.round(pos);
    if (i !== loaded) playSfx('press');
    settle(i);
  };

  // One wheel gesture = one station, so a trackpad's flick can't spin past several.
  const onWheel = (e: WheelEvent<HTMLDivElement>) => {
    const w = wheel.current;
    const now = performance.now();
    if (now - w.last > WHEEL_GAP_MS) w.accum = 0;
    w.last = now;
    w.accum += e.deltaY + e.deltaX;
    if (Math.abs(w.accum) < 30) return;
    // Scrolling up turns it up, like the drag.
    tune(index + (w.accum < 0 ? 1 : -1));
    w.accum = 0;
    w.last = now + 400; // swallow the rest of this gesture
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') tune(index + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') tune(index - 1);
    else if (e.key === 'Home') tune(0);
    else if (e.key === 'End') tune(LAST);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const station = stations[index];
  const showing = loaded !== null ? stations[loaded] : null;
  const live = loaded !== null && !scanning;
  const angle = -SWEEP / 2 + pos * DEG_PER_STATION;
  const shown = powered && open && visible;

  // ------------------------------------------------------------- pieces
  // Plain functions returning JSX (not components), so nothing remounts.

  const dial = (size: string) => (
    <div className="flex flex-col items-center gap-1">
      <div
        role="slider"
        tabIndex={0}
        aria-label="Tune"
        aria-valuemin={1}
        aria-valuemax={COUNT}
        aria-valuenow={index + 1}
        aria-valuetext={`${station.freq} — ${station.artist}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
        data-sfx="hover-only"
        className={`relative ${size} touch-none select-none outline-none cursor-grab active:cursor-grabbing focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-black/60`}
      >
        <svg viewBox="-50 -50 100 100" className="h-full w-full overflow-visible" aria-hidden>
          {/* Ring, and a mark per station; the tuned one long and dark. */}
          <circle r="34" fill="none" stroke="black" strokeOpacity="0.35" strokeWidth="1.5" />
          {stations.map((_, i) => {
            const a = ((-SWEEP / 2 + i * DEG_PER_STATION - 90) * Math.PI) / 180;
            const on = i === index;
            return (
              <line
                key={i}
                x1={Math.cos(a) * 40}
                y1={Math.sin(a) * 40}
                x2={Math.cos(a) * (on ? 50 : 45)}
                y2={Math.sin(a) * (on ? 50 : 45)}
                stroke="black"
                strokeOpacity={on ? 0.85 : 0.3}
                strokeWidth={on ? 3 : 2}
              />
            );
          })}
        </svg>
        {/* Pointer: a line from the centre to the ring, turning about the
            centre; a square hub on top. */}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            transform: `rotate(${angle}deg)`,
            transition: dragging ? 'none' : 'transform 0.45s cubic-bezier(0.34,1.4,0.64,1)',
          }}
        >
          <span className="absolute left-1/2 top-[17%] h-[33%] w-[1.5px] -translate-x-1/2 bg-black/85" />
        </span>
        <span aria-hidden className="absolute left-1/2 top-1/2 h-[12%] w-[12%] -translate-x-1/2 -translate-y-1/2 bg-black/85" />
      </div>
      <span className="font-mono text-[8px] uppercase tracking-[0.25em] text-black/45">tune</span>
    </div>
  );

  // Frequency strip, sliding under a fixed needle.
  const strip = (
    <div className="relative h-5 overflow-hidden border-b border-black/20">
      <div
        className="absolute bottom-0 left-1/2 flex items-end"
        style={{
          transform: `translateX(${-(pos * STATION_GAP + TICK / 2)}px)`,
          transition: dragging ? 'none' : 'transform 0.45s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {stations.map((s, i) => (
          <div key={s.freq} className="flex items-end">
            {i > 0 &&
              [0, 1].map((k) => (
                <span key={k} className="flex w-4 justify-center">
                  <span className="block h-1 w-px bg-black/25" />
                </span>
              ))}
            <span className="relative flex w-4 justify-center">
              <span className={`block w-px ${i === index ? 'h-2.5 bg-black/80' : 'h-1.5 bg-black/40'}`} />
              <span
                className={`absolute bottom-2.5 font-mono text-[8px] leading-none tabular-nums tracking-wider ${
                  i === index ? 'text-black/85' : 'text-black/35'
                }`}
              >
                {s.freq}
              </span>
            </span>
          </div>
        ))}
      </div>
      {/* Needle: a dark hairline with a square head. */}
      <span aria-hidden className="absolute bottom-0 left-1/2 h-full w-px -translate-x-1/2 bg-black/85" />
      <span aria-hidden className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 bg-black/85" />
    </div>
  );

  const tags = (
    <span className="flex min-w-0 gap-1 overflow-hidden">
      {station.tags.map((t) => (
        <span key={t} className="shrink-0 bg-black/[0.07] px-1 font-mono text-[8px] uppercase tracking-[0.1em] text-black/55">
          {t}
        </span>
      ))}
    </span>
  );

  const nowPlaying = (
    <div className="flex items-center gap-2" aria-live="polite">
      <SignalBars on={live} />
      <h3 className="min-w-0 flex-1 truncate text-sm leading-tight text-black/90">{station.artist}</h3>
      <span className="font-mono text-[10px] tabular-nums tracking-[0.15em] text-black/50">{station.freq}</span>
    </div>
  );

  // The show. A fixed 60px slot: the radio never grows.
  const playerCls =
    // Greyed and multiplied onto the page, so the white player reads as part
    // of the UI rather than a box dropped on it.
    'absolute inset-0 block h-[60px] w-full border-0 mix-blend-multiply [filter:grayscale(1)_contrast(1.05)]';
  const slot = (
    <div onWheel={onWheel} className="relative h-[60px] min-w-0 overflow-hidden bg-black/[0.04]">
      {scSrc && (
        <iframe
          ref={scFrame}
          title="deadAir Transmissions"
          src={scSrc}
          allow="autoplay"
          onLoad={onScLoad}
          className={playerCls}
          style={{ visibility: mode === 'sc' ? 'visible' : 'hidden' }}
        />
      )}
      {/* Mixcloud's player can't be muted from outside, so with sound off
          it's set aside (and comes back, from the top, when sound is on). */}
      {mode === 'mc' && showing?.mixcloud && !muted && (
        <iframe
          key={loaded}
          title={`deadAir Transmissions w/ ${showing.artist}`}
          src={embedFor(showing).src}
          allow="autoplay"
          onLoad={() => setScanning(false)}
          className={playerCls}
        />
      )}
      {/* Between shows: the portraits' pixel break-up, over the player... */}
      <PixelVeil covered={scanning || loaded === null || (mode === 'mc' && muted)} />
      {mode === 'mc' && muted && !scanning && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[9px] uppercase tracking-[0.3em] text-black/45">
          sound off
        </span>
      )}
      {/* ...and, once the old show has gone, a line while the next comes in. */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[9px] uppercase tracking-[0.3em] text-black/55"
        initial={false}
        animate={{ opacity: scanning || loaded === null ? 1 : 0 }}
        transition={
          scanning || loaded === null
            ? { duration: 0.3, delay: 0.18, ease: 'easeOut' }
            : { duration: 0.12, ease: 'easeIn' }
        }
      >
        receiving transmission…
      </motion.span>
      {/* Corner marks, like the selection brackets elsewhere on the site. */}
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-2 w-2 border-l border-t border-black/60" />
      <span aria-hidden className="pointer-events-none absolute right-0 top-0 h-2 w-2 border-r border-t border-black/60" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 h-2 w-2 border-b border-l border-black/60" />
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-2 w-2 border-b border-r border-black/60" />
    </div>
  );

  const wipe = (on: boolean) =>
    `ui-wipe absolute inset-0 bg-black/80 text-white transition-[clip-path] ease-[cubic-bezier(0.16,1,0.3,1)] ${
      on ? '[clip-path:inset(0_0_0_0)] duration-300' : '[clip-path:inset(0_100%_0_0)] duration-200'
    }`;

  // ------------------------------------------------------------- render
  return (
    <>
      {/* ---------------------------------------------------- the notice */}
      <motion.div
        className="pointer-events-none fixed inset-x-0 z-20 flex justify-center px-4"
        // Phones: about halfway between the tower's base and the bottom of
        // the screen, clear of Safari's toolbar and the home bar.
        // Inline, not a utility class: if a stylesheet ever arrives late or
        // stale, a fixed box with no offset falls to the top of the screen.
        style={{ bottom: narrow ? 'calc(env(safe-area-inset-bottom, 0px) + 2.75rem)' : '2rem' }}
        initial={false}
        // Comes online after the tower and nav, flickering on like they do.
        animate={visible && !open ? { opacity: [0, 1, 0.2, 1] } : { opacity: 0 }}
        transition={
          visible && !open
            ? { duration: 0.5, times: [0, 0.3, 0.55, 1], delay: powered ? 0.1 : 1.4 }
            : { duration: 0.2 }
        }
      >
        {loaded === null || !powered ? (
          <button
            onClick={accept}
            data-sfx="hover-only"
            tabIndex={visible && !open ? 0 : -1}
            className="group pointer-events-auto relative flex items-center gap-2 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.15em] text-black/70 cursor-pointer sm:text-[10px] sm:tracking-[0.2em]"
            style={{ pointerEvents: visible && !open ? 'auto' : 'none' }}
          >
            <Notice text="accept incoming radio signals?" count={COUNT} />
            {/* Hover: the nav's dark bar wipes across and the text flips. */}
            <span
              aria-hidden
              className="ui-wipe absolute inset-0 flex items-center gap-2 bg-black/80 px-3 py-2 text-white transition-[clip-path] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] [clip-path:inset(0_100%_0_0)] group-hover:duration-300 group-hover:[clip-path:inset(0_0_0_0)] group-focus-visible:[clip-path:inset(0_0_0_0)]"
            >
              <Notice text="accept incoming radio signals?" count={COUNT} inverted />
            </span>
          </button>
        ) : (
          <div
            className="pointer-events-auto flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.15em] sm:text-[10px] sm:tracking-[0.2em]"
            style={{ pointerEvents: visible && !open ? 'auto' : 'none' }}
          >
            <button
              onClick={reopen}
              data-sfx="hover-only"
              tabIndex={visible && !open ? 0 : -1}
              className="group relative flex items-center gap-2 px-3 py-2 text-black/70 cursor-pointer"
            >
              <SignalBars on={live} />
              <span className="normal-case tracking-[0.1em]">receiving {showing?.freq} · {showing?.artist}</span>
              <span aria-hidden className={`${wipe(false)} flex items-center gap-2 px-3 py-2 group-hover:duration-300 group-hover:[clip-path:inset(0_0_0_0)]`}>
                <SignalBars on={live} inverted />
                <span className="normal-case tracking-[0.1em]">receiving {showing?.freq} · {showing?.artist}</span>
              </span>
            </button>
            <button
              onClick={off}
              data-sfx="hover-only"
              tabIndex={visible && !open ? 0 : -1}
              aria-label="Switch the radio off"
              className="px-2 py-2 text-black/40 transition-colors hover:text-black cursor-pointer"
            >
              off
            </button>
          </div>
        )}
      </motion.div>

      {/* ---------------------------------------------------- the radio */}
      {/* Mounted while powered, so a show keeps playing when it's hidden. */}
      {powered && !narrow && (
        <motion.div
          className="fixed inset-x-0 bottom-6 z-20 flex justify-center px-4"
          initial={{ opacity: 0, y: 24 }}
          animate={shown ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: shown ? 0.5 : 0.3, ease: EASE }}
          style={{ pointerEvents: shown ? 'auto' : 'none' }}
          aria-hidden={!shown}
          inert={!shown}
        >
          {/* Desktop: one squat row, dial | info | player | presets. Flat,
              line-drawn UI in the site's ink — no frame: the alignment holds
              it together. */}
          <section
            aria-label="deadAir Transmissions radio"
            className="ui-surface ui-radio relative grid w-full max-w-[54rem] grid-cols-[auto_13rem_minmax(0,1fr)_auto] items-center gap-x-4 bg-[#f6f3ee]/60 px-4 py-3 backdrop-blur-md"
          >
            {dial('h-12 w-12')}
            <div onWheel={onWheel} className="flex h-[60px] min-w-0 flex-col justify-between">
              {strip}
              {nowPlaying}
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.15em] text-black/45">{station.date}</span>
                {tags}
              </div>
            </div>
            {slot}
            {/* Two rows, however many stations NTS lists. */}
            <div
              className="grid gap-px"
              style={{ gridTemplateColumns: `repeat(${Math.ceil(COUNT / 2)}, 1.5rem)` }}
              role="group"
              aria-label="Stations"
            >
              {stations.map((s, i) => (
                <button
                  key={s.freq}
                  onClick={() => tune(i)}
                  aria-label={`${s.freq} — ${s.artist}, ${s.date}`}
                  aria-pressed={i === index}
                  data-sfx="hover-only"
                  className="relative flex h-7 w-6 items-center justify-center font-mono text-[9px] tabular-nums text-black/50 transition-colors hover:bg-black/[0.05] hover:text-black cursor-pointer"
                >
                  {pad(i)}
                  <span aria-hidden className={`${wipe(i === index)} flex items-center justify-center`}>
                    {pad(i)}
                  </span>
                </button>
              ))}
            </div>
            {/* Hide: back to the notice; the show plays on. */}
            <button
              onClick={close}
              data-sfx="hover-only"
              className="absolute -top-6 right-0 px-1 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-black/45 transition-colors hover:text-black cursor-pointer"
            >
              <span className="hidden sm:inline">[esc] </span>close
            </button>
          </section>
        </motion.div>
      )}

      {powered && narrow && (
        <motion.section
          aria-label="deadAir Transmissions radio"
          // Phone: a full-screen sheet, sliding in like the section panels.
          className="ui-surface ui-radio fixed inset-0 z-[60] flex flex-col bg-white/70 backdrop-blur-xl"
          initial={{ x: '100%' }}
          animate={{ x: shown ? 0 : '100%' }}
          transition={{ duration: shown ? 0.32 : 0.26, ease: EASE }}
          style={{ pointerEvents: shown ? 'auto' : 'none' }}
          aria-hidden={!shown}
          inert={!shown}
        >
          <header className="flex shrink-0 items-center justify-between gap-4 border-b border-black/10 px-5 pb-4 pt-[calc(env(safe-area-inset-top,0px)+1.9rem)]">
            <div className="flex items-center gap-4">
              {/* As on the section panels: the logo takes you back to the start
                  (here: the radio steps aside, still playing). */}
              <button onClick={close} data-sfx="hover-only" aria-label="deadAir — back to start" className="-m-1 p-1 cursor-pointer">
                <Image src="/dA.png" alt="" width={56} height={55} className="w-6 h-auto opacity-80 invert" />
              </button>
              <SectionMenu
                title="Radio"
                current={null}
                onSelect={(s) => {
                  setOpen(false);
                  onSelectSection?.(s);
                }}
              />
            </div>
            <button
              onClick={close}
              data-sfx="hover-only"
              className="-my-3 -mr-3 p-3 font-mono text-[10px] uppercase tracking-[0.2em] text-black/70 cursor-pointer"
            >
              close
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-6">
            {/* The same small dial as desktop, on the right under the thumb,
                beside the band and what's on. */}
            <div className="flex items-center gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                {strip}
                {nowPlaying}
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-black/45">{station.date}</span>
              </div>
              {dial('h-12 w-12')}
            </div>

            <div className="mt-4">{slot}</div>

            {/* Stations as a list, with the roster's selection bar. */}
            <ul className="mt-6 divide-y divide-black/10 border-y border-black/10" role="group" aria-label="Stations">
              {stations.map((s, i) => {
                const row = (inverted: boolean) => (
                  <>
                    <span className={`w-12 font-mono text-[10px] tabular-nums ${inverted ? 'text-white/80' : 'text-black/55'}`}>{s.freq}</span>
                    <span className={`min-w-0 flex-1 truncate font-mono text-xs ${inverted ? 'text-white' : 'text-black/90'}`}>{s.artist}</span>
                    <span className={`font-mono text-[9px] uppercase tracking-[0.1em] ${inverted ? 'text-white/60' : 'text-black/40'}`}>{s.date}</span>
                  </>
                );
                return (
                  <li key={s.freq}>
                    <button
                      onClick={() => tune(i)}
                      aria-pressed={i === index}
                      data-sfx="hover-only"
                      className="relative flex w-full items-center gap-3 px-2 py-2.5 text-left cursor-pointer"
                    >
                      {row(false)}
                      <span aria-hidden className={`${wipe(i === index)} flex items-center gap-3 px-2 py-2.5`}>
                        {row(true)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <button
              onClick={off}
              data-sfx="hover-only"
              className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-black/45 cursor-pointer"
            >
              switch off
            </button>
          </div>
        </motion.section>
      )}
    </>
  );
}

/** The notice's text: a red square breathing in and out, the line, and the signal count. */
function Notice({ text, count, inverted = false }: { text: string; count: number; inverted?: boolean }) {
  return (
    <>
      {/* Size and colour inline so the square shows even if a stylesheet is late. */}
      <motion.span
        className="shrink-0"
        style={{ width: 6, height: 6, backgroundColor: '#dc2626' }}
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span>{text}</span>
      <span className={`tabular-nums ${inverted ? 'text-white/70' : 'text-black/45'}`}>[{count}]</span>
    </>
  );
}

/** Five bars that breathe while a show is in, flat otherwise. */
function SignalBars({ on, inverted = false }: { on: boolean; inverted?: boolean }) {
  const heights = [3, 5, 8, 5, 3];
  return (
    <span className="flex h-2 shrink-0 items-end gap-px" aria-hidden>
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className={`w-[2px] ${inverted ? 'bg-white' : 'bg-black'}`}
          style={{ height: h }}
          animate={on ? { opacity: [0.35, 1, 0.35] } : { opacity: 0.25 }}
          transition={on ? { duration: 0.9, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' } : { duration: 0.2 }}
        />
      ))}
    </span>
  );
}

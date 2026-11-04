/**
 * UI sound effects (public/sounds). Web Audio rather than <audio> elements:
 * decoded buffers start with no perceptible delay and can overlap, which
 * matters for hover sounds fired as the pointer sweeps along the nav.
 *
 * Browsers won't start audio before the visitor has interacted with the page.
 * The files are fetched and decoded straight away (preloadSound — decoding
 * needs no permission, and AudioBuffers work in any context), and the playing
 * context is created on the first tap, click or key (unlockSound), so even
 * that first click is heard. Anything before it is silently dropped.
 *
 * Ambience: a boot-up sound when the visitor tunes in (SceneLoader's tap),
 * fading into a drone that loops for the rest of the visit. The drone is
 * looped by overlapping copies with crossfades rather than a plain loop —
 * MP3s carry a sliver of silence at each end, which a plain loop would click
 * over, and a drone hides a crossfade completely. It fades out while the
 * radio is playing a show (duckAmbience).
 *
 * Mute (the header's sound toggle) silences everything here and is
 * remembered on this device.
 */

export type Sfx = 'hover' | 'press' | 'panel-open' | 'panel-close';

const FILES: Record<Sfx, string> = {
  hover: '/sounds/hover.wav',
  press: '/sounds/press.wav',
  'panel-open': '/sounds/panel-open.wav',
  'panel-close': '/sounds/panel-close.wav',
};

// Hover fires constantly, so it sits well under the deliberate actions.
const VOLUME: Record<Sfx, number> = {
  hover: 0.3,
  press: 0.55,
  'panel-open': 0.55,
  'panel-close': 0.55,
};

// Back-to-back hovers closer than this collapse into one, so a fast sweep
// across the nav ticks rather than buzzes.
const HOVER_GAP_MS = 45;

const AMBIENCE_FILES = { boot: '/sounds/bootup.mp3', drone: '/sounds/drone.mp3' } as const;
type Ambience = keyof typeof AMBIENCE_FILES;
const BOOT_LEVEL = 0.7;
const DRONE_LEVEL = 0.9;
// The drone comes in under the end of the boot-up sound, this many seconds early.
const BOOT_OVERLAP = 2.5;
// Each copy of the drone crossfades into the next over this long.
const LOOP_XFADE = 3;

let ctx: AudioContext | null = null;
// master: everything (mute). output: UI sounds. ambience: boot-up + drone (ducking).
let master: GainNode | null = null;
let output: GainNode | null = null;
let ambience: GainNode | null = null;
const buffers = new Map<Sfx, AudioBuffer>();
const ambienceBuffers = new Map<Ambience, AudioBuffer>();
let lastHover = 0;
let ambienceStarted = false;
let ducked = false;

let preloading = false;

/** Fetch and decode every sound. Safe to call before any interaction. */
export function preloadSound(): void {
  if (typeof window === 'undefined' || preloading || !('OfflineAudioContext' in window)) return;
  preloading = true;
  // An offline context decodes without asking to play anything.
  const decoder = new OfflineAudioContext(1, 1, 44100);
  const load = <K,>(name: K, url: string, into: Map<K, AudioBuffer>) =>
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => decoder.decodeAudioData(data))
      .then((buf) => into.set(name, buf))
      .catch(() => {
        // A missing or undecodable file just means that sound stays silent.
      });
  for (const [name, url] of Object.entries(FILES) as [Sfx, string][]) load(name, url, buffers);
  for (const [name, url] of Object.entries(AMBIENCE_FILES) as [Ambience, string][]) load(name, url, ambienceBuffers);
}

/** Create (or wake) the playing context. Call from a user gesture. */
export function unlockSound(): void {
  if (typeof window === 'undefined') return;
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  output = ctx.createGain();
  output.connect(master);
  ambience = ctx.createGain();
  ambience.gain.value = ducked ? 0 : 1;
  ambience.connect(master);
}

// ------------------------------------------------------------------ ambience

/**
 * Tune in: the boot-up sound, then the drone looping under the site. Call from
 * the gesture that boots the site (after unlockSound). Once per visit.
 */
export function startAmbience(): void {
  if (!ctx || !ambience || ambienceStarted) return;
  ambienceStarted = true;
  const t0 = ctx.currentTime + 0.05;
  const boot = ambienceBuffers.get('boot');
  if (boot) {
    const src = ctx.createBufferSource();
    src.buffer = boot;
    const g = ctx.createGain();
    // Its tail fades as the drone rises underneath.
    const end = t0 + boot.duration;
    g.gain.setValueAtTime(BOOT_LEVEL, t0);
    g.gain.setValueAtTime(BOOT_LEVEL, end - BOOT_OVERLAP);
    g.gain.linearRampToValueAtTime(0, end);
    src.connect(g).connect(ambience);
    src.start(t0);
    scheduleDrone(end - BOOT_OVERLAP, BOOT_OVERLAP);
  } else {
    scheduleDrone(t0, 4);
  }
}

/** One copy of the drone from `at`, fading in over `fadeIn`; queues the next. */
function scheduleDrone(at: number, fadeIn: number): void {
  if (!ctx || !ambience) return;
  const buf = ambienceBuffers.get('drone');
  if (!buf) {
    // Still downloading on a slow connection: try again shortly.
    window.setTimeout(() => scheduleDrone(Math.max(at, ctx!.currentTime + 0.05), 4), 400);
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  const end = at + buf.duration;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(DRONE_LEVEL, at + fadeIn);
  g.gain.setValueAtTime(DRONE_LEVEL, end - LOOP_XFADE);
  g.gain.linearRampToValueAtTime(0, end);
  src.connect(g).connect(ambience);
  src.start(at);
  src.stop(end);
  // Queue the next copy a second before it's due to start.
  const next = end - LOOP_XFADE;
  window.setTimeout(() => scheduleDrone(next, LOOP_XFADE), Math.max(0, (next - ctx.currentTime - 1) * 1000));
}

/** Fade the ambience out (true) or back in (false) — e.g. under the radio. */
export function duckAmbience(on: boolean): void {
  ducked = on;
  if (!ctx || !ambience) return;
  ambience.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, on ? 0.35 : 0.8);
}

// ---------------------------------------------------------------------- mute

const MUTE_KEY = 'da-sound-muted';
let muted = (() => {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();
const muteListeners = new Set<() => void>();

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    window.localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    // Private mode or blocked storage: it just won't be remembered.
  }
  if (ctx && master) master.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.15);
  muteListeners.forEach((l) => l());
}

/** For useSyncExternalStore. */
export function subscribeMuted(listener: () => void): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}

export function playSfx(name: Sfx): void {
  if (!ctx || !output || ctx.state !== 'running') return;
  const buf = buffers.get(name);
  if (!buf) return;
  if (name === 'hover') {
    // Touchscreens have no hover. Their taps can still emit pointerover (and
    // R3F's onPointerOver on the tower), which played the hover blip in place
    // of the press — so on a device that can't hover, hover is silent.
    if (window.matchMedia('(hover: none)').matches) return;
    const now = performance.now();
    if (now - lastHover < HOVER_GAP_MS) return;
    lastHover = now;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.value = VOLUME[name];
  src.connect(gain).connect(output);
  src.start();
}

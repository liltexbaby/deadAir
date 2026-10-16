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

let ctx: AudioContext | null = null;
let output: GainNode | null = null;
const buffers = new Map<Sfx, AudioBuffer>();
let lastHover = 0;

let preloading = false;

/** Fetch and decode every sound. Safe to call before any interaction. */
export function preloadSound(): void {
  if (typeof window === 'undefined' || preloading || !('OfflineAudioContext' in window)) return;
  preloading = true;
  // An offline context decodes without asking to play anything.
  const decoder = new OfflineAudioContext(1, 1, 44100);
  for (const [name, url] of Object.entries(FILES) as [Sfx, string][]) {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((data) => decoder.decodeAudioData(data))
      .then((buf) => buffers.set(name, buf))
      .catch(() => {
        // A missing or undecodable file just means that sound stays silent.
      });
  }
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
  output = ctx.createGain();
  output.connect(ctx.destination);
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

/**
 * SoundCloud's Widget API (https://developers.soundcloud.com/docs/api/html5-widget),
 * loaded on demand the first time the radio needs it.
 *
 * The radio keeps one SoundCloud player and retunes it with widget.load()
 * instead of swapping iframes: a player that has already been playing is
 * allowed to start the next show by itself, where a fresh iframe would sit
 * waiting for its play button (always on iOS, often on desktop).
 */
export interface ScWidget {
  bind(event: string, callback: () => void): void;
  load(url: string, options: Record<string, unknown> & { callback?: () => void }): void;
  play(): void;
  pause(): void;
  isPaused(callback: (paused: boolean) => void): void;
  /** 0–100 */
  setVolume(volume: number): void;
}

/**
 * play(), then make sure it took: a play() sent while the player is still
 * fetching the show is dropped, so check back and ask again a few times.
 */
export function startPlaying(w: ScWidget, stillWanted: () => boolean, tries = 5): void {
  if (!stillWanted()) return;
  w.play();
  if (tries <= 1) return;
  window.setTimeout(() => {
    if (!stillWanted()) return;
    w.isPaused((paused) => {
      if (paused) startPlaying(w, stillWanted, tries - 1);
    });
  }, 700);
}

interface ScGlobal {
  Widget: ((iframe: HTMLIFrameElement) => ScWidget) & { Events: { READY: string } };
}

declare global {
  interface Window {
    SC?: ScGlobal;
  }
}

let pending: Promise<ScGlobal> | null = null;

export function loadSoundCloudApi(): Promise<ScGlobal> {
  if (window.SC?.Widget) return Promise.resolve(window.SC);
  pending ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://w.soundcloud.com/player/api.js';
    s.async = true;
    s.onload = () => (window.SC ? resolve(window.SC) : reject(new Error('SoundCloud API missing')));
    s.onerror = () => {
      pending = null;
      reject(new Error('SoundCloud API failed to load'));
    };
    document.head.appendChild(s);
  });
  return pending;
}

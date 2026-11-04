import 'server-only';

import { STATIONS, tuneBand, type Station } from './radio';

/**
 * The radio's stations, from NTS's own listing of the show
 * (https://www.nts.live/shows/deadair-transmissions), via the public JSON the
 * NTS site itself uses. Read with the rest of the home page (app/page.tsx
 * revalidates every few minutes), so a new episode reaches the radio on its
 * own. If NTS is unreachable the built-in list in lib/radio.ts stands in.
 */
const SHOW = 'deadair-transmissions';
const PAGE = 12;

// Episodes whose NTS entry has no SoundCloud upload, but the artist posted
// one: SoundCloud plays and mutes better than Mixcloud in the radio.
const SOUNDCLOUD_OVERRIDES: Record<string, string> = {
  '2025-08-15': 'https://soundcloud.com/janeremover/nts-081425',
};

interface NtsEpisode {
  name?: string;
  broadcast?: string;
  genres?: { value?: string }[];
  audio_sources?: { source?: string; url?: string }[];
  mixcloud?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "deadAir - Transmissions w/ Sydney Runner" -> "Sydney Runner". */
function guestOf(name: string): string {
  let guest = name.replace(/^.*?transmissions\s*w\/\s*/i, '').trim() || name.trim();
  // A few titles are all capitals; bring those down to title case.
  if (guest === guest.toUpperCase()) {
    guest = guest.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  }
  return guest;
}

function toStation(e: NtsEpisode): Station | null {
  const day = e.broadcast?.slice(0, 10) ?? '';
  const [y, m, d] = day.split('-').map(Number);
  const sc = e.audio_sources?.find((a) => a.source === 'soundcloud')?.url?.split('?')[0];
  const soundcloud = SOUNDCLOUD_OVERRIDES[day] ?? sc;
  const mixcloud = !soundcloud && e.mixcloud ? new URL(e.mixcloud).pathname : undefined;
  if (!soundcloud && !mixcloud) return null;
  return {
    freq: '',
    artist: guestOf(e.name ?? 'deadAir Transmissions'),
    date: y ? `${String(d).padStart(2, '0')} ${MONTHS[m - 1]} ${y}` : '',
    tags: (e.genres ?? []).map((g) => g.value ?? '').filter(Boolean).slice(0, 3),
    soundcloud,
    mixcloud,
  };
}

export async function getRadioStations(): Promise<Station[]> {
  try {
    const episodes: NtsEpisode[] = [];
    for (let offset = 0; offset < 120; offset += PAGE) {
      const res = await fetch(
        `https://www.nts.live/api/v2/shows/${SHOW}/episodes?offset=${offset}&limit=${PAGE}`,
        { signal: AbortSignal.timeout(6000) },
      );
      if (!res.ok) throw new Error(`NTS ${res.status}`);
      const body = (await res.json()) as { results?: NtsEpisode[]; metadata?: { resultset?: { count?: number } } };
      episodes.push(...(body.results ?? []));
      const total = body.metadata?.resultset?.count ?? 0;
      if (!body.results?.length || episodes.length >= total) break;
    }
    const stations = episodes.map(toStation).filter((s): s is Station => s !== null);
    return stations.length ? tuneBand(stations) : STATIONS;
  } catch {
    return STATIONS;
  }
}

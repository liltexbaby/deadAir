/**
 * deadAir Transmissions — the label's NTS radio shows, as stations on the
 * home-screen radio (app/components/radio/RadioPlayer.tsx).
 *
 * Preliminary: hardcoded from the old site's /radio page. Newest first, and
 * frequencies climb with age like a dial being turned down the band. Each show
 * is a SoundCloud track or a Mixcloud page.
 */
export interface Station {
  freq: string;
  artist: string;
  date: string;
  tags: string[];
  /** SoundCloud track URL, or… */
  soundcloud?: string;
  /** …a Mixcloud path (/User/show-name/). */
  mixcloud?: string;
}

export const STATIONS: Station[] = [
  { freq: '88.1', artist: 'Jane Remover', date: '27 Feb 2026', tags: ['Experimental Hip Hop', 'Club', 'Hyperpop'], soundcloud: 'https://soundcloud.com/janeremover/nts-260227' },
  { freq: '90.3', artist: 'By Storm', date: '30 Jan 2026', tags: ['Experimental Hip Hop', 'Beats', 'Chopped N Screwed'], soundcloud: 'https://soundcloud.com/user-202286394-991268468/deadair-transmissions-w-storm' },
  { freq: '92.7', artist: 'Blue Harbor Radio', date: '05 Dec 2025', tags: ['Folk', 'Indie Rock'], mixcloud: '/NTSRadio/deadair-transmissions-w-blue-harbor-radio-5th-december-2025/' },
  { freq: '94.5', artist: "Tor's Cabinet", date: '07 Nov 2025', tags: ['Talk'], soundcloud: 'https://soundcloud.com/user-202286394-991268468/deadair-transmissions-w-tors' },
  { freq: '96.9', artist: 'elxnce', date: '12 Sep 2025', tags: ['Experimental Hip Hop', 'Hyperpop', 'Experimental'], soundcloud: 'https://soundcloud.com/elxnce/elxnce-nts-radio' },
  { freq: '99.1', artist: 'Jane Remover', date: '15 Aug 2025', tags: ['Hyperpop'], soundcloud: 'https://soundcloud.com/janeremover/nts-081425' },
  { freq: '101.3', artist: 'Anamanaguchi', date: '18 Jul 2025', tags: ['Glitch', 'Synth Pop', 'Chip Tune'], soundcloud: 'https://soundcloud.com/anamanaguchi/anamanaguchi-nts-radio-071725-deadair-transmissions' },
  { freq: '103.7', artist: 'Photographic Memory', date: '20 Jun 2025', tags: ['Electronica', 'Experimental', 'Indie Rock'], soundcloud: 'https://soundcloud.com/photographic-memory/photographic-memory-nts-mix' },
  { freq: '105.9', artist: 'syzy', date: '23 May 2025', tags: ['Hyperpop', 'Experimental', 'Dark Ambient'], soundcloud: 'https://soundcloud.com/syzymusic/syzy-nts-radio-052225' },
  { freq: '108.0', artist: 'kmoe', date: '25 Apr 2025', tags: ['Techno', 'Hyperpop', 'House'], soundcloud: 'https://soundcloud.com/kmoethekid/nts042425' },
];

/** How the SoundCloud player is set up, for its first load and every retune. */
export const SOUNDCLOUD_OPTIONS = {
  color: '#000000',
  auto_play: true,
  hide_related: true,
  show_comments: false,
  show_user: false,
  show_reposts: false,
  show_teaser: false,
  visual: false,
};

/** The embed for a station, autoplaying (it only loads after the visitor tunes in). */
export function embedFor(s: Station): { src: string; height: number } {
  if (s.mixcloud) {
    return {
      src: `https://www.mixcloud.com/widget/iframe/?hide_cover=1&mini=1&light=1&autoplay=1&feed=${encodeURIComponent(s.mixcloud)}`,
      height: 60,
    };
  }
  const q = new URLSearchParams({ url: s.soundcloud ?? '' });
  for (const [k, v] of Object.entries(SOUNDCLOUD_OPTIONS)) q.set(k, String(v));
  return { src: `https://w.soundcloud.com/player/?${q}`, height: 60 };
}

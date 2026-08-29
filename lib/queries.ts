import 'server-only';

import { createPublicClient } from '@/lib/supabase/public';

/**
 * Read side. Everything here returns a narrow DTO rather than a raw row, so the
 * client bundle never receives columns it has no business seeing.
 */

export interface ReleaseDTO {
  id: string;
  catalogNumber: number;
  /** Pre-formatted 'dA - 01' so the display rule lives in one place. */
  catalogLabel: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  links: { label: string; url: string }[];
}

export interface ManagedArtistDTO {
  id: string;
  name: string;
  externalLabel: string | null;
  imageUrl: string | null;
  contacts: { role: string; label: string; name: string | null; email: string | null; url: string | null }[];
}

export interface EventDTO {
  id: string;
  title: string;
  artist: string | null;
  /** Null for the promo-style entries that carry no date. */
  date: string | null;
  venue: string | null;
  city: string | null;
  ticketUrl: string | null;
  imageUrl: string | null;
  status: string;
}

export interface SiteSettingsDTO {
  aboutText: string | null;
  contactEmail: string | null;
  merchNote: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  storeUrl: string | null;
  credits: string[];
}

export interface SiteContent {
  releases: ReleaseDTO[];
  managedArtists: ManagedArtistDTO[];
  events: EventDTO[];
  settings: SiteSettingsDTO | null;
}

const CONTACT_ROLE_LABELS: Record<string, string> = {
  management: 'mgmt',
  booking: 'booking',
  booking_eu: 'booking (eu)',
  press: 'press',
  label: 'label',
};

/** Storage paths are stored bare; resolve to a public URL at read time. */
function mediaUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/media/${path}`;
}

function catalogLabel(n: number): string {
  return `dA - ${String(n).padStart(2, '0')}`;
}

export async function getReleases(): Promise<ReleaseDTO[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('releases')
    .select(
      'id, catalog_number, title, artist_name_override, cover_path, spotify_url, apple_music_url, bandcamp_url, youtube_url, soundcloud_url, store_url, artists(name)',
    )
    .eq('published', true)
    .order('catalog_number', { ascending: true });

  if (error) throw new Error(`getReleases: ${error.message}`);

  return (data ?? []).map((row) => {
    const artistRel = row.artists as { name: string } | { name: string }[] | null;
    const artistName = Array.isArray(artistRel) ? artistRel[0]?.name : artistRel?.name;

    const candidates: { label: string; url: string | null }[] = [
      { label: 'spotify', url: row.spotify_url },
      { label: 'apple music', url: row.apple_music_url },
      { label: 'bandcamp', url: row.bandcamp_url },
      { label: 'youtube', url: row.youtube_url },
      { label: 'soundcloud', url: row.soundcloud_url },
      { label: 'store', url: row.store_url },
    ];
    const links = candidates
      .filter((c): c is { label: string; url: string } => Boolean(c.url))
      .map(({ label, url }) => ({ label, url }));

    return {
      id: row.id,
      catalogNumber: row.catalog_number,
      catalogLabel: catalogLabel(row.catalog_number),
      title: row.title,
      artist: row.artist_name_override ?? artistName ?? 'unknown',
      coverUrl: mediaUrl(row.cover_path),
      links,
    };
  });
}

export async function getManagedArtists(): Promise<ManagedArtistDTO[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('artists')
    .select('id, name, external_label, image_path, artist_contacts(role, name, email, url, position)')
    .eq('is_managed', true)
    .eq('published', true)
    .order('position', { ascending: true });

  if (error) throw new Error(`getManagedArtists: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    externalLabel: row.external_label,
    imageUrl: mediaUrl(row.image_path),
    contacts: ((row.artist_contacts ?? []) as {
      role: string;
      name: string | null;
      email: string | null;
      url: string | null;
      position: number;
    }[])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        role: c.role,
        label: CONTACT_ROLE_LABELS[c.role] ?? c.role,
        name: c.name,
        email: c.email,
        url: c.url,
      })),
  }));
}

export async function getEvents(): Promise<EventDTO[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('events')
    .select('id, title, event_date, venue, city, ticket_url, image_path, status, position, artists(name)')
    .eq('published', true)
    .order('position', { ascending: true });

  if (error) throw new Error(`getEvents: ${error.message}`);

  return (data ?? []).map((row) => {
    const artistRel = row.artists as { name: string } | { name: string }[] | null;
    return {
      id: row.id,
      title: row.title,
      artist: (Array.isArray(artistRel) ? artistRel[0]?.name : artistRel?.name) ?? null,
      date: row.event_date,
      venue: row.venue,
      city: row.city,
      ticketUrl: row.ticket_url,
      imageUrl: mediaUrl(row.image_path),
      status: row.status,
    };
  });
}

export async function getSiteSettings(): Promise<SiteSettingsDTO | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('site_settings')
    .select('about_text, contact_email, merch_note, instagram_url, youtube_url, store_url, credits')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`getSiteSettings: ${error.message}`);
  if (!data) return null;

  return {
    aboutText: data.about_text,
    contactEmail: data.contact_email,
    merchNote: data.merch_note,
    instagramUrl: data.instagram_url,
    youtubeUrl: data.youtube_url,
    storeUrl: data.store_url,
    credits: Array.isArray(data.credits) ? (data.credits as string[]) : [],
  };
}

/** Single entry point for the public page. */
export async function getSiteContent(): Promise<SiteContent> {
  const [releases, managedArtists, events, settings] = await Promise.all([
    getReleases(),
    getManagedArtists(),
    getEvents(),
    getSiteSettings(),
  ]);

  return { releases, managedArtists, events, settings };
}

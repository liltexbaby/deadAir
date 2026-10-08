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
  /** Pre-filled mail for this artist's contact links; null = site default. */
  emailSubject: string | null;
  emailBody: string | null;
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
  /** PUBLISHING panel. Same shape; the panel just doesn't show contacts. */
  publishingArtists: ManagedArtistDTO[];
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

interface ArtistRow {
  id: string;
  name: string;
  external_label: string | null;
  image_path: string | null;
  is_managed: boolean;
  // Added by migration 0002 — absent until it runs, hence optional.
  is_publishing?: boolean;
  email_subject?: string | null;
  email_body?: string | null;
  artist_contacts: { role: string; name: string | null; email: string | null; url: string | null; position: number }[] | null;
}

/**
 * Both rosters in one query. `artists(*)` plus in-code filtering rather than
 * naming the new columns or filtering on is_publishing server-side: that way
 * this keeps working on a database where migration 0002 hasn't been run yet
 * (the PUBLISHING panel is just empty and prompts fall back to defaults)
 * instead of the whole page erroring on an unknown column.
 */
export async function getRosters(): Promise<{
  managed: ManagedArtistDTO[];
  publishing: ManagedArtistDTO[];
}> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('artists')
    .select('*, artist_contacts(role, name, email, url, position)')
    .eq('published', true)
    .order('position', { ascending: true });

  if (error) throw new Error(`getRosters: ${error.message}`);

  const rows = (data ?? []) as ArtistRow[];
  const toDTO = (row: ArtistRow): ManagedArtistDTO => ({
    id: row.id,
    name: row.name,
    externalLabel: row.external_label,
    imageUrl: mediaUrl(row.image_path),
    contacts: (row.artist_contacts ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        role: c.role,
        label: CONTACT_ROLE_LABELS[c.role] ?? c.role,
        name: c.name,
        email: c.email,
        url: c.url,
      })),
    emailSubject: row.email_subject ?? null,
    emailBody: row.email_body ?? null,
  });

  return {
    managed: rows.filter((r) => r.is_managed).map(toDTO),
    publishing: rows.filter((r) => r.is_publishing === true).map(toDTO),
  };
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
  const [releases, rosters, events, settings] = await Promise.all([
    getReleases(),
    getRosters(),
    getEvents(),
    getSiteSettings(),
  ]);

  return {
    releases,
    managedArtists: rosters.managed,
    publishingArtists: rosters.publishing,
    events,
    settings,
  };
}

/**
 * The section slugs are baked into the `hit_*` mesh `userData` inside
 * public/DA.glb (see ModelViewer's HitProxyUserData). Code and model have to
 * agree, so this stays a hardcoded union — it is deliberately NOT database
 * driven. Staff can edit the *content* of a section, never the set of sections.
 */
export type Section =
  | 'catalog'
  | 'live'
  | 'store'
  | 'contact'
  | 'mgmt'
  | 'gallery';

/** Order shown in the nav (and stepped through by scrolling). */
export const SECTIONS: readonly Section[] = [
  'catalog',
  'live',
  'mgmt',
  'contact',   // PUBLISHING
  'gallery',
  'store',
] as const;

/**
 * What each section is *called* on screen. Decoupled from the slug because the
 * slug is baked into the GLB (hit_contact, cam_contact): the old CONTACT slot
 * now hosts PUBLISHING, and renaming it in code alone would break the tower's
 * click target and camera for that section.
 */
export const SECTION_LABELS: Record<Section, string> = {
  // Title case at the source: the default look uppercases these anyway, and
  // the ?retro skin shows them as written ("Catalog", like SH2's "Status").
  catalog: 'Catalog',
  live: 'Live',
  store: 'Store',
  contact: 'Publishing',
  mgmt: 'Mgmt',
  gallery: 'Gallery',
};

/** The label's Shopify shop; the STORE panel reads its catalogue and links here. */
export const STORE_URL = 'https://deadair.store';

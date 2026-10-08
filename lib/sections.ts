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

/** Order shown in the nav. */
export const SECTIONS: readonly Section[] = [
  'catalog',
  'live',
  'store',
  'contact',
  'mgmt',
  'gallery',
] as const;

/**
 * What each section is *called* on screen. Decoupled from the slug because the
 * slug is baked into the GLB (hit_contact, cam_contact): the old CONTACT slot
 * now hosts PUBLISHING, and renaming it in code alone would break the tower's
 * click target and camera for that section.
 */
export const SECTION_LABELS: Record<Section, string> = {
  catalog: 'catalog',
  live: 'live',
  store: 'store',
  contact: 'publishing',
  mgmt: 'mgmt',
  gallery: 'gallery',
};

/**
 * STORE doesn't open a panel — it goes straight to the shop (client request:
 * "for now"). Clicking it in the nav or on the tower opens this in a new tab.
 */
export const STORE_URL = 'https://deadair.store';

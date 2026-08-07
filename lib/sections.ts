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

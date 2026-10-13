/**
 * STORE panel data, read live from the label's Shopify shop.
 *
 * Shopify publishes every storefront's catalogue at /products.json (no key
 * needed), so the panel shows exactly what deadair.store sells — new drops,
 * sell-outs and price changes follow within the cache window, with nothing to
 * copy or keep in sync by hand. Product pages, images and checkout all stay on
 * Shopify; the panel only links out.
 */

import { STORE_URL } from './sections';

export interface StoreProductDTO {
  id: number;
  title: string;
  /** Shopify `vendor` — on this shop it's always the artist. */
  artist: string;
  /** e.g. "vinyl", "t-shirt" — Shopify `product_type`, lowercased. */
  type: string;
  url: string;
  imageUrl: string | null;
  /** Lowest variant price, e.g. "$14.95". */
  price: string;
  /** True when variants differ in price, so the panel says "from". */
  priceVaries: boolean;
  available: boolean;
}

// Refetched at most this often. Short enough that a sell-out shows up soon,
// long enough that visitors never wait on Shopify.
const STORE_REVALIDATE_SECONDS = 600;

// Not merchandise: Route's shipping-insurance add-on lives in the catalogue.
const EXCLUDED_TYPES = new Set(['insurance']);

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  images: { src: string }[];
  variants: { price: string; available: boolean }[];
}

/** Shopify CDN resizes on the fly; ask for roughly what a grid tile needs. */
function sized(src: string, width: number): string {
  const url = new URL(src);
  url.searchParams.set('width', String(width));
  return url.toString();
}

/**
 * "[ dA - 028 ] Lucy Bedroque - "c" cassette" -> ""c" cassette": the catalog
 * number goes (as on the CATALOG panel), and so does a leading "Artist - ",
 * since the panel already prints the artist above the title.
 */
function cleanTitle(title: string, artist: string): string {
  const t = title.replace(/^\s*\[[^\]]*\]\s*/, '').trim();
  const prefix = `${artist.trim()} - `;
  const stripped = t.toLowerCase().startsWith(prefix.toLowerCase()) ? t.slice(prefix.length).trim() : t;
  return stripped || t;
}

function toDTO(p: ShopifyProduct): StoreProductDTO {
  const prices = p.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n));
  const min = prices.length ? Math.min(...prices) : 0;
  return {
    id: p.id,
    title: cleanTitle(p.title, p.vendor),
    artist: p.vendor.trim(),
    type: p.product_type.trim().toLowerCase(),
    url: `${STORE_URL}/products/${p.handle}`,
    imageUrl: p.images[0] ? sized(p.images[0].src, 800) : null,
    price: `$${min % 1 === 0 ? min.toFixed(0) : min.toFixed(2)}`,
    priceVaries: prices.some((n) => n !== min),
    available: p.variants.some((v) => v.available),
  };
}

/**
 * Every product, newest first (Shopify's order). Never throws: if the shop is
 * unreachable the panel falls back to a plain link rather than taking the
 * whole page down with it.
 */
export async function getStoreProducts(): Promise<StoreProductDTO[] | null> {
  try {
    const all: ShopifyProduct[] = [];
    // 250 is Shopify's page cap; the shop has ~100, so this is one request.
    for (let page = 1; page <= 4; page++) {
      const res = await fetch(`${STORE_URL}/products.json?limit=250&page=${page}`, {
        next: { revalidate: STORE_REVALIDATE_SECONDS },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { products } = (await res.json()) as { products: ShopifyProduct[] };
      all.push(...products);
      if (products.length < 250) break;
    }
    return all
      .filter((p) => !EXCLUDED_TYPES.has(p.product_type.trim().toLowerCase()))
      .map(toDTO);
  } catch (err) {
    console.error('getStoreProducts:', err instanceof Error ? err.message : err);
    return null;
  }
}

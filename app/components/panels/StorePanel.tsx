'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

import type { StoreProductDTO } from '@/lib/store';
import { STORE_URL } from '@/lib/sections';

const ALL = '';

/** Case-insensitive key, so Shopify's "Kuru" and the roster's "kuru" match. */
const keyOf = (name: string) => name.trim().toLowerCase();

/**
 * STORE: everything on deadair.store, in stock first and sold out greyed
 * below, filterable by artist. Each tile links to the product on Shopify.
 *
 * Same visual language as the catalog: square art, mono captions, and the
 * NieR-style dark bar that wipes in under the caption on hover.
 */
export default function StorePanel({
  products: raw,
  knownNames,
}: {
  products: StoreProductDTO[] | null;
  /** Roster spellings ("kmoe", not Shopify's "Kmoe") for the filter labels. */
  knownNames: string[];
}) {
  const [artist, setArtist] = useState(ALL);

  // Artist names in the roster's spelling wherever there is one.
  const products = useMemo(() => {
    const names = new Map(knownNames.map((n) => [keyOf(n), n]));
    return raw?.map((p) => ({ ...p, artist: names.get(keyOf(p.artist)) ?? p.artist })) ?? null;
  }, [raw, knownNames]);

  // One filter entry per artist, most-stocked first so the row leads with
  // the busiest shelves.
  const artists = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    for (const p of products ?? []) {
      const k = keyOf(p.artist);
      const entry = counts.get(k) ?? { label: p.artist, count: 0 };
      entry.count++;
      counts.set(k, entry);
    }
    return [...counts.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [products]);

  if (!products) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">
        couldn’t reach the store right now —{' '}
        <a href={STORE_URL} target="_blank" rel="noopener noreferrer" className="text-black/70 underline underline-offset-4 hover:text-black">
          visit deadair.store ↗
        </a>
      </p>
    );
  }

  const label = (k: string) => artists.find((a) => a.key === k)?.label ?? k;
  const shown = artist === ALL ? products : products.filter((p) => keyOf(p.artist) === artist);
  const inStock = shown.filter((p) => p.available);
  const soldOut = shown.filter((p) => !p.available);

  return (
    <div className="@container w-full">
      {/* Artist filter. Wraps on desktop; on a phone it's one row that scrolls
          sideways, so fifteen artists don't push the products off-screen.
          The -mx/px pair lets the row scroll edge to edge under the panel's
          padding instead of clipping chips at the gutter. */}
      <div
        role="tablist"
        aria-label="Filter by artist"
        className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <FilterChip label="All" count={products.length} selected={artist === ALL} onClick={() => setArtist(ALL)} />
        {artists.map((a) => (
          <FilterChip
            key={a.key}
            label={a.label}
            count={a.count}
            selected={artist === a.key}
            onClick={() => setArtist(a.key)}
          />
        ))}
      </div>

      {/* Keyed on the filter so each switch fades the shelf in fresh. */}
      <motion.div
        key={artist}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="mt-6 border-t border-black/10 pt-6"
      >
        {inStock.length > 0 ? (
          <ProductGrid products={inStock} />
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">
            nothing in stock{artist !== ALL && ` from ${label(artist)}`} right now
          </p>
        )}

        {soldOut.length > 0 && (
          <>
            <div className="mb-6 mt-10 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-black/35">
              sold out
              <span className="h-px flex-1 bg-black/10" />
            </div>
            <ProductGrid products={soldOut} />
          </>
        )}

        <div className="mt-10 border-t border-black/10 pt-5">
          <a
            href={STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/50 transition-colors hover:text-black"
          >
            visit deadair.store ↗
          </a>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Same dark-bar selection as the nav: the bar wipes in from the left over a
 * light copy of the label, and rests on the selected chip.
 */
function FilterChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  const text = 'whitespace-nowrap px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em]';
  const body = (
    <>
      {label} <span className="tabular-nums opacity-50">{count}</span>
    </>
  );
  return (
    <button
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`group relative shrink-0 cursor-pointer ${text} ${selected ? 'text-black' : 'text-black/50 hover:text-black/75'}`}
    >
      {body}
      <span
        aria-hidden
        className={`ui-wipe absolute inset-0 ${text} bg-black/80 text-white transition-[clip-path] ease-[cubic-bezier(0.16,1,0.3,1)] ${
          selected ? '[clip-path:inset(0_0_0_0)] duration-300' : '[clip-path:inset(0_100%_0_0)] duration-200'
        }`}
      >
        {body}
      </span>
    </button>
  );
}

function ProductGrid({ products }: { products: StoreProductDTO[] }) {
  return (
    <div className="grid grid-cols-2 gap-5 @2xl:grid-cols-3 @sm:gap-6">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

function ProductCard({ product: p }: { product: StoreProductDTO }) {
  const soldOut = !p.available;
  return (
    <a href={p.url} target="_blank" rel="noopener noreferrer" className="group block">
      <div className="relative aspect-square overflow-hidden border border-black/15 bg-white/40">
        {p.imageUrl && (
          <Image
            src={p.imageUrl}
            alt={p.title}
            fill
            sizes="(min-width: 1024px) 15vw, (min-width: 640px) 22vw, 45vw"
            // contain, not cover: merch shots are all different shapes, and a
            // shirt with its sleeves cropped off reads as a mistake.
            className={`object-contain p-2 transition-[filter,opacity] duration-300 ${
              soldOut ? 'opacity-55 grayscale group-hover:opacity-80' : ''
            }`}
          />
        )}
        {soldOut && (
          <span className="ui-tag absolute left-0 top-0 bg-black/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-white">
            sold out
          </span>
        )}
      </div>

      {/* Caption with the catalog's hover wipe (CSS group-hover — on touch the
          tap just follows the link). */}
      <div className="relative mt-2 font-mono">
        <Caption product={p} />
        <div
          aria-hidden
          className="ui-wipe absolute inset-0 bg-black/80 transition-[clip-path] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] [clip-path:inset(0_100%_0_0)] group-hover:duration-300 group-hover:[clip-path:inset(0_0_0_0)] group-focus-visible:[clip-path:inset(0_0_0_0)]"
        >
          <Caption product={p} inverted />
        </div>
      </div>
    </a>
  );
}

function Caption({ product: p, inverted = false }: { product: StoreProductDTO; inverted?: boolean }) {
  const dim = !p.available && !inverted;
  return (
    <div className="px-2 py-1.5">
      {/* Artist and price share the small top line, so the title gets the
          full width below — on a phone a price beside it wrapped most titles
          onto three lines. */}
      <div className="flex items-baseline justify-between gap-2">
        <p className={`min-w-0 truncate text-[10px] uppercase tracking-[0.2em] ${inverted ? 'text-white/60' : 'text-black/40'}`}>
          {p.artist}
        </p>
        <p
          className={`shrink-0 text-[11px] tabular-nums ${
            inverted ? 'text-white/80' : dim ? 'text-black/35 line-through' : 'text-black/60'
          }`}
        >
          {p.priceVaries && <span className="text-[9px] uppercase tracking-[0.15em] opacity-70">from </span>}
          {p.price}
        </p>
      </div>
      <p className={`mt-1 text-xs leading-snug ${inverted ? 'text-white' : dim ? 'text-black/45' : 'text-black/90'}`}>
        {p.title}
      </p>
    </div>
  );
}

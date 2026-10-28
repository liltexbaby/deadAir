import Link from 'next/link';
import Image from 'next/image';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { moveGalleryItem } from '@/app/actions/gallery';
import { GALLERY_MANIFEST } from '@/lib/galleryManifest';
import GalleryUploader from './GalleryUploader';

export const dynamic = 'force-dynamic';

function publicUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

const small = 'font-mono text-[10px] uppercase tracking-[0.2em]';

export default async function AdminGallery() {
  await requireAdmin();

  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from('gallery_items')
    .select('id, title, image_path, published, position')
    .order('position', { ascending: true });

  // The table comes from migration 0003. Until it's been run, say so rather
  // than showing a database error.
  if (error) {
    const missing = /does not exist|schema cache/i.test(error.message);
    return (
      <div className="max-w-xl font-mono text-xs leading-relaxed text-white/70">
        {missing ? (
          <>
            <p className={`${small} text-amber-400/80`}>gallery isn’t set up yet</p>
            <p className="mt-3">
              The gallery table hasn’t been created in Supabase. Run{' '}
              <span className="text-white/90">supabase/migrations/0003_gallery.sql</span> in the Supabase SQL editor,
              then reload this page. The site keeps showing the built-in gallery meanwhile.
            </p>
          </>
        ) : (
          <p className="text-red-400/80">failed to load: {error.message}</p>
        )}
      </div>
    );
  }

  const list = items ?? [];

  return (
    <>
      <div className="flex items-baseline justify-between">
        <h2 className={`${small} text-white/40`}>gallery — {list.length}</h2>
      </div>

      <GalleryUploader builtIn={list.length === 0 ? GALLERY_MANIFEST : null} />

      {list.length === 0 ? (
        <p className="mt-8 font-mono text-[11px] text-white/40">
          nothing here yet — while it’s empty the site shows the built-in set of {GALLERY_MANIFEST.length}.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {list.map((item, i) => {
            const up = moveGalleryItem.bind(null, item.id, 'up');
            const down = moveGalleryItem.bind(null, item.id, 'down');
            return (
              <li key={item.id} className="group">
                <Link href={`/admin/gallery/${item.id}`} className="block">
                  <div className="relative aspect-square overflow-hidden border border-white/10 bg-white/[0.03]">
                    <Image
                      src={publicUrl(item.image_path)}
                      alt=""
                      fill
                      sizes="200px"
                      className={`object-cover transition-opacity group-hover:opacity-80 ${item.published ? '' : 'opacity-40'}`}
                    />
                  </div>
                  <p className="mt-1.5 truncate font-mono text-[11px] text-white/80">{item.title}</p>
                </Link>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-mono text-[10px] tabular-nums text-white/30">{String(i + 1).padStart(2, '0')}</span>
                  <form action={up}>
                    <button
                      disabled={i === 0}
                      aria-label="Move earlier"
                      className={`${small} text-white/40 hover:text-white disabled:opacity-20 cursor-pointer`}
                    >
                      ←
                    </button>
                  </form>
                  <form action={down}>
                    <button
                      disabled={i === list.length - 1}
                      aria-label="Move later"
                      className={`${small} text-white/40 hover:text-white disabled:opacity-20 cursor-pointer`}
                    >
                      →
                    </button>
                  </form>
                  {!item.published && <span className={`${small} text-amber-400/70`}>hidden</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

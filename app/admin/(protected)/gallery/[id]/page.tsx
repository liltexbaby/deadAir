import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { deleteGalleryItem, updateGalleryItem } from '@/app/actions/gallery';
import type { ActionState } from '@/app/actions/types';
import GalleryItemForm from './GalleryItemForm';

export const dynamic = 'force-dynamic';

export default async function EditGalleryItem({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const { data: item } = await supabase.from('gallery_items').select('*').eq('id', id).maybeSingle();
  if (!item) notFound();

  async function action(prev: ActionState, formData: FormData) {
    'use server';
    return updateGalleryItem(id, prev, formData);
  }

  async function remove() {
    'use server';
    await deleteGalleryItem(id);
  }

  const src = item.image_path.startsWith('http')
    ? item.image_path
    : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${item.image_path}`;

  return (
    <>
      <div className="flex items-baseline justify-between">
        <Link
          href="/admin/gallery"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors"
        >
          ← gallery
        </Link>
        <form action={remove}>
          <button
            type="submit"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-red-400/60 hover:text-red-400 transition-colors cursor-pointer"
          >
            delete
          </button>
        </form>
      </div>

      <h1 className="mt-6 font-mono text-sm text-white/90">{item.title}</h1>

      <div className="mt-8">
        <GalleryItemForm
          action={action}
          values={{ title: item.title, caption: item.caption ?? '', published: item.published, imageUrl: src }}
        />
      </div>
    </>
  );
}

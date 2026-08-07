import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { updateEvent, deleteEvent } from '@/app/actions/events';
import type { ActionState } from '@/app/actions/types';
import EventForm from '../EventForm';

export const dynamic = 'force-dynamic';

function publicUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const supabase = await createClient();
  const [{ data: event }, { data: artists }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).maybeSingle(),
    supabase.from('artists').select('id, name').order('name'),
  ]);

  if (!event) notFound();

  async function action(prev: ActionState, formData: FormData) {
    'use server';
    return updateEvent(id, prev, formData);
  }

  async function remove() {
    'use server';
    await deleteEvent(id);
  }

  return (
    <>
      <div className="flex items-baseline justify-between">
        <Link
          href="/admin/live"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors"
        >
          ← events
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

      <h1 className="mt-6 font-mono text-sm text-white/90">{event.title}</h1>

      <div className="mt-8">
        <EventForm
          action={action}
          submitLabel="save changes"
          artists={artists ?? []}
          values={{
            title: event.title ?? '',
            artist_id: event.artist_id ?? '',
            event_date: event.event_date ?? '',
            venue: event.venue ?? '',
            city: event.city ?? '',
            country: event.country ?? '',
            ticket_url: event.ticket_url ?? '',
            status: event.status ?? 'announced',
            published: event.published,
            position: event.position ?? 0,
            imageUrl: publicUrl(event.image_path),
          }}
        />
      </div>
    </>
  );
}

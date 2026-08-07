import Link from 'next/link';
import { requireAdmin } from '@/lib/dal';
import { createClient } from '@/lib/supabase/server';
import { createEvent } from '@/app/actions/events';
import EventForm from '../EventForm';

export const dynamic = 'force-dynamic';

export default async function NewEvent() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data: artists }, { data: last }] = await Promise.all([
    supabase.from('artists').select('id, name').order('name'),
    supabase
      .from('events')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <>
      <Link
        href="/admin/live"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors"
      >
        ← events
      </Link>

      <h1 className="mt-6 font-mono text-sm text-white/90">new event</h1>

      <div className="mt-8">
        <EventForm
          action={createEvent}
          submitLabel="create event"
          artists={artists ?? []}
          values={{
            title: '',
            artist_id: '',
            event_date: '',
            venue: '',
            city: '',
            country: '',
            ticket_url: '',
            status: 'announced',
            published: true,
            position: (last?.position ?? 0) + 10,
            imageUrl: null,
          }}
        />
      </div>
    </>
  );
}

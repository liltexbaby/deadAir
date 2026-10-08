'use client';

import { useActionState } from 'react';
import Image from 'next/image';
import type { ActionState } from '@/app/actions/types';
import { compressPickedImage } from '@/lib/compressImage';

const STATUSES = [
  ['announced', 'announced'],
  ['on_sale', 'on sale'],
  ['sold_out', 'sold out'],
  ['cancelled', 'cancelled'],
] as const;

export interface EventFormValues {
  title: string;
  artist_id: string;
  event_date: string;
  venue: string;
  city: string;
  country: string;
  ticket_url: string;
  status: string;
  published: boolean;
  position: number;
  imageUrl: string | null;
}

const inputCls =
  'mt-1.5 w-full bg-transparent border-b border-white/15 focus:border-white/50 outline-none py-1.5 font-mono text-xs text-white/90 transition-colors';
const labelCls = 'block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40';

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 font-mono text-[10px] text-red-400/80">{errors[0]}</p>;
}

export default function EventForm({
  values,
  artists,
  action,
  submitLabel,
}: {
  values: EventFormValues;
  artists: { id: string; name: string }[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-2xl">
      <div>
        <label htmlFor="title" className={labelCls}>
          title
        </label>
        <input id="title" name="title" defaultValue={values.title} className={inputCls} />
        <FieldError errors={fe.title} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div>
          <label htmlFor="artist_id" className={labelCls}>
            artist
          </label>
          <select
            id="artist_id"
            name="artist_id"
            defaultValue={values.artist_id}
            className={`${inputCls} [&>option]:bg-[#0b0b0c]`}
          >
            <option value="">— none —</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <FieldError errors={fe.artist_id} />
        </div>

        <div>
          <label htmlFor="event_date" className={labelCls}>
            date <span className="text-white/20">(optional)</span>
          </label>
          <input
            id="event_date"
            name="event_date"
            type="date"
            defaultValue={values.event_date}
            className={`${inputCls} [color-scheme:dark]`}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-5">
        {(
          [
            ['venue', 'venue'],
            ['city', 'city'],
            ['country', 'country'],
          ] as const
        ).map(([name, label]) => (
          <div key={name}>
            <label htmlFor={name} className={labelCls}>
              {label}
            </label>
            <input id={name} name={name} defaultValue={values[name]} className={inputCls} />
          </div>
        ))}
      </div>

      <div className="mt-5">
        <label htmlFor="ticket_url" className={labelCls}>
          ticket link
        </label>
        <input
          id="ticket_url"
          name="ticket_url"
          defaultValue={values.ticket_url}
          placeholder="https://"
          className={`${inputCls} placeholder:text-white/15`}
        />
        <FieldError errors={fe.ticket_url} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div>
          <label htmlFor="status" className={labelCls}>
            status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={values.status}
            className={`${inputCls} [&>option]:bg-[#0b0b0c]`}
          >
            {STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="position" className={labelCls}>
            sort position
          </label>
          <input
            id="position"
            name="position"
            type="number"
            min={0}
            defaultValue={values.position}
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-8">
        <span className={labelCls}>promo image</span>
        <div className="mt-3 flex items-center gap-5">
          {values.imageUrl && (
            <Image
              src={values.imageUrl}
              alt=""
              width={72}
              height={72}
              className="border border-white/15 object-cover"
            />
          )}
          <input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            // Shrinks big artwork in the browser before it's uploaded.
            onChange={compressPickedImage}
            className="font-mono text-[10px] text-white/50 file:mr-3 file:border file:border-white/20 file:bg-transparent file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.2em] file:text-white/70 hover:file:border-white/40 file:cursor-pointer"
          />
        </div>
      </div>

      <label className="mt-8 flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="published"
          defaultChecked={values.published}
          className="accent-white/80"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          published
        </span>
      </label>

      {state.error && <p className="mt-6 font-mono text-[10px] text-red-400/80">{state.error}</p>}
      {state.ok && <p className="mt-6 font-mono text-[10px] text-emerald-400/80">saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 border border-white/20 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 hover:border-white/50 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
      >
        {pending ? 'saving…' : submitLabel}
      </button>
    </form>
  );
}

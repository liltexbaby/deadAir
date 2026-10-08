'use client';

import { useActionState } from 'react';
import Image from 'next/image';
import type { ActionState } from '@/app/actions/types';
import { compressPickedImage } from '@/lib/compressImage';

export interface ReleaseFormValues {
  id?: string;
  catalog_number: number | '';
  title: string;
  artist_id: string;
  format: string;
  release_date: string;
  spotify_url: string;
  apple_music_url: string;
  bandcamp_url: string;
  youtube_url: string;
  soundcloud_url: string;
  store_url: string;
  published: boolean;
  coverUrl: string | null;
}

const LINK_FIELDS = [
  ['spotify_url', 'spotify'],
  ['apple_music_url', 'apple music'],
  ['bandcamp_url', 'bandcamp'],
  ['youtube_url', 'youtube'],
  ['soundcloud_url', 'soundcloud'],
  ['store_url', 'store'],
] as const;

const inputCls =
  'mt-1.5 w-full bg-transparent border-b border-white/15 focus:border-white/50 outline-none py-1.5 font-mono text-xs text-white/90 transition-colors';
const labelCls = 'block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40';

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 font-mono text-[10px] text-red-400/80">{errors[0]}</p>;
}

export default function ReleaseForm({
  values,
  artists,
  action,
  submitLabel,
}: {
  values: ReleaseFormValues;
  artists: { id: string; name: string }[];
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-2xl">
      <div className="grid grid-cols-[7rem_1fr] gap-5">
        <div>
          <label htmlFor="catalog_number" className={labelCls}>
            cat #
          </label>
          <input
            id="catalog_number"
            name="catalog_number"
            type="number"
            min={1}
            defaultValue={values.catalog_number}
            className={inputCls}
          />
          <FieldError errors={fe.catalog_number} />
        </div>

        <div>
          <label htmlFor="title" className={labelCls}>
            title
          </label>
          <input id="title" name="title" defaultValue={values.title} className={inputCls} />
          <FieldError errors={fe.title} />
        </div>
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
            <option value="">—</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <FieldError errors={fe.artist_id} />
        </div>

        <div>
          <label htmlFor="format" className={labelCls}>
            format
          </label>
          <input
            id="format"
            name="format"
            defaultValue={values.format}
            placeholder="LP / 2xLP / digital"
            className={`${inputCls} placeholder:text-white/20`}
          />
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="release_date" className={labelCls}>
          release date
        </label>
        <input
          id="release_date"
          name="release_date"
          type="date"
          defaultValue={values.release_date}
          className={`${inputCls} [color-scheme:dark]`}
        />
      </div>

      <fieldset className="mt-8">
        <legend className={labelCls}>links</legend>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
          {LINK_FIELDS.map(([name, label]) => (
            <div key={name}>
              <label htmlFor={name} className="font-mono text-[10px] text-white/30">
                {label}
              </label>
              <input
                id={name}
                name={name}
                defaultValue={values[name]}
                placeholder="https://"
                className={`${inputCls} placeholder:text-white/15`}
              />
              <FieldError errors={fe[name]} />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-8">
        <span className={labelCls}>cover</span>
        <div className="mt-3 flex items-center gap-5">
          {values.coverUrl && (
            <Image
              src={values.coverUrl}
              alt=""
              width={72}
              height={72}
              className="border border-white/15 object-cover"
            />
          )}
          <input
            id="cover"
            name="cover"
            type="file"
            accept="image/*"
            // Shrinks big artwork in the browser before it's uploaded.
            onChange={compressPickedImage}
            className="font-mono text-[10px] text-white/50 file:mr-3 file:border file:border-white/20 file:bg-transparent file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.2em] file:text-white/70 hover:file:border-white/40 file:cursor-pointer"
          />
        </div>
        <p className="mt-2 font-mono text-[10px] text-white/25">
          leave empty to keep the current image
        </p>
      </div>

      <label className="mt-8 flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="published"
          defaultChecked={values.published}
          className="accent-white/80"
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          published — visible on the site
        </span>
      </label>

      {state.error && (
        <p className="mt-6 font-mono text-[10px] text-red-400/80">{state.error}</p>
      )}
      {state.ok && (
        <p className="mt-6 font-mono text-[10px] text-emerald-400/80">saved.</p>
      )}

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

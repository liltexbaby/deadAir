'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import type { ActionState } from '@/app/actions/types';

const ROLES = [
  ['management', 'mgmt'],
  ['booking', 'booking'],
  ['booking_eu', 'booking (eu)'],
  ['press', 'press'],
  ['label', 'label'],
] as const;

export interface ContactRow {
  role: string;
  name: string;
  email: string;
  url: string;
}

export interface ArtistFormValues {
  name: string;
  slug: string;
  external_label: string;
  is_managed: boolean;
  published: boolean;
  position: number;
  contacts: ContactRow[];
  imageUrl: string | null;
}

const inputCls =
  'mt-1.5 w-full bg-transparent border-b border-white/15 focus:border-white/50 outline-none py-1.5 font-mono text-xs text-white/90 transition-colors';
const labelCls = 'block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40';

export default function ArtistForm({
  values,
  action,
  submitLabel,
}: {
  values: ArtistFormValues;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const [contacts, setContacts] = useState<ContactRow[]>(values.contacts);
  const fe = state.fieldErrors ?? {};

  const update = (i: number, patch: Partial<ContactRow>) =>
    setContacts((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <form action={formAction} className="max-w-2xl">
      {/* Contacts travel as JSON because the row count is dynamic. */}
      <input type="hidden" name="contacts" value={JSON.stringify(contacts)} />

      <div className="grid grid-cols-2 gap-5">
        <div>
          <label htmlFor="name" className={labelCls}>
            name
          </label>
          <input id="name" name="name" defaultValue={values.name} className={inputCls} />
          {fe.name && <p className="mt-1 font-mono text-[10px] text-red-400/80">{fe.name[0]}</p>}
        </div>

        <div>
          <label htmlFor="slug" className={labelCls}>
            slug
          </label>
          <input id="slug" name="slug" defaultValue={values.slug} className={inputCls} />
          {fe.slug && <p className="mt-1 font-mono text-[10px] text-red-400/80">{fe.slug[0]}</p>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-5">
        <div>
          <label htmlFor="external_label" className={labelCls}>
            external label
          </label>
          <input
            id="external_label"
            name="external_label"
            defaultValue={values.external_label}
            placeholder="e.g. AD93"
            className={`${inputCls} placeholder:text-white/20`}
          />
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

      <div className="mt-6 flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="is_managed"
            defaultChecked={values.is_managed}
            className="accent-white/80"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
            managed — show on the mgmt panel
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
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
      </div>

      <div className="mt-8">
        <span className={labelCls}>portrait</span>
        <div className="mt-3 flex items-center gap-5">
          {values.imageUrl && (
            <Image
              src={values.imageUrl}
              alt=""
              width={56}
              height={56}
              className="border border-white/15 object-cover [image-rendering:pixelated]"
            />
          )}
          <input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            className="font-mono text-[10px] text-white/50 file:mr-3 file:border file:border-white/20 file:bg-transparent file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:uppercase file:tracking-[0.2em] file:text-white/70 hover:file:border-white/40 file:cursor-pointer"
          />
        </div>
        <p className="mt-2 font-mono text-[10px] text-white/25">
          leave empty to keep the current image
        </p>
      </div>

      <fieldset className="mt-9">
        <div className="flex items-baseline justify-between">
          <legend className={labelCls}>contacts</legend>
          <button
            type="button"
            onClick={() =>
              setContacts((rows) => [...rows, { role: 'management', name: '', email: '', url: '' }])
            }
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            + add contact
          </button>
        </div>

        {contacts.length === 0 && (
          <p className="mt-3 font-mono text-[10px] text-white/25">no contacts</p>
        )}

        <div className="mt-4 space-y-4">
          {contacts.map((row, i) => (
            <div key={i} className="grid grid-cols-[8rem_1fr_1.5rem] gap-3 items-end">
              <div>
                <label className="font-mono text-[10px] text-white/30">role</label>
                <select
                  value={row.role}
                  onChange={(e) => update(i, { role: e.target.value })}
                  className={`${inputCls} [&>option]:bg-[#0b0b0c]`}
                >
                  {ROLES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono text-[10px] text-white/30">email</label>
                <input
                  value={row.email}
                  onChange={(e) => update(i, { email: e.target.value })}
                  placeholder="name@example.com"
                  className={`${inputCls} placeholder:text-white/15`}
                />
              </div>

              <button
                type="button"
                onClick={() => setContacts((rows) => rows.filter((_, idx) => idx !== i))}
                aria-label="remove contact"
                className="pb-2 font-mono text-xs text-white/30 hover:text-red-400 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </fieldset>

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

'use client';

import { useActionState } from 'react';
import { updateSettings } from '@/app/actions/settings';
import type { ActionState } from '@/app/actions/types';

export interface SettingsFormValues {
  about_text: string;
  contact_email: string;
  merch_note: string;
  instagram_url: string;
  youtube_url: string;
  store_url: string;
  credits: string[];
}

const inputCls =
  'mt-1.5 w-full bg-transparent border-b border-white/15 focus:border-white/50 outline-none py-1.5 font-mono text-xs text-white/90 transition-colors';
const areaCls =
  'mt-1.5 w-full bg-transparent border border-white/15 focus:border-white/50 outline-none p-3 font-mono text-xs text-white/90 leading-relaxed transition-colors resize-y';
const labelCls = 'block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40';

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="mt-1 font-mono text-[10px] text-red-400/80">{errors[0]}</p>;
}

export default function SettingsForm({ values }: { values: SettingsFormValues }) {
  const [state, formAction, pending] = useActionState(updateSettings, {} as ActionState);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="max-w-2xl">
      <div>
        <label htmlFor="about_text" className={labelCls}>
          about
        </label>
        <textarea
          id="about_text"
          name="about_text"
          rows={3}
          defaultValue={values.about_text}
          className={areaCls}
        />
      </div>

      <div className="mt-6">
        <label htmlFor="contact_email" className={labelCls}>
          general contact email
        </label>
        <input
          id="contact_email"
          name="contact_email"
          defaultValue={values.contact_email}
          className={inputCls}
        />
        <FieldError errors={fe.contact_email} />
      </div>

      <div className="mt-6">
        <label htmlFor="merch_note" className={labelCls}>
          merch note
        </label>
        <textarea
          id="merch_note"
          name="merch_note"
          rows={2}
          defaultValue={values.merch_note}
          className={areaCls}
        />
      </div>

      <fieldset className="mt-8">
        <legend className={labelCls}>links</legend>
        <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4">
          {(
            [
              ['instagram_url', 'instagram'],
              ['youtube_url', 'youtube'],
              ['store_url', 'store'],
            ] as const
          ).map(([name, label]) => (
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
        <label htmlFor="credits" className={labelCls}>
          site credits
        </label>
        <textarea
          id="credits"
          name="credits"
          rows={5}
          defaultValue={values.credits.join('\n')}
          className={areaCls}
        />
        <p className="mt-2 font-mono text-[10px] text-white/25">one name per line</p>
      </div>

      {state.error && <p className="mt-6 font-mono text-[10px] text-red-400/80">{state.error}</p>}
      {state.ok && <p className="mt-6 font-mono text-[10px] text-emerald-400/80">saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 border border-white/20 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 hover:border-white/50 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
      >
        {pending ? 'saving…' : 'save settings'}
      </button>
    </form>
  );
}

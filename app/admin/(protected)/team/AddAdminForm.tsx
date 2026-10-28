'use client';

import { useActionState } from 'react';
import { addAdmin } from '@/app/actions/team';
import type { ActionState } from '@/app/actions/types';

export default function AddAdminForm() {
  const [state, action, pending] = useActionState(addAdmin, {} as ActionState);

  return (
    <form action={action} className="mt-8">
      <label htmlFor="email" className="block font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
        add someone
      </label>
      <div className="mt-1.5 flex items-end gap-5">
        <input
          id="email"
          name="email"
          type="email"
          placeholder="name@example.com"
          className="flex-1 bg-transparent border-b border-white/15 focus:border-white/50 outline-none py-1.5 font-mono text-xs text-white/90 placeholder:text-white/20 transition-colors"
        />
        <button
          type="submit"
          disabled={pending}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 hover:text-white disabled:opacity-40 cursor-pointer"
        >
          {pending ? 'adding…' : 'add'}
        </button>
      </div>
      {state.fieldErrors?.email && <p className="mt-2 font-mono text-[10px] text-red-400/80">{state.fieldErrors.email[0]}</p>}
      {state.error && <p className="mt-2 font-mono text-[10px] text-red-400/80">{state.error}</p>}
      {state.ok && (
        <p className="mt-2 font-mono text-[10px] text-emerald-400/80">
          added — tell them to go to /admin and enter their email for a sign-in link.
        </p>
      )}
    </form>
  );
}

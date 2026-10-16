'use client';

import { useActionState, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { sendInquiry } from '@/app/actions/inquiry';
import type { ActionState } from '@/app/actions/types';
import type { ManagedArtistDTO } from '@/lib/queries';

/** What the visitor has typed. Lifted into MgmtPanel so it survives switching artist. */
export interface InquiryDraft {
  name: string;
  email: string;
  message: string;
}

export const EMPTY_DRAFT: InquiryDraft = { name: '', email: '', message: '' };

const LABEL = 'font-mono text-[10px] uppercase tracking-[0.15em] text-black/35';
// 16px on phones: anything smaller and iOS zooms the page on focus.
// A step more opaque than the panel behind it (white/40 desktop, /70 phone):
// reads as a box to type in without going solid. Square, hairline edge.
const FIELD =
  'ui-field mt-1 block w-full rounded-none border border-black/15 bg-white/50 px-2.5 py-2 font-mono text-base sm:text-xs text-black/90 placeholder:text-black/30 outline-none transition-colors hover:border-black/25 focus:border-black/60 focus:bg-white/75';

/**
 * "Send a message" to an artist's team, in place of listing their addresses.
 * Mono, underline-only fields to match the rest of the panels. One form per
 * artist; the server decides which of their addresses it goes to.
 */
export default function InquiryForm({
  artist,
  draft,
  onDraft,
}: {
  artist: ManagedArtistDTO;
  draft: InquiryDraft;
  onDraft: (next: InquiryDraft) => void;
}) {
  const id = useId();
  const canMessage = artist.contacts.some((c) => c.messageable);
  const links = artist.contacts.filter((c) => !c.messageable && c.url);
  const set = (patch: Partial<InquiryDraft>) => onDraft({ ...draft, ...patch });

  // Remembers what was submitted, so a field's error clears once it's edited.
  type State = ActionState & { sent?: Pick<InquiryDraft, 'name' | 'email' | 'message'> };
  const [state, action, pending] = useActionState(async (prev: State, data: FormData): Promise<State> => {
    const result = await sendInquiry(prev, data);
    if (result.ok) onDraft({ ...draft, message: '' });
    return { ...result, sent: { name: draft.name, email: draft.email, message: draft.message } };
  }, {});
  // useActionState can't be reset, so "send another" just marks this result seen.
  const [dismissed, setDismissed] = useState<ActionState | null>(null);
  const sent = state.ok && state !== dismissed;

  if (!canMessage && links.length === 0) return null;
  const err = (field: 'name' | 'email' | 'message') =>
    state.sent?.[field] === draft[field] ? state.fieldErrors?.[field]?.[0] : undefined;
  const prompt = artist.emailBody?.replaceAll('{artist}', artist.name) ?? `what’s it about?`;

  return (
    <section className="mt-6 border-t border-black/10 pt-4" aria-label={`Message ${artist.name}`}>
      {canMessage && (
        <AnimatePresence mode="wait" initial={false}>
          {sent ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.3, 1] }}
              transition={{ duration: 0.35, times: [0, 0.3, 0.5, 1] }}
              role="status"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/80">
                <span className="mr-2 inline-block h-1.5 w-1.5 rotate-45 bg-emerald-700/80 align-middle" />
                signal received
              </p>
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-black/55">
                {artist.name}’s team will reply to {draft.email || 'you'}.
              </p>
              <button
                type="button"
                onClick={() => setDismissed(state)}
                className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-black/45 transition-colors hover:text-black cursor-pointer"
              >
                ‹ send another
              </button>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              action={action}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              noValidate
              className="space-y-4"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/40">
                send a message
              </p>
              <input type="hidden" name="artistId" value={artist.id} />

              <div className="grid gap-4 @sm:grid-cols-2">
                <Field label="name" htmlFor={`${id}-name`} error={err('name')}>
                  <input
                    id={`${id}-name`}
                    name="name"
                    autoComplete="name"
                    required
                    value={draft.name}
                    onChange={(e) => set({ name: e.target.value })}
                    className={FIELD}
                  />
                </Field>
                <Field label="email" htmlFor={`${id}-email`} error={err('email')}>
                  <input
                    id={`${id}-email`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={draft.email}
                    onChange={(e) => set({ email: e.target.value })}
                    className={FIELD}
                  />
                </Field>
              </div>

              <Field label="message" htmlFor={`${id}-message`} error={err('message')}>
                <textarea
                  id={`${id}-message`}
                  name="message"
                  required
                  rows={4}
                  placeholder={prompt}
                  value={draft.message}
                  onChange={(e) => set({ message: e.target.value })}
                  className={`${FIELD} resize-none`}
                />
              </Field>

              {/* Honeypot — off-screen rather than display:none, which some bots skip. */}
              <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <input name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
              </div>

              <div className="flex items-center justify-between gap-4">
                <p role="alert" className="min-w-0 font-mono text-[10px] text-red-800/70">
                  {state.error}
                </p>
                <button
                  type="submit"
                  disabled={pending}
                  className="-my-2 shrink-0 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-black/70 transition-colors hover:text-black disabled:text-black/35 cursor-pointer disabled:cursor-wait"
                >
                  {pending ? (
                    <>
                      transmitting<span className="ml-1 inline-block animate-pulse">▮</span>
                    </>
                  ) : (
                    'transmit ›'
                  )}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      )}

      {/* Contacts with a website instead of an address (e.g. a booking agency). */}
      {links.length > 0 && (
        <ul className="mt-4 space-y-1">
          {links.map((c) => (
            <li key={`${c.role}-${c.url}`} className="flex gap-3 font-mono text-[11px]">
              <span className={`${LABEL} w-20 shrink-0 leading-[1.6]`}>{c.label}</span>
              <a
                href={c.url!}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 break-all text-black/70 border-b border-transparent transition-colors hover:border-black/40 hover:text-black"
              >
                {c.name ?? c.url} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={LABEL}>
        {label}
      </label>
      {children}
      {error && <p className="mt-1 font-mono text-[10px] text-red-800/70">{error}</p>}
    </div>
  );
}

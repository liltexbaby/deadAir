'use server';

import { z } from 'zod';
import { createPublicClient } from '@/lib/supabase/public';
import type { ActionState } from './types';

/**
 * Public contact form on the MGMT panel: a visitor messages an artist's team
 * without ever seeing their address. The browser only sends the artist id; the
 * recipient is resolved here (their management address, else the first one
 * listed), so the form can't be pointed at an arbitrary inbox.
 *
 * Delivery is NOT wired up yet — see deliver() below.
 */

const InquirySchema = z.object({
  artistId: z.uuid(),
  name: z.string().trim().min(1, 'tell us who you are').max(120),
  email: z.email('that email doesn’t look right').max(200),
  message: z
    .string()
    .trim()
    .min(10, 'a little more than that')
    .max(5000, 'keep it under 5000 characters'),
  // Honeypot: hidden from people, filled in by naive bots.
  website: z.string().max(0).optional(),
});

// Not exported: every export of a 'use server' module becomes an action
// reference (see ./types.ts).
type Inquiry = {
  artistName: string;
  to: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  message: string;
};

export async function sendInquiry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = InquirySchema.safeParse({
    artistId: formData.get('artistId'),
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
    website: formData.get('website') ?? undefined,
  });
  if (!parsed.success) {
    // A tripped honeypot gets a fake success, so the bot learns nothing.
    if (parsed.error.issues.some((i) => i.path[0] === 'website')) return { ok: true };
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const input = parsed.data;

  const supabase = createPublicClient();
  const { data: artist } = await supabase
    .from('artists')
    .select('*, artist_contacts(role, email, position)')
    .eq('id', input.artistId)
    .eq('published', true)
    .maybeSingle();
  if (!artist) return { error: 'couldn’t find that artist' };

  const contacts = ((artist.artist_contacts ?? []) as { role: string; email: string | null; position: number }[])
    .filter((c) => c.email)
    .sort((a, b) => a.position - b.position);
  const to = contacts.find((c) => c.role === 'management')?.email ?? contacts[0]?.email;
  if (!to) return { error: 'this artist isn’t taking messages yet' };

  // Same per-artist subject the old mailto links used; {artist} -> name.
  const subject = artist.email_subject
    ? String(artist.email_subject).replaceAll('{artist}', artist.name)
    : `inquiry — ${artist.name}`;

  return deliver({
    artistName: artist.name,
    to,
    subject,
    fromName: input.name,
    fromEmail: input.email,
    message: input.message,
  });
}

/**
 * TODO(backend): send the email. Until then, development logs the message and
 * reports success so the form can be tried end to end; production refuses
 * rather than silently dropping someone's message.
 */
async function deliver(inquiry: Inquiry): Promise<ActionState> {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[inquiry] would send:', { ...inquiry, to: '(redacted)' });
    return { ok: true };
  }
  return { error: 'messages can’t be sent just yet — please try again soon' };
}

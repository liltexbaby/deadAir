'use server';

import { z } from 'zod';
import { createPublicClient } from '@/lib/supabase/public';
import type { ActionState } from './types';

/**
 * Public contact form on the MGMT panel: a visitor messages an artist's team
 * without ever seeing their address. The browser only sends the artist id; the
 * recipients are resolved here, so the form can't be pointed at an arbitrary
 * inbox. Every message goes to the label's mgmt inbox, with the artist's own
 * management contacts (as set in /admin/artists) CC'd. Booking agents
 * (outside agencies) are left off.
 *
 * Sent through Resend — see deliver() below.
 */

// Every message goes here; INQUIRY_TO on the host changes it.
const MGMT_INBOX = 'mgmt@deadairrecords.com';

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
  cc: string[];
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
  // Lowercased so "Lucas@" and "lucas@" don't both get a copy.
  const management = contacts
    .filter((c) => c.role === 'management')
    .map((c) => c.email!.trim().toLowerCase());
  if (management.length === 0) return { error: 'this artist isn’t taking messages yet' };
  const to = (process.env.INQUIRY_TO || MGMT_INBOX).trim().toLowerCase();
  const cc = [...new Set(management)].filter((e) => e !== to);

  // Same per-artist subject the old mailto links used; {artist} -> name.
  const subject = artist.email_subject
    ? String(artist.email_subject).replaceAll('{artist}', artist.name)
    : `inquiry — ${artist.name}`;

  return deliver({
    artistName: artist.name,
    to,
    cc,
    // The sender's name goes on the end: Gmail threads mail with the same
    // subject, so without it every message about one artist (from anyone)
    // landed in a single conversation. Repeat messages from the same person
    // still group together.
    subject: `${subject} — from ${input.name.replace(/[\r\n]+/g, ' ').slice(0, 80)}`,
    fromName: input.name,
    fromEmail: input.email,
    message: input.message,
  });
}

/**
 * Sends through Resend's HTTP API (https://resend.com). Needs two settings on
 * the host:
 *   RESEND_API_KEY  — from the Resend dashboard
 *   INQUIRY_FROM    — a sender on a domain verified in Resend, e.g.
 *                     "deadAir <messages@deadairrecords.com>"
 * Replies go straight to the visitor (reply_to), so the artist's team just
 * hits reply. Without the settings, development logs the message and reports
 * success so the form can be tried end to end; production refuses rather than
 * silently dropping someone's message.
 */
async function deliver(inquiry: Inquiry): Promise<ActionState> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.INQUIRY_FROM;
  if (!key || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[inquiry] would send:', { ...inquiry, to: '(redacted)', cc: `(${inquiry.cc.length} redacted)` });
      return { ok: true };
    }
    return { error: 'messages can’t be sent just yet — please try again soon' };
  }

  const text = [
    `${inquiry.fromName} <${inquiry.fromEmail}> sent a message about ${inquiry.artistName} through deadAir:`,
    '',
    inquiry.message,
    '',
    '—',
    'Reply to this email to answer them directly.',
  ].join('\n');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [inquiry.to],
        ...(inquiry.cc.length ? { cc: inquiry.cc } : {}),
        reply_to: `${inquiry.fromName.replace(/[<>"]/g, '')} <${inquiry.fromEmail}>`,
        subject: inquiry.subject,
        text,
      }),
    });
    if (!res.ok) {
      console.error('[inquiry] resend refused:', res.status, (await res.text()).slice(0, 300));
      return { error: 'that didn’t go through — please try again in a bit' };
    }
  } catch (err) {
    console.error('[inquiry] send failed:', err);
    return { error: 'that didn’t go through — please try again in a bit' };
  }
  return { ok: true };
}

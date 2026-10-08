-- Publishing roster + per-artist email prompts.
--
-- Run once in the Supabase SQL editor (Dashboard -> SQL -> New query).
-- Additive only: new nullable/defaulted columns, nothing dropped or rewritten,
-- so it's safe to run on the live database and safe to run twice.
--
-- Existing RLS policies on public.artists already cover these columns: public
-- read of published rows, admin-only writes.

-- Drives the PUBLISHING panel, the same way is_managed drives MGMT. An artist
-- can be both.
alter table public.artists
  add column if not exists is_publishing boolean not null default false;

-- Pre-filled subject/body when a visitor clicks one of this artist's contact
-- emails on the MGMT panel. Both optional; the site falls back to a generic
-- "<role> inquiry — <artist>" subject. `{artist}` is replaced with the name.
alter table public.artists
  add column if not exists email_subject text;

alter table public.artists
  add column if not exists email_body text;

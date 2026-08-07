-- deadAir content schema
--
-- Read model: the public site reads published rows with the anon key.
-- Write model: only rows in admin_users may write anything, enforced by RLS.
-- Server Actions are reachable by direct POST, so RLS is the backstop that has
-- to hold even if an application-level guard is ever missed.

-- ---------------------------------------------------------------- helpers

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- tables

-- Staff allowlist. A Supabase account existing is NOT enough to write; the
-- user id must also appear here.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email   text not null,
  created_at timestamptz not null default now()
);

-- Shared across catalog and mgmt. Some artists have releases but no management
-- entry (Quadeca), others are managed with no release yet (Dagmar Zuniga).
create table if not exists public.artists (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  external_label text,                        -- e.g. 'R&R Digital', 'AD93'
  image_path     text,
  is_managed     boolean not null default false,  -- drives the MGMT panel
  published      boolean not null default true,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.releases (
  id                    uuid primary key default gen_random_uuid(),
  catalog_number        integer not null unique,   -- 1..25, rendered as 'dA - 01'
  title                 text not null,
  artist_id             uuid references public.artists(id) on delete restrict,
  artist_name_override  text,                      -- splits / various artists
  release_date          date,
  format                text,                      -- 'LP', '2xLP', 'EP', variant name
  cover_path            text,
  spotify_url           text,
  apple_music_url       text,
  bandcamp_url          text,
  youtube_url           text,
  soundcloud_url        text,
  store_url             text,
  published             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Variable number of contacts per artist (kuru has two management emails and no
-- booking; Dagmar has EU-specific booking), so this is a child table rather
-- than columns.
create table if not exists public.artist_contacts (
  id        uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.artists(id) on delete cascade,
  role      text not null check (role in ('management','booking','booking_eu','press','label')),
  name      text,
  email     text,
  url       text,
  position  integer not null default 0,
  created_at timestamptz not null default now()
);

-- event_date is intentionally nullable: the current live page has promo cards
-- with a ticket link and no date at all.
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid references public.artists(id) on delete set null,
  title       text not null,
  event_date  date,
  venue       text,
  city        text,
  country     text,
  ticket_url  text,
  image_path  text,
  status      text not null default 'announced'
                check (status in ('announced','on_sale','sold_out','cancelled')),
  published   boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.site_settings (
  id            integer primary key default 1 check (id = 1),
  about_text    text,
  contact_email text,
  merch_note    text,
  instagram_url text,
  youtube_url   text,
  store_url     text,
  credits       jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

create index if not exists releases_catalog_number_idx on public.releases (catalog_number);
create index if not exists releases_artist_idx         on public.releases (artist_id);
create index if not exists artist_contacts_artist_idx  on public.artist_contacts (artist_id);
create index if not exists events_date_idx             on public.events (event_date);

drop trigger if exists artists_updated_at on public.artists;
create trigger artists_updated_at before update on public.artists
  for each row execute function public.set_updated_at();

drop trigger if exists releases_updated_at on public.releases;
create trigger releases_updated_at before update on public.releases
  for each row execute function public.set_updated_at();

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- authz

-- security definer so the check itself bypasses RLS on admin_users, which would
-- otherwise recurse (reading admin_users requires being an admin).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- ---------------------------------------------------------------- RLS

alter table public.admin_users     enable row level security;
alter table public.artists         enable row level security;
alter table public.releases        enable row level security;
alter table public.artist_contacts enable row level security;
alter table public.events          enable row level security;
alter table public.site_settings   enable row level security;

-- admin_users is staff PII; never publicly readable.
drop policy if exists admin_users_admin_read on public.admin_users;
create policy admin_users_admin_read on public.admin_users
  for select using (public.is_admin());

-- Public read is limited to published rows.
drop policy if exists artists_public_read on public.artists;
create policy artists_public_read on public.artists
  for select using (published or public.is_admin());

drop policy if exists releases_public_read on public.releases;
create policy releases_public_read on public.releases
  for select using (published or public.is_admin());

-- Contacts inherit their artist's visibility.
drop policy if exists artist_contacts_public_read on public.artist_contacts;
create policy artist_contacts_public_read on public.artist_contacts
  for select using (
    public.is_admin() or exists (
      select 1 from public.artists a
      where a.id = artist_contacts.artist_id and a.published
    )
  );

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select using (published or public.is_admin());

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select using (true);

-- Writes: admins only, on every table. `for all` covers insert/update/delete;
-- both using and with check are required or inserts slip through.
do $$
declare t text;
begin
  foreach t in array array['artists','releases','artist_contacts','events','site_settings']
  loop
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format(
      'create policy %I_admin_write on public.%I for all
         using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------- storage

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists media_admin_write on storage.objects;
create policy media_admin_write on storage.objects
  for all using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

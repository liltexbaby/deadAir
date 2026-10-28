-- GALLERY panel content, editable like the other sections.
--
-- Until this table exists (and has rows) the site shows the built-in set in
-- lib/galleryManifest.ts, so running this is safe at any time: the switch
-- happens as soon as the first published row is added. To move the current
-- set in, upload public/gallery/* to the `media` bucket under gallery/ and
-- insert one row per image (scripts can do this; see lib/galleryManifest.ts
-- for titles, paths and sizes).
--
-- Self-contained: it (re)defines the two helpers it uses, which 0001 also
-- creates, because a database set up some other way may not have them
-- ("function public.set_updated_at() does not exist"). Both are
-- `create or replace` with 0001's exact definitions, so this changes nothing
-- where they already exist. Safe to run more than once.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- security definer so the check itself bypasses RLS on admin_users, which
-- would otherwise recurse (reading admin_users requires being an admin).
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

create table if not exists public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  caption     text,
  -- Storage path in the `media` bucket (or a full URL), like events.image_path.
  image_path  text not null,
  -- Pixel size of the web copy, so the grid can reserve the right shape
  -- before the image loads. Optional; square is assumed without it.
  width       integer,
  height      integer,
  published   boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists gallery_items_position_idx on public.gallery_items (position);

drop trigger if exists gallery_items_updated_at on public.gallery_items;
create trigger gallery_items_updated_at before update on public.gallery_items
  for each row execute function public.set_updated_at();

alter table public.gallery_items enable row level security;

drop policy if exists gallery_items_public_read on public.gallery_items;
create policy gallery_items_public_read on public.gallery_items
  for select using (published or public.is_admin());

drop policy if exists gallery_items_admin_write on public.gallery_items;
create policy gallery_items_admin_write on public.gallery_items for all
  using (public.is_admin()) with check (public.is_admin());

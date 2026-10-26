-- GALLERY panel content, editable like the other sections.
--
-- Until this table exists (and has rows) the site shows the built-in set in
-- lib/galleryManifest.ts, so running this is safe at any time: the switch
-- happens as soon as the first published row is added. To move the current
-- set in, upload public/gallery/* to the `media` bucket under gallery/ and
-- insert one row per image (scripts can do this; see lib/galleryManifest.ts
-- for titles, paths and sizes).

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

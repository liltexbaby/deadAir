-- deadAir content seed, scraped from deadairrecords.com.
-- Idempotent: safe to re-run.
--
-- cover_path values are the original filenames from the live site. They are
-- placeholders until scripts/import-covers.ts downloads each image and uploads
-- it to the `media` storage bucket, which rewrites these to storage paths.

-- ---------------------------------------------------------------- artists

insert into public.artists (slug, name, external_label, is_managed, position) values
  ('jane-remover',          'Jane Remover',           null,           true,  10),
  ('dazegxd',               'Dazegxd',                null,           true,  20),
  ('kuru',                  'kuru',                   null,           true,  30),
  ('kmoe',                  'kmoe',                   null,           true,  40),
  ('lucy-bedroque',         'Lucy Bedroque',          null,           true,  50),
  ('racing-mount-pleasant', 'Racing Mount Pleasant',  'R&R Digital',  true,  60),
  ('dagmar-zuniga',         'Dagmar Zuniga',          'AD93',         true,  70),
  ('quinn',                 'quinn',                  null,           false, 80),
  ('quadeca',               'Quadeca',                null,           false, 90),
  ('quannnic',              'quannnic',               null,           false, 100),
  ('underscores',           'underscores',            null,           false, 110),
  ('prostitute',            'Prostitute',             null,           false, 120),
  ('venturing',             'venturing',              null,           false, 130),
  ('operelly',              'Operelly',               null,           false, 140),
  ('photographic-memory',   'Photographic Memory',    null,           false, 150),
  ('ninajirachi',           'Ninajirachi',            null,           false, 160),
  ('by-storm',              'By Storm',               null,           false, 170)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------- releases

insert into public.releases
  (catalog_number, title, artist_id, cover_path, spotify_url, apple_music_url)
values
  (1,  'Frailty',                                     (select id from public.artists where slug='jane-remover'),          'frailty.jpg',
       'https://open.spotify.com/album/0Pm3i5huHlt1mjSLxyA1Re', 'https://music.apple.com/us/album/frailty/1744965581'),
  (2,  'vKiSS',                                       (select id from public.artists where slug='dazegxd'),               'vkiss.jpg',
       'https://open.spotify.com/album/3jmnykN1KMl8hfSMmzTEwN', 'https://music.apple.com/us/album/vkiss/1745761637'),
  (3,  'quinn',                                       (select id from public.artists where slug='quinn'),                 'quinn.png',
       'https://open.spotify.com/album/75n3winyXKHLUCOhiSRkA2', null),
  (4,  'I Didn''t Mean To Haunt You',                 (select id from public.artists where slug='quadeca'),               'idmthy.png',
       'https://open.spotify.com/album/3c0NHNo2Gn0X7uARad3hGv', 'https://music.apple.com/us/album/i-didnt-mean-to-haunt-you/1652831428'),
  (5,  'Kenopsia',                                    (select id from public.artists where slug='quannnic'),              'kenopsia.png',
       'https://open.spotify.com/album/72ilxCJIul1iivwSTAdoNp', 'https://music.apple.com/us/album/kenopsia/1673557437'),
  (6,  'Census Designated',                           (select id from public.artists where slug='jane-remover'),          'censusdesignated.jpg',
       'https://open.spotify.com/album/4ZtC6HhG26hK47TkNhrWT1', 'https://music.apple.com/us/album/census-designated/1745245207'),
  (7,  'Stepdream',                                   (select id from public.artists where slug='quannnic'),              'stepdream.jpg',
       'https://open.spotify.com/album/5E3MchKg9tSmjcinajvShd', 'https://music.apple.com/us/album/stepdream/1714198161'),
  (8,  'SCRAPYARD',                                   (select id from public.artists where slug='quadeca'),               'scrapyard.jpg',
       'https://open.spotify.com/album/2uoD60Oip7rq3vjXxZ2VaD', 'https://music.apple.com/us/album/scrapyard/1745245323'),
  (9,  'Exhibition Mode',                             (select id from public.artists where slug='dazegxd'),               'em.jpg',
       'https://open.spotify.com/album/5a8AWd05ntvevac8SfhwuF', null),
  (10, 're:wired',                                    (select id from public.artists where slug='kuru'),                  'rewired.png',
       'https://open.spotify.com/album/41SZeD5hrlYWJi9UNdhhGJ', 'https://music.apple.com/us/album/re-wired/1775512438'),
  (11, 'fishmonger',                                  (select id from public.artists where slug='underscores'),           'monger.png',
       'https://open.spotify.com/album/5o9aTepLhqQL2gXuKPhd8g', 'https://music.apple.com/us/album/fishmonger/1554129662'),
  (12, 'Attempted Martyr',                            (select id from public.artists where slug='prostitute'),            'attemptedmartyr.png',
       'https://open.spotify.com/album/6y6oIX7XwoWNEmoSoEpS8G', 'https://music.apple.com/us/album/attempted-martyr/1775309110'),
  (13, 'Ghostholding',                                (select id from public.artists where slug='venturing'),             'gh.png',
       'https://open.spotify.com/album/7quQ97KCEOY9Ro5Si6o5bn', 'https://music.apple.com/us/album/ghostholding/1790907805'),
  (14, 'Revengeseekerz',                              (select id from public.artists where slug='jane-remover'),          'rs.png',
       'https://open.spotify.com/album/21b4cDNse2AMpj94ykfuON', 'https://music.apple.com/us/album/revengeseekerz/1800020675'),
  (15, 'Handwriting Practice No. 1',                  (select id from public.artists where slug='operelly'),              'operelly.png',
       'https://open.spotify.com/album/4D3EjnEEuZrJfBidHIC3c2', 'https://music.apple.com/us/album/handwriting-practice-no-1-ep/1810333779'),
  (16, 'Unmusique',                                   (select id from public.artists where slug='lucy-bedroque'),         'unmusique.png',
       'https://open.spotify.com/album/4hP6GKbrQjCCeJ8B0MfBXQ', 'https://music.apple.com/us/album/unmusique/1812489371'),
  (17, 'Stay True Forever',                           (select id from public.artists where slug='kuru'),                  'stt.png',
       'https://open.spotify.com/album/7sfzt6opjPYVupZDX0bMUB', 'https://music.apple.com/us/album/stay-true-forever/1815549288'),
  (18, 'I Look At Her and Light Goes All Through Me', (select id from public.artists where slug='photographic-memory'),   'photomem.png',
       'https://open.spotify.com/album/4vycG6oelJByBKB2cImJJw', 'https://music.apple.com/in/album/i-look-at-her-and-light-goes-all-through-me/1816954086'),
  (19, 'K1',                                          (select id from public.artists where slug='kmoe'),                  'k1.png',
       'https://open.spotify.com/album/6f7CThvZW0bwczICdR0yHV', 'https://music.apple.com/us/album/k1/1813949259'),
  (20, 'sororitie',                                   (select id from public.artists where slug='lucy-bedroque'),         'lb.png',
       'https://open.spotify.com/album/4yecjpKzjaLQL0Wu9LdaIs', null),
  (21, 'Warbrained',                                  (select id from public.artists where slug='quannnic'),              'wb.png',
       'https://open.spotify.com/album/4esdADi38vK9OVIpR9qgBJ', 'https://music.apple.com/us/album/warbrained/1832178486'),
  (22, 'I Love My Computer',                          (select id from public.artists where slug='ninajirachi'),           'ilmc.png',
       'https://open.spotify.com/album/77CZUF57sYqgtznUe3OikQ', 'https://music.apple.com/to/album/i-love-my-computer/1824602984'),
  (23, '♡',                                           (select id from public.artists where slug='jane-remover'),          'heartcover.png',
       'https://open.spotify.com/album/2XeflvA0dNvjpX0vxukgiv', 'https://music.apple.com/om/album/ep/1856018518'),
  (24, 'Grip Your Fist, I''m Heavenbound',            (select id from public.artists where slug='racing-mount-pleasant'), 'rmpgyf.png',
       'https://open.spotify.com/album/6kb777ggEqdZEN2J80USnD', 'https://music.apple.com/us/album/grip-your-fist-im-heaven-bound/1652717111'),
  (25, 'My Ghosts Go Ghost',                          (select id from public.artists where slug='by-storm'),              'mggg.png',
       'https://open.spotify.com/album/3PVx0nf16eZmTOiTu33UaK', 'https://music.apple.com/us/album/my-ghosts-go-ghost/1869647098')
on conflict (catalog_number) do nothing;

-- ---------------------------------------------------------------- mgmt

insert into public.artist_contacts (artist_id, role, email, position)
select a.id, v.role, v.email, v.position
from (values
  ('dazegxd',               'management', 'mgmt@deadairrecords.com',        10),
  ('dazegxd',               'booking',    'josh@groundcontroltouring.com',  20),
  ('jane-remover',          'management', 'mgmt@deadairrecords.com',        10),
  ('jane-remover',          'booking',    'greg.horbal@the.team',           20),
  ('kmoe',                  'management', 'eva@deadairrecords.com',         10),
  ('kmoe',                  'booking',    'jrobbins@wmeagency.com',         20),
  ('kuru',                  'management', 'lucas@deadairrecords.com',       10),
  ('kuru',                  'management', 'yams@deadairrecords.com',        20),
  ('lucy-bedroque',         'management', 'mgmt@deadairrecords.com',        10),
  ('lucy-bedroque',         'booking',    'greg.horbal@the.team',           20),
  ('racing-mount-pleasant', 'management', 'anna@deadairrecords.com',        10),
  ('racing-mount-pleasant', 'management', 'mgmt@deadairrecords.com',        20),
  ('racing-mount-pleasant', 'booking',    'greg.horbal@the.team',           30),
  ('dagmar-zuniga',         'management', 'lucas@deadairrecords.com',       10),
  ('dagmar-zuniga',         'booking_eu', 'joe@qujunktions.com',            20)
) as v(slug, role, email, position)
join public.artists a on a.slug = v.slug
where not exists (
  select 1 from public.artist_contacts c
  where c.artist_id = a.id and c.role = v.role and c.email = v.email
);

-- ---------------------------------------------------------------- live
-- The live page currently carries no dates or venues, only a promo image and a
-- ticket link, so those columns stay null until staff fill them in.

insert into public.events (artist_id, title, ticket_url, position)
select a.id, v.title, v.ticket_url, v.position
from (values
  ('lucy-bedroque',         'Bedroque :002',              'https://events.seated.com/lucy-bedroque',                     10),
  ('operelly',              'Flutters Away',              'https://www.handstamp.com/e/operelly-minimart-kv78r5bg',      20),
  ('racing-mount-pleasant', 'Racing Mount Pleasant Tour', 'https://racingmountpleasanttour.com',                         30)
) as v(slug, title, ticket_url, position)
join public.artists a on a.slug = v.slug
where not exists (select 1 from public.events e where e.title = v.title);

-- ---------------------------------------------------------------- settings

insert into public.site_settings
  (id, about_text, contact_email, merch_note, instagram_url, store_url, credits)
values (
  1,
  'deadAir is a multidisciplinary & independent label. Betting on human achievement since 2021.',
  'mgmt@deadairrecords.com',
  'All merch inquiries: please respond to your confirmation email!',
  'https://www.instagram.com/deadair/',
  'https://deadair.store',
  '["Digiyams","Logan Murray","Brendon Burton","blink3rcam","Caleb Koskow"]'::jsonb
)
on conflict (id) do nothing;

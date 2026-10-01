-- Northeast Avalon service area (St. John's, NL and neighbouring towns), keyed by forward sortation
-- area (the first three characters of a Canadian postal code). Coordinates are approximate area
-- centres used as the search origin; restaurants pin their exact location in their profile.
insert into public.zips (zip, city, cities, county, location) values
  ('A1A', 'St. John''s', array['St. John''s', 'Logy Bay–Middle Cove–Outer Cove']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.703, 47.5915), 4326)::extensions.geography),
  ('A1B', 'St. John''s', array['St. John''s']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.733, 47.578), 4326)::extensions.geography),
  ('A1C', 'St. John''s', array['St. John''s']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.712, 47.563), 4326)::extensions.geography),
  ('A1E', 'St. John''s', array['St. John''s']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.731, 47.546), 4326)::extensions.geography),
  ('A1G', 'St. John''s', array['St. John''s']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.774, 47.548), 4326)::extensions.geography),
  ('A1H', 'St. John''s', array['St. John''s', 'Goulds', 'Kilbride']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.775, 47.474), 4326)::extensions.geography),
  ('A1K', 'Torbay', array['Torbay', 'Flatrock', 'Pouch Cove', 'Logy Bay–Middle Cove–Outer Cove']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.733, 47.663), 4326)::extensions.geography),
  ('A1L', 'Paradise', array['Paradise']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.87, 47.533), 4326)::extensions.geography),
  ('A1M', 'Portugal Cove–St. Philip''s', array['Portugal Cove–St. Philip''s', 'Bauline']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.865, 47.612), 4326)::extensions.geography),
  ('A1N', 'Mount Pearl', array['Mount Pearl']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.806, 47.519), 4326)::extensions.geography),
  ('A1S', 'Bay Bulls', array['Bay Bulls', 'Witless Bay', 'Petty Harbour–Maddox Cove', 'Tors Cove']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.812, 47.316), 4326)::extensions.geography),
  ('A1W', 'Conception Bay South', array['Conception Bay South', 'Manuels', 'Long Pond']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-52.945, 47.517), 4326)::extensions.geography),
  ('A1X', 'Conception Bay South', array['Conception Bay South', 'Foxtrap', 'Kelligrews', 'Seal Cove']::text[], 'Northeast Avalon', extensions.st_setsrid(extensions.st_makepoint(-53.0, 47.491), 4326)::extensions.geography);

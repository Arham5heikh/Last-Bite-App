-- ==============================================================================
-- LAST BITE: ST. JOHN'S, NL DEMO SEED
-- 10 downtown St. John's restaurants (Water St, Duckworth/Cathedral, LeMarchant Rd)
-- with kitchen terminal PINs, preset rescue menus and live surplus drops.
-- Clears ALL existing merchants (the old Seattle demo data) before inserting.
-- Pricing Policy: Strict 50% Food Rescue Discount Guarantee
-- Mirrors src/lib/data/stJohns.ts, which drives the front-end demo.
-- ==============================================================================

-- 1. ENSURE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. SCHEMA ADJUSTMENTS FOR KITCHEN TERMINAL PIN, CONTACT EMAIL & CATALOG
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS terminal_pin CHAR(4) DEFAULT '1111';

ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create catalog_items table if not exists for preset kitchen menus
CREATE TABLE IF NOT EXISTS public.catalog_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    original_price_cents INTEGER NOT NULL CHECK (original_price_cents > 0),
    discounted_price_cents INTEGER NOT NULL CHECK (discounted_price_cents > 0),
    allergens TEXT[] NOT NULL DEFAULT '{}',
    dietary_tags TEXT[] NOT NULL DEFAULT '{}',
    photo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Invariant: Strict 50% discount rule enforced at database level
    CONSTRAINT chk_catalog_exact_half_price CHECK (discounted_price_cents <= (original_price_cents / 2))
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_merchant ON public.catalog_items(merchant_id);

-- 3. POSTGIS RPC FUNCTION: get_nearby_surplus
-- Calculates exact geodesic distance in kilometers between user's live device coordinates
-- and merchant locations, filtering for active surplus listings within radius_km (default 15km).
CREATE OR REPLACE FUNCTION public.get_nearby_surplus(
    user_lat DOUBLE PRECISION,
    user_lng DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 15.0
)
RETURNS TABLE (
    listing_id UUID,
    merchant_id UUID,
    business_name TEXT,
    merchant_address TEXT,
    merchant_lat DOUBLE PRECISION,
    merchant_lng DOUBLE PRECISION,
    merchant_phone TEXT,
    title TEXT,
    description TEXT,
    category TEXT,
    surplus_reason surplus_reason,
    original_price_cents INT,
    discounted_price_cents INT,
    quantity INT,
    initial_quantity INT,
    pickup_start TIMESTAMPTZ,
    pickup_cutoff TIMESTAMPTZ,
    dietary_tags TEXT[],
    photo_url TEXT,
    status listing_status,
    distance_km DOUBLE PRECISION,
    distance_meters DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT 
        l.id AS listing_id,
        m.id AS merchant_id,
        m.business_name,
        m.address AS merchant_address,
        ST_Y(m.location::geometry) AS merchant_lat,
        ST_X(m.location::geometry) AS merchant_lng,
        m.phone AS merchant_phone,
        l.title,
        l.description,
        l.category,
        l.surplus_reason,
        l.original_price_cents,
        l.discounted_price_cents,
        l.quantity,
        l.initial_quantity,
        l.pickup_start,
        l.pickup_cutoff,
        l.dietary_tags,
        l.photo_url,
        l.status,
        ROUND((ST_Distance(
            m.location::geography, 
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        ) / 1000.0)::NUMERIC, 2)::DOUBLE PRECISION AS distance_km,
        ROUND(ST_Distance(
            m.location::geography, 
            ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
        )::NUMERIC, 1)::DOUBLE PRECISION AS distance_meters
    FROM public.listings l
    INNER JOIN public.merchants m ON l.merchant_id = m.id
    WHERE l.status = 'active'
      AND l.pickup_cutoff > NOW()
      AND l.quantity > 0
      AND ST_DWithin(
          m.location::geography,
          ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
          radius_km * 1000.0
      )
    ORDER BY distance_km ASC;
$$;

BEGIN;

-- 4. CLEAR OUT PREVIOUS DEMO DATA (Seattle restaurants, their listings & orders)
-- Orders use ON DELETE RESTRICT, so they go first. Deleting the merchant auth
-- users cascades to profiles -> merchants -> listings & catalog_items.
DELETE FROM public.orders;
DELETE FROM public.listings;
DELETE FROM public.catalog_items;
DELETE FROM public.merchants;
DELETE FROM auth.users
WHERE id IN (SELECT id FROM public.profiles WHERE role = 'merchant');
DELETE FROM public.profiles WHERE role = 'merchant';

-- 5. INSERT THE 10 ST. JOHN'S, NL MERCHANTS
-- Deterministic UUIDs; each merchant's UUID digit matches its terminal PIN.

-- A. Auth users (profiles.id references auth.users.id)
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000', 'a1111111-1111-4111-a111-111111111111', 'authenticated', 'authenticated', 'contact@no4cathedral.com', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"No. 4 Restaurant & Bar"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'a2222222-2222-4222-a222-222222222222', 'authenticated', 'authenticated', 'bookings@themerchanttavern.ca', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"The Merchant Tavern"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'a3333333-3333-4333-a333-333333333333', 'authenticated', 'authenticated', 'info@blueonwater.com', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Blue on Water"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'a4444444-4444-4444-a444-444444444444', 'authenticated', 'authenticated', 'yellowbellygm@gmail.com', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"YellowBelly Brewery"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'a5555555-5555-4555-a555-555555555555', 'authenticated', 'authenticated', 'c.vincent@nl.rogers.com', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Oliver''s Restaurant"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'a6666666-6666-4666-a666-666666666666', 'authenticated', 'authenticated', 'blackcatpizzeria@gmail.com', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Black Cat Pizzeria"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'a7777777-7777-4777-a777-777777777777', 'authenticated', 'authenticated', 'inquiries@rocketfood.ca', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Rocket Bakery & Fresh Food"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'a8888888-8888-4888-a888-888888888888', 'authenticated', 'authenticated', 'info@chinched.com', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Chinched Restaurant"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'a9999999-9999-4999-a999-999999999999', 'authenticated', 'authenticated', 'info@theadelaideoysterhouse.com', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"The Adelaide Oyster House"}', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-a000-000000000000', 'authenticated', 'authenticated', 'info@terrerestaurant.com', '', NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Terre Restaurant & Cafe"}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- B. Merchant profiles
INSERT INTO public.profiles (id, email, name, phone, role)
VALUES
  ('a1111111-1111-4111-a111-111111111111', 'contact@no4cathedral.com', 'No. 4 Restaurant & Bar', '(709) 753-6600', 'merchant'),
  ('a2222222-2222-4222-a222-222222222222', 'bookings@themerchanttavern.ca', 'The Merchant Tavern', '(709) 722-5050', 'merchant'),
  ('a3333333-3333-4333-a333-333333333333', 'info@blueonwater.com', 'Blue on Water', '(709) 754-2583', 'merchant'),
  ('a4444444-4444-4444-a444-444444444444', 'yellowbellygm@gmail.com', 'YellowBelly Brewery', '(709) 757-3784', 'merchant'),
  ('a5555555-5555-4555-a555-555555555555', 'c.vincent@nl.rogers.com', 'Oliver''s Restaurant', '(709) 754-6444', 'merchant'),
  ('a6666666-6666-4666-a666-666666666666', 'blackcatpizzeria@gmail.com', 'Black Cat Pizzeria', '(709) 687-0709', 'merchant'),
  ('a7777777-7777-4777-a777-777777777777', 'inquiries@rocketfood.ca', 'Rocket Bakery & Fresh Food', '(709) 700-1336', 'merchant'),
  ('a8888888-8888-4888-a888-888888888888', 'info@chinched.com', 'Chinched Restaurant', '(709) 722-3100', 'merchant'),
  ('a9999999-9999-4999-a999-999999999999', 'info@theadelaideoysterhouse.com', 'The Adelaide Oyster House', '(709) 722-7222', 'merchant'),
  ('a0000000-0000-4000-a000-000000000000', 'info@terrerestaurant.com', 'Terre Restaurant & Cafe', '(709) 383-2136', 'merchant')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  role = EXCLUDED.role;

-- C. Merchant stores (PostGIS lng/lat points, contact details, 4-digit terminal PINs)
INSERT INTO public.merchants (
    id, business_name, address, location, phone, email, terminal_pin,
    verified, stripe_account_id, banner_url
)
VALUES
  ('a1111111-1111-4111-a111-111111111111', 'No. 4 Restaurant & Bar', '4 Cathedral St, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7071, 47.5641), 4326), '(709) 753-6600', 'contact@no4cathedral.com', '1111', TRUE, 'acct_a1111111_connect', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'),
  ('a2222222-2222-4222-a222-222222222222', 'The Merchant Tavern', '291 Water St, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7094, 47.5623), 4326), '(709) 722-5050', 'bookings@themerchanttavern.ca', '2222', TRUE, 'acct_a2222222_connect', 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=80'),
  ('a3333333-3333-4333-a333-333333333333', 'Blue on Water', '319 Water St, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7087, 47.5628), 4326), '(709) 754-2583', 'info@blueonwater.com', '3333', TRUE, 'acct_a3333333_connect', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'),
  ('a4444444-4444-4444-a444-444444444444', 'YellowBelly Brewery', '288 Water St, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7100, 47.5620), 4326), '(709) 757-3784', 'yellowbellygm@gmail.com', '4444', TRUE, 'acct_a4444444_connect', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'),
  ('a5555555-5555-4555-a555-555555555555', 'Oliver''s Restaurant', '160 Water St, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7125, 47.5607), 4326), '(709) 754-6444', 'c.vincent@nl.rogers.com', '5555', TRUE, 'acct_a5555555_connect', 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=800&q=80'),
  ('a6666666-6666-4666-a666-666666666666', 'Black Cat Pizzeria', '13 LeMarchant Rd, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7168, 47.5584), 4326), '(709) 687-0709', 'blackcatpizzeria@gmail.com', '6666', TRUE, 'acct_a6666666_connect', 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80'),
  ('a7777777-7777-4777-a777-777777777777', 'Rocket Bakery & Fresh Food', '294 Water St, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7097, 47.5622), 4326), '(709) 700-1336', 'inquiries@rocketfood.ca', '7777', TRUE, 'acct_a7777777_connect', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80'),
  ('a8888888-8888-4888-a888-888888888888', 'Chinched Restaurant', '5 Bates Hill, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7092, 47.5631), 4326), '(709) 722-3100', 'info@chinched.com', '8888', TRUE, 'acct_a8888888_connect', 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'),
  ('a9999999-9999-4999-a999-999999999999', 'The Adelaide Oyster House', '334 Water St, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7083, 47.5631), 4326), '(709) 722-7222', 'info@theadelaideoysterhouse.com', '9999', TRUE, 'acct_a9999999_connect', 'https://images.unsplash.com/photo-1579208570378-8c970854bc23?auto=format&fit=crop&w=800&q=80'),
  ('a0000000-0000-4000-a000-000000000000', 'Terre Restaurant & Cafe', '125 Water St, St. John''s, NL', ST_SetSRID(ST_MakePoint(-52.7136, 47.5601), 4326), '(709) 383-2136', 'info@terrerestaurant.com', '0000', TRUE, 'acct_a0000000_connect', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80');

-- 6. PRESET MENU CATALOG ITEMS (EXACT 50% DISCOUNT RULE)
INSERT INTO public.catalog_items (
    id, merchant_id, title, description, category,
    original_price_cents, discounted_price_cents, allergens, dietary_tags, photo_url
)
VALUES
  -- No. 4 Restaurant & Bar (PIN 1111)
  ('c1111111-1111-4111-a111-111111111101', 'a1111111-1111-4111-a111-111111111111', 'Crispy Cod Tacos', 'Beer-battered Atlantic cod, lime crema, pickled red onion and cabbage slaw on soft corn tortillas.', 'Cocktail Bar', 1900, 950, ARRAY['Seafood', 'Dairy']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80'),
  ('c1111111-1111-4111-a111-111111111102', 'a1111111-1111-4111-a111-111111111111', 'No. 4 Smash Burger', 'Double smashed beef patty, aged cheddar, house pickles and secret sauce with hand-cut fries.', 'Cocktail Bar', 2200, 1100, ARRAY['Gluten', 'Dairy']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80'),

  -- The Merchant Tavern (PIN 2222)
  ('c2222222-2222-4222-a222-222222222201', 'a2222222-2222-4222-a222-222222222222', 'Pan-Seared Atlantic Cod', 'Local cod loin, brown butter, crushed new potatoes, capers and seasonal greens.', 'Tavern', 3200, 1600, ARRAY['Seafood', 'Dairy']::TEXT[], ARRAY['Gluten-Free']::TEXT[], 'https://images.unsplash.com/photo-1580217593608-61931cefc821?auto=format&fit=crop&w=800&q=80'),
  ('c2222222-2222-4222-a222-222222222202', 'a2222222-2222-4222-a222-222222222222', 'Tavern Rigatoni', 'Slow-cooked pork ragù, San Marzano tomato, parmesan and fresh basil.', 'Tavern', 2600, 1300, ARRAY['Gluten', 'Dairy']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?auto=format&fit=crop&w=800&q=80'),

  -- Blue on Water (PIN 3333)
  ('c3333333-3333-4333-a333-333333333301', 'a3333333-3333-4333-a333-333333333333', 'Truffle Fries', 'Crispy hand-cut fries tossed in white truffle oil, grated aged Parmigiano Reggiano and rosemary aioli.', 'Upscale Bar', 1600, 800, ARRAY['Dairy']::TEXT[], ARRAY['Vegetarian']::TEXT[], 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80'),
  ('c3333333-3333-4333-a333-333333333302', 'a3333333-3333-4333-a333-333333333333', 'Duck BLT', 'Smoked duck breast, thick-cut double smoked bacon, heirloom tomato, baby greens and roasted garlic aioli on brioche.', 'Upscale Bar', 2600, 1300, ARRAY['Gluten', 'Eggs']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80'),

  -- YellowBelly Brewery (PIN 4444)
  ('c4444444-4444-4444-a444-444444444401', 'a4444444-4444-4444-a444-444444444444', 'St. John''s Stout Braised Short Rib', 'Slow-braised in house-brewed St. John''s Stout with Yukon gold potato purée, glazed heritage carrots and pan jus.', 'Pub Fare', 3600, 1800, ARRAY['Dairy']::TEXT[], ARRAY['Gluten-Free']::TEXT[], 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'),
  ('c4444444-4444-4444-a444-444444444402', 'a4444444-4444-4444-a444-444444444444', 'YellowBelly Fish & Chips (1 pc)', 'Crispy ale-battered Atlantic cod, hand-cut Kennebec fries, house tartar sauce and lemon wedge.', 'Pub Fare', 1700, 850, ARRAY['Gluten', 'Seafood']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1579208570378-8c970854bc23?auto=format&fit=crop&w=800&q=80'),

  -- Oliver's Restaurant (PIN 5555)
  ('c5555555-5555-4555-a555-555555555501', 'a5555555-5555-4555-a555-555555555555', 'Chicken Parmesan Sandwich', 'Breaded chicken cutlet, San Marzano marinara, melted fior di latte and basil pesto on toasted ciabatta.', 'Bistro', 2200, 1100, ARRAY['Dairy', 'Gluten']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=800&q=80'),
  ('c5555555-5555-4555-a555-555555555502', 'a5555555-5555-4555-a555-555555555555', 'Chickpea & Walnut Pâté', 'Roasted walnut and herb chickpea spread with marinated olives, pickled shallots and house crostini.', 'Bistro', 1800, 900, ARRAY['Nuts', 'Gluten']::TEXT[], ARRAY['Vegetarian', 'Vegan']::TEXT[], 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80'),

  -- Black Cat Pizzeria (PIN 6666)
  ('c6666666-6666-4666-a666-666666666601', 'a6666666-6666-4666-a666-666666666666', 'Chicken Bacon Ranch Pizza', 'Sourdough crust, roasted garlic chicken, crispy bacon, house buttermilk ranch and scallions.', 'Pizza', 2300, 1150, ARRAY['Dairy', 'Gluten']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80'),
  ('c6666666-6666-4666-a666-666666666602', 'a6666666-6666-4666-a666-666666666666', 'Hot Honey Pepperoni Pizza', 'Cup & char pepperoni, whipped ricotta, Calabrian chili oil and hot wildflower honey drizzle.', 'Pizza', 2200, 1100, ARRAY['Dairy', 'Gluten']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80'),

  -- Rocket Bakery & Fresh Food (PIN 7777)
  ('c7777777-7777-4777-a777-777777777701', 'a7777777-7777-4777-a777-777777777777', 'Best Kind Breakfast Sandwich', 'Free-run egg, country ham, aged cheddar and maple dijon butter on a freshly baked cheddar biscuit.', 'Bakery', 1200, 600, ARRAY['Dairy', 'Gluten', 'Eggs']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80'),
  ('c7777777-7777-4777-a777-777777777702', 'a7777777-7777-4777-a777-777777777777', 'Day-End Pastry Box (4)', 'Assorted croissants, scones and sweet buns from today''s bake.', 'Bakery', 1600, 800, ARRAY['Gluten', 'Dairy', 'Eggs']::TEXT[], ARRAY['Vegetarian']::TEXT[], 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80'),

  -- Chinched Restaurant (PIN 8888)
  ('c8888888-8888-4888-a888-888888888801', 'a8888888-8888-4888-a888-888888888888', 'House Charcuterie Board', 'Chef-cured meats, house pickles, grainy mustard and grilled sourdough.', 'Charcuterie', 2800, 1400, ARRAY['Gluten', 'Mustard']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'),
  ('c8888888-8888-4888-a888-888888888802', 'a8888888-8888-4888-a888-888888888888', 'Crispy Pork Belly', 'Twice-cooked pork belly, apple purée, charred greens and cider jus.', 'Charcuterie', 2600, 1300, '{}'::TEXT[], ARRAY['Gluten-Free', 'Dairy-Free']::TEXT[], 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'),

  -- The Adelaide Oyster House (PIN 9999)
  ('c9999999-9999-4999-a999-999999999901', 'a9999999-9999-4999-a999-999999999999', 'Fresh Oysters (Half Dozen)', 'Shucked East Coast oysters with mignonette, horseradish and lemon.', 'Seafood', 2100, 1050, ARRAY['Shellfish']::TEXT[], ARRAY['Gluten-Free', 'Dairy-Free']::TEXT[], 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80'),
  ('c9999999-9999-4999-a999-999999999902', 'a9999999-9999-4999-a999-999999999999', 'Fish Tacos (3)', 'Crispy fried fish, chipotle mayo, pickled jalapeño and cabbage slaw.', 'Seafood', 1800, 900, ARRAY['Seafood', 'Gluten', 'Eggs']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80'),

  -- Terre Restaurant & Cafe (PIN 0000)
  ('c0000000-0000-4000-a000-000000000001', 'a0000000-0000-4000-a000-000000000000', 'Seasonal Grain Bowl', 'Roasted root vegetables, farro, local greens, pickled beets and herb vinaigrette.', 'Farm-to-Table', 1800, 900, '{}'::TEXT[], ARRAY['Vegan', 'Vegetarian', 'Dairy-Free']::TEXT[], 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80'),
  ('c0000000-0000-4000-a000-000000000002', 'a0000000-0000-4000-a000-000000000000', 'Newfoundland Cod Cakes', 'Salt cod and potato cakes, tartar sauce, mustard pickles and dressed greens.', 'Farm-to-Table', 1600, 800, ARRAY['Seafood', 'Gluten', 'Eggs']::TEXT[], '{}'::TEXT[], 'https://images.unsplash.com/photo-1580217593608-61931cefc821?auto=format&fit=crop&w=800&q=80');

-- 7. INITIAL LIVE SURPLUS DROPS (one per restaurant, ready to claim on the map)
INSERT INTO public.listings (
    id, merchant_id, title, description, category, surplus_reason,
    original_price_cents, discounted_price_cents, quantity, initial_quantity,
    pickup_start, pickup_cutoff, dietary_tags, photo_url, status
)
VALUES
  ('b1111111-1111-4111-a111-111111111101', 'a1111111-1111-4111-a111-111111111111', 'Crispy Cod Tacos', 'Canceled takeout order, just plated. Beer-battered Atlantic cod, lime crema, pickled red onion and cabbage slaw on soft corn tortillas.', 'Cocktail Bar', 'canceled_order', 1900, 950, 1, 1, NOW() - INTERVAL '6 minutes', NOW() + INTERVAL '25 minutes', '{}'::TEXT[], 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80', 'active'),
  ('b2222222-2222-4222-a222-222222222201', 'a2222222-2222-4222-a222-222222222222', 'Pan-Seared Atlantic Cod', 'Duplicate ticket fired by mistake. Local cod loin, brown butter, crushed new potatoes, capers and seasonal greens.', 'Tavern', 'kitchen_error', 3200, 1600, 1, 1, NOW() - INTERVAL '4 minutes', NOW() + INTERVAL '30 minutes', ARRAY['Gluten-Free']::TEXT[], 'https://images.unsplash.com/photo-1580217593608-61931cefc821?auto=format&fit=crop&w=800&q=80', 'active'),
  ('b3333333-3333-4333-a333-333333333301', 'a3333333-3333-4333-a333-333333333333', 'Truffle Fries', 'Accidental duplicate side order. Crispy hand-cut fries tossed in white truffle oil, grated aged Parmigiano Reggiano and rosemary aioli.', 'Upscale Bar', 'kitchen_error', 1600, 800, 1, 1, NOW() - INTERVAL '8 minutes', NOW() + INTERVAL '18 minutes', ARRAY['Vegetarian']::TEXT[], 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80', 'active'),
  ('b4444444-4444-4444-a444-444444444401', 'a4444444-4444-4444-a444-444444444444', 'St. John''s Stout Braised Short Rib', 'Delivery driver never arrived. Slow-braised in house-brewed St. John''s Stout with Yukon gold potato purée, glazed heritage carrots and pan jus.', 'Pub Fare', 'canceled_order', 3600, 1800, 1, 1, NOW() - INTERVAL '10 minutes', NOW() + INTERVAL '26 minutes', ARRAY['Gluten-Free']::TEXT[], 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80', 'active'),
  ('b5555555-5555-4555-a555-555555555501', 'a5555555-5555-4555-a555-555555555555', 'Chicken Parmesan Sandwich', 'Wrong modifier, remade for the guest. Breaded chicken cutlet, San Marzano marinara, melted fior di latte and basil pesto on toasted ciabatta.', 'Bistro', 'kitchen_error', 2200, 1100, 1, 1, NOW() - INTERVAL '5 minutes', NOW() + INTERVAL '28 minutes', '{}'::TEXT[], 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=800&q=80', 'active'),
  ('b6666666-6666-4666-a666-666666666601', 'a6666666-6666-4666-a666-666666666666', 'Chicken Bacon Ranch Pizza', 'Extra bake at end of shift. Sourdough crust, roasted garlic chicken, crispy bacon, house buttermilk ranch and scallions.', 'Pizza', 'day_end_surplus', 2300, 1150, 2, 2, NOW() - INTERVAL '15 minutes', NOW() + INTERVAL '35 minutes', '{}'::TEXT[], 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80', 'active'),
  ('b7777777-7777-4777-a777-777777777701', 'a7777777-7777-4777-a777-777777777777', 'Best Kind Breakfast Sandwich', 'Afternoon surplus from today''s bake. Free-run egg, country ham, aged cheddar and maple dijon butter on a freshly baked cheddar biscuit.', 'Bakery', 'day_end_surplus', 1200, 600, 3, 3, NOW() - INTERVAL '20 minutes', NOW() + INTERVAL '45 minutes', '{}'::TEXT[], 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80', 'active'),
  ('b8888888-8888-4888-a888-888888888801', 'a8888888-8888-4888-a888-888888888888', 'House Charcuterie Board', 'Closing out the evening prep. Chef-cured meats, house pickles, grainy mustard and grilled sourdough.', 'Charcuterie', 'day_end_surplus', 2800, 1400, 1, 1, NOW() - INTERVAL '12 minutes', NOW() + INTERVAL '40 minutes', '{}'::TEXT[], 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80', 'active'),
  ('b9999999-9999-4999-a999-999999999901', 'a9999999-9999-4999-a999-999999999999', 'Fresh Oysters (Half Dozen)', 'Table walked out before service. Shucked East Coast oysters with mignonette, horseradish and lemon.', 'Seafood', 'canceled_order', 2100, 1050, 1, 1, NOW() - INTERVAL '3 minutes', NOW() + INTERVAL '22 minutes', ARRAY['Gluten-Free', 'Dairy-Free']::TEXT[], 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80', 'active'),
  ('b0000000-0000-4000-a000-000000000001', 'a0000000-0000-4000-a000-000000000000', 'Seasonal Grain Bowl', 'Fresh prep closing out lunch shift. Roasted root vegetables, farro, local greens, pickled beets and herb vinaigrette.', 'Farm-to-Table', 'day_end_surplus', 1800, 900, 2, 2, NOW() - INTERVAL '9 minutes', NOW() + INTERVAL '50 minutes', ARRAY['Vegan', 'Vegetarian', 'Dairy-Free']::TEXT[], 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80', 'active');

COMMIT;

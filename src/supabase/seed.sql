-- ==============================================================================
-- LAST BITE: ST. JOHN'S, NL SEED & POSTGIS SURPLUS RADIAL SEARCH SCRIPT
-- Locations: 5 Premier St. John's Downtown Restaurants on Water St & LeMarchant Rd
-- Pricing Policy: Strict 50% Food Rescue Discount Guarantee
-- PostGIS Function: get_nearby_surplus (Calculates live distance in km)
-- ==============================================================================

-- 1. ENSURE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. SCHEMA ADJUSTMENTS FOR KITCHEN TERMINAL PIN & CATALOG
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS terminal_pin CHAR(4) DEFAULT '1111';

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

-- 4. INSERT OR UPDATE THE 5 ST. JOHN'S, NL MERCHANTS
-- Deterministic UUIDs mapped to physical establishments in Downtown St. John's

-- A. Merchant Profiles
INSERT INTO public.profiles (id, email, name, phone, role)
VALUES 
  ('a1111111-1111-4111-a111-111111111111', 'kitchen@yellowbellybrewery.com', 'YellowBelly Kitchen Team', '(709) 757-3780', 'merchant'),
  ('a2222222-2222-4222-a222-222222222222', 'kitchen@oliversrestaurant.ca', 'Oliver''s Kitchen Staff', '(709) 754-6444', 'merchant'),
  ('a3333333-3333-4333-a333-333333333333', 'kitchen@blackcatpizzeria.ca', 'Black Cat Oven Team', '(709) 754-2228', 'merchant'),
  ('a4444444-4444-4444-a444-444444444444', 'kitchen@blueonwater.com', 'Blue on Water Culinary', '(709) 754-2583', 'merchant'),
  ('a5555555-5555-4555-a555-555555555555', 'bakery@rocketfood.ca', 'Rocket Bakery Shift Lead', '(709) 738-2011', 'merchant')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone;

-- B. Merchant Stores (With exact PostGIS Lat/Lng coordinates and 4-digit PINs)
INSERT INTO public.merchants (
    id, 
    business_name, 
    address, 
    location, 
    phone, 
    terminal_pin, 
    verified, 
    stripe_account_id, 
    banner_url
)
VALUES
  (
    'a1111111-1111-4111-a111-111111111111',
    'YellowBelly Brewery and Public House',
    '288 Water St, St. John''s, NL',
    ST_SetSRID(ST_MakePoint(-52.7096, 47.5624), 4326),
    '(709) 757-3780',
    '1111',
    TRUE,
    'acct_yellowbelly_connect',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'a2222222-2222-4222-a222-222222222222',
    'Oliver''s Restaurant',
    '160 Water St, St. John''s, NL',
    ST_SetSRID(ST_MakePoint(-52.7118, 47.5611), 4326),
    '(709) 754-6444',
    '2222',
    TRUE,
    'acct_olivers_connect',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'a3333333-3333-4333-a333-333333333333',
    'Black Cat Pizzeria',
    '13 LeMarchant Rd, St. John''s, NL',
    ST_SetSRID(ST_MakePoint(-52.7169, 47.5583), 4326),
    '(709) 754-2228',
    '3333',
    TRUE,
    'acct_blackcat_connect',
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'a4444444-4444-4444-a444-444444444444',
    'Blue on Water',
    '319 Water St, St. John''s, NL',
    ST_SetSRID(ST_MakePoint(-52.7088, 47.5630), 4326),
    '(709) 754-2583',
    '4444',
    TRUE,
    'acct_blueonwater_connect',
    'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'a5555555-5555-4555-a555-555555555555',
    'Rocket Bakery',
    '272 Water St, St. John''s, NL',
    ST_SetSRID(ST_MakePoint(-52.7100, 47.5620), 4326),
    '(709) 738-2011',
    '5555',
    TRUE,
    'acct_rocketbakery_connect',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80'
  )
ON CONFLICT (id) DO UPDATE SET
  business_name = EXCLUDED.business_name,
  address = EXCLUDED.address,
  location = EXCLUDED.location,
  phone = EXCLUDED.phone,
  terminal_pin = EXCLUDED.terminal_pin;

-- 5. POPULATE PRESET MENU CATALOG ITEMS (EXACT 50% DISCOUNT RULE)
DELETE FROM public.catalog_items 
WHERE merchant_id IN (
  'a1111111-1111-4111-a111-111111111111',
  'a2222222-2222-4222-a222-222222222222',
  'a3333333-3333-4333-a333-333333333333',
  'a4444444-4444-4444-a444-444444444444',
  'a5555555-5555-4555-a555-555555555555'
);

INSERT INTO public.catalog_items (
    id, 
    merchant_id, 
    title, 
    description, 
    category, 
    original_price_cents, 
    discounted_price_cents, 
    allergens, 
    dietary_tags, 
    photo_url
)
VALUES
  -- 1. YellowBelly Brewery (PIN 1111)
  (
    'c1111111-1111-4111-a111-111111111101',
    'a1111111-1111-4111-a111-111111111111',
    'St. John''s Stout Braised Short Rib',
    'Slow-braised in house-brewed St. John''s Stout, Yukon gold potato purée, glazed heritage carrots, and rich pan jus.',
    'Pub Fare',
    3600, -- $36.00
    1800, -- $18.00 (50% OFF)
    ARRAY['Dairy'],
    ARRAY['Meat', 'Dairy'],
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'c1111111-1111-4111-a111-111111111102',
    'a1111111-1111-4111-a111-111111111111',
    'YellowBelly Fish & Chips 1 pc',
    'Crispy ale-battered Atlantic cod, hand-cut Kennebec fries, house tartar sauce, and lemon wedge.',
    'Pub Fare',
    1700, -- $17.00
    850,  -- $8.50 (50% OFF)
    ARRAY['Gluten', 'Seafood'],
    ARRAY['Seafood', 'Gluten'],
    'https://images.unsplash.com/photo-1579208570378-8c970854bc23?auto=format&fit=crop&w=800&q=80'
  ),

  -- 2. Oliver''s Restaurant (PIN 2222)
  (
    'c2222222-2222-4222-a222-222222222201',
    'a2222222-2222-4222-a222-222222222222',
    'Chicken Parmesan Sandwich',
    'Breaded chicken cutlet, San Marzano marinara, melted fior di latte, and basil pesto on toasted ciabatta.',
    'Bistro',
    2200, -- $22.00
    1100, -- $11.00 (50% OFF)
    ARRAY['Dairy', 'Gluten'],
    ARRAY['Meat', 'Dairy', 'Gluten'],
    'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'c2222222-2222-4222-a222-222222222202',
    'a2222222-2222-4222-a222-222222222222',
    'Chickpea & Walnut Pâté',
    'Rich roasted walnut and herb chickpea spread with marinated olives, pickled shallots, and house crostini.',
    'Bistro',
    1800, -- $18.00
    900,  -- $9.00 (50% OFF)
    ARRAY['Nuts', 'Gluten'],
    ARRAY['Vegetarian', 'Nuts'],
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80'
  ),

  -- 3. Black Cat Pizzeria (PIN 3333)
  (
    'c3333333-3333-4333-a333-333333333301',
    'a3333333-3333-4333-a333-333333333333',
    'Chicken Bacon Ranch Pizza',
    'Wood-fired sourdough crust, roasted garlic chicken breast, crispy pancetta bacon, house buttermilk ranch, and scallions.',
    'Pizza',
    2300, -- $23.00
    1150, -- $11.50 (50% OFF)
    ARRAY['Dairy', 'Gluten'],
    ARRAY['Meat', 'Dairy', 'Gluten'],
    'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'c3333333-3333-4333-a333-333333333302',
    'a3333333-3333-4333-a333-333333333333',
    'Cat’s Favourite Pizza (Hot Honey)',
    'Cup & char pepperoni, whipped ricotta, Calabrian chili oil, hot wildflower honey drizzle, and fresh oregano.',
    'Pizza',
    2200, -- $22.00
    1100, -- $11.00 (50% OFF)
    ARRAY['Dairy', 'Gluten'],
    ARRAY['Meat', 'Dairy', 'Gluten'],
    'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80'
  ),

  -- 4. Blue on Water (PIN 4444)
  (
    'c4444444-4444-4444-a444-444444444401',
    'a4444444-4444-4444-a444-444444444444',
    'Truffle Fries',
    'Crispy hand-cut fries tossed in white truffle oil, grated aged Parmigiano Reggiano, and rosemary aioli.',
    'Upscale Bar',
    1600, -- $16.00
    800,  -- $8.00 (50% OFF)
    ARRAY['Dairy'],
    ARRAY['Vegetarian', 'Dairy'],
    'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'c4444444-4444-4444-a444-444444444402',
    'a4444444-4444-4444-a444-444444444444',
    'Duck BLT',
    'Smoked duck breast, thick-cut double smoked bacon, heirloom tomato, baby greens, and roasted garlic aioli on brioche.',
    'Upscale Bar',
    2600, -- $26.00
    1300, -- $13.00 (50% OFF)
    ARRAY['Gluten', 'Eggs'],
    ARRAY['Meat', 'Gluten'],
    'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80'
  ),

  -- 5. Rocket Bakery (PIN 5555)
  (
    'c5555555-5555-4555-a555-555555555501',
    'a5555555-5555-4555-a555-555555555555',
    'Best Kind Breakfast Sandwich',
    'Free-run egg, thick-cut country ham, aged cheddar, and house maple dijon butter on a freshly baked cheddar biscuit.',
    'Bakery',
    1800, -- $18.00
    900,  -- $9.00 (50% OFF)
    ARRAY['Dairy', 'Gluten', 'Eggs'],
    ARRAY['Meat', 'Dairy', 'Gluten'],
    'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80'
  ),
  (
    'c5555555-5555-4555-a555-555555555502',
    'a5555555-5555-4555-a555-555555555555',
    'Apple Flip',
    'Flaky traditional Newfoundland puff pastry folded over cinnamon-spiced local Annapolis Valley apples with sugar crust.',
    'Bakery',
    700,  -- $7.00
    350,  -- $3.50 (50% OFF)
    ARRAY['Gluten'],
    ARRAY['Vegetarian', 'Gluten'],
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80'
  );

-- 6. POPULATE INITIAL LIVE ACTIVE SURPLUS DROPS
-- Creates active listings ready for instantaneous rescue on the St. John's map
INSERT INTO public.listings (
    id,
    merchant_id,
    title,
    description,
    category,
    surplus_reason,
    original_price_cents,
    discounted_price_cents,
    quantity,
    initial_quantity,
    pickup_start,
    pickup_cutoff,
    dietary_tags,
    photo_url,
    status
)
VALUES
  (
    'l1111111-1111-4111-a111-111111111101',
    'a1111111-1111-4111-a111-111111111111',
    'St. John''s Stout Braised Short Rib',
    'Canceled takeout order just plated from the simmer pot. Served with Yukon gold purée and rich pan jus.',
    'Pub Fare',
    'canceled_order',
    3600,
    1800,
    1,
    1,
    NOW(),
    NOW() + INTERVAL '25 minutes',
    ARRAY['Meat', 'Dairy'],
    'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    'active'
  ),
  (
    'l2222222-2222-4222-a222-222222222201',
    'a2222222-2222-4222-a222-222222222222',
    'Chicken Parmesan Sandwich',
    'Kitchen duplicate ticket. Crisp chicken cutlet with melted fior di latte and warm marinara on toasted ciabatta.',
    'Bistro',
    'kitchen_error',
    2200,
    1100,
    1,
    1,
    NOW(),
    NOW() + INTERVAL '30 minutes',
    ARRAY['Meat', 'Dairy', 'Gluten'],
    'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=800&q=80',
    'active'
  ),
  (
    'l3333333-3333-4333-a333-333333333301',
    'a3333333-3333-4333-a333-333333333333',
    'Cat’s Favourite Pizza (Hot Honey)',
    'End of shift extra bake. Crispy wood-fired sourdough with cup & char pepperoni, whipped ricotta, and hot honey.',
    'Pizza',
    'day_end_surplus',
    2200,
    1100,
    2,
    2,
    NOW(),
    NOW() + INTERVAL '40 minutes',
    ARRAY['Meat', 'Dairy', 'Gluten'],
    'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80',
    'active'
  ),
  (
    'l4444444-4444-4444-a444-444444444401',
    'a4444444-4444-4444-a444-444444444444',
    'Truffle Fries',
    'Freshly fried hand-cut russet fries with white truffle oil and generous Parmigiano Reggiano.',
    'Upscale Bar',
    'kitchen_error',
    1600,
    800,
    1,
    1,
    NOW(),
    NOW() + INTERVAL '18 minutes',
    ARRAY['Vegetarian', 'Dairy'],
    'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80',
    'active'
  ),
  (
    'l5555555-5555-4555-a555-555555555501',
    'a5555555-5555-4555-a555-555555555555',
    'Apple Flip (Pack of 2)',
    'Afternoon pastry surplus. Warm flaky Newfoundland puff pastry with spiced local apples.',
    'Bakery',
    'day_end_surplus',
    700,
    350,
    3,
    3,
    NOW(),
    NOW() + INTERVAL '45 minutes',
    ARRAY['Vegetarian', 'Gluten'],
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    'active'
  )
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  quantity = EXCLUDED.quantity,
  pickup_cutoff = EXCLUDED.pickup_cutoff;

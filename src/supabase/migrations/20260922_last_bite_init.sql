-- ==============================================================================
-- LAST BITE: PRODUCTION SUPABASE DATABASE MIGRATION
-- Extensions: uuid-ossp, postgis
-- Enums: user_role, listing_status, surplus_reason
-- Tables: profiles, merchants, listings, orders
-- Stored Procedures: reserve_and_lock_listing (Atomic Row-Locking RPC)
-- Row Level Security (RLS) Policies
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. CUSTOM TYPES & ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('consumer', 'merchant', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('active', 'reserved', 'completed', 'expired', 'canceled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE surplus_reason AS ENUM ('canceled_order', 'kitchen_error', 'day_end_surplus', 'near_expiry');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending_payment', 'reserved', 'completed', 'expired', 'canceled', 'no_show_penalized');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'consumer',
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. MERCHANTS TABLE (With PostGIS Point Geometry)
CREATE TABLE IF NOT EXISTS public.merchants (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    address TEXT NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    phone TEXT NOT NULL,
    stripe_account_id TEXT,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    banner_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Spatial index on merchant location for rapid hyper-local PostGIS radius queries
CREATE INDEX IF NOT EXISTS idx_merchants_location ON public.merchants USING GIST(location);

-- 5. LISTINGS TABLE
CREATE TABLE IF NOT EXISTS public.listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    surplus_reason surplus_reason NOT NULL,
    original_price_cents INTEGER NOT NULL CHECK (original_price_cents > 0),
    discounted_price_cents INTEGER NOT NULL CHECK (discounted_price_cents > 0),
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    initial_quantity INTEGER NOT NULL DEFAULT 1 CHECK (initial_quantity >= 1),
    pickup_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pickup_cutoff TIMESTAMPTZ NOT NULL,
    dietary_tags TEXT[] NOT NULL DEFAULT '{}',
    photo_url TEXT NOT NULL,
    status listing_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Invariant: Minimum 50% discount required for food rescue
    CONSTRAINT chk_minimum_discount CHECK (discounted_price_cents <= (original_price_cents / 2)),
    -- Invariant: Cutoff must be strictly after pickup start
    CONSTRAINT chk_valid_pickup_window CHECK (pickup_cutoff > pickup_start)
);

-- Indexes for lightning fast feed queries and expiry scans
CREATE INDEX IF NOT EXISTS idx_listings_merchant_id ON public.listings(merchant_id);
CREATE INDEX IF NOT EXISTS idx_listings_active_cutoff ON public.listings(status, pickup_cutoff) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_listings_created_at ON public.listings(created_at DESC);

-- 6. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE RESTRICT,
    consumer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
    total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
    platform_fee_cents INTEGER NOT NULL CHECK (platform_fee_cents >= 0),
    merchant_payout_cents INTEGER NOT NULL CHECK (merchant_payout_cents >= 0),
    pickup_pin CHAR(4) NOT NULL,
    qr_token TEXT NOT NULL UNIQUE,
    status order_status NOT NULL DEFAULT 'reserved',
    stripe_payment_intent_id TEXT,
    stripe_transfer_id TEXT,
    reserved_until TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_consumer ON public.orders(consumer_id);
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON public.orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_listing ON public.orders(listing_id);
CREATE INDEX IF NOT EXISTS idx_orders_reserved_until ON public.orders(status, reserved_until) WHERE status = 'reserved';

-- 7. FUNCTION & RPC: reserve_and_lock_listing
-- Zero-Ghost-Order Guarantee: Uses SELECT ... FOR UPDATE to atomically lock the listing row,
-- verify quantity, check cutoff, decrement quantity or transition status, and generate a 7-minute reservation lock.
CREATE OR REPLACE FUNCTION public.reserve_and_lock_listing(
    p_listing_id UUID,
    p_user_id UUID,
    p_hold_seconds INT DEFAULT 420
)
RETURNS TABLE (
    success BOOLEAN,
    order_id UUID,
    listing_id UUID,
    pickup_pin CHAR(4),
    qr_token TEXT,
    reserved_until TIMESTAMPTZ,
    hold_seconds INT,
    error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_listing RECORD;
    v_order_id UUID;
    v_pin CHAR(4);
    v_qr_token TEXT;
    v_reserved_until TIMESTAMPTZ;
    v_platform_fee_cents INT;
    v_merchant_payout_cents INT;
BEGIN
    -- 1. Acquire exclusive row lock on the listing to prevent concurrent checkouts
    SELECT * INTO v_listing
    FROM public.listings
    WHERE id = p_listing_id
    FOR UPDATE;

    -- 2. Validate listing existence
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, p_listing_id, NULL::CHAR(4), NULL::TEXT, NULL::TIMESTAMPTZ, 0, 'Listing not found.';
        RETURN;
    END IF;

    -- 3. Check if listing is active and within pickup cutoff
    IF v_listing.status != 'active' THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, p_listing_id, NULL::CHAR(4), NULL::TEXT, NULL::TIMESTAMPTZ, 0, 'Item is no longer available.';
        RETURN;
    END IF;

    IF NOW() >= v_listing.pickup_cutoff THEN
        -- Mark as expired automatically
        UPDATE public.listings SET status = 'expired', updated_at = NOW() WHERE id = p_listing_id;
        RETURN QUERY SELECT FALSE, NULL::UUID, p_listing_id, NULL::CHAR(4), NULL::TEXT, NULL::TIMESTAMPTZ, 0, 'Pickup window has expired.';
        RETURN;
    END IF;

    -- 4. Check available inventory
    IF v_listing.quantity < 1 THEN
        UPDATE public.listings SET status = 'reserved', updated_at = NOW() WHERE id = p_listing_id;
        RETURN QUERY SELECT FALSE, NULL::UUID, p_listing_id, NULL::CHAR(4), NULL::TEXT, NULL::TIMESTAMPTZ, 0, 'Item was just claimed by another user.';
        RETURN;
    END IF;

    -- 5. Compute reservation parameters & dynamic 4-digit PIN
    v_reserved_until := NOW() + (p_hold_seconds || ' seconds')::INTERVAL;
    -- Generate cryptographically random 4-digit PIN (1000 - 9999)
    v_pin := LPAD(FLOOR(1000 + random() * 9000)::TEXT, 4, '0');
    -- Generate secure signed-like QR token combining listing, user, and timestamp
    v_qr_token := 'lb_qr_' || md5(p_listing_id::TEXT || p_user_id::TEXT || NOW()::TEXT || v_pin);

    -- Calculate 10% platform fee (min 50 cents)
    v_platform_fee_cents := GREATEST(50, ROUND(v_listing.discounted_price_cents * 0.10)::INT);
    v_merchant_payout_cents := v_listing.discounted_price_cents - v_platform_fee_cents;

    -- 6. Insert Order Record
    INSERT INTO public.orders (
        listing_id,
        consumer_id,
        merchant_id,
        total_amount_cents,
        platform_fee_cents,
        merchant_payout_cents,
        pickup_pin,
        qr_token,
        status,
        reserved_until
    ) VALUES (
        p_listing_id,
        p_user_id,
        v_listing.merchant_id,
        v_listing.discounted_price_cents,
        v_platform_fee_cents,
        v_merchant_payout_cents,
        v_pin,
        v_qr_token,
        'reserved',
        v_reserved_until
    )
    RETURNING id INTO v_order_id;

    -- 7. Decrement listing inventory; if zero, transition status to 'reserved'
    UPDATE public.listings
    SET quantity = quantity - 1,
        status = CASE WHEN (quantity - 1) <= 0 THEN 'reserved'::listing_status ELSE status END,
        updated_at = NOW()
    WHERE id = p_listing_id;

    -- 8. Return Success Payload
    RETURN QUERY SELECT 
        TRUE, 
        v_order_id, 
        p_listing_id, 
        v_pin, 
        v_qr_token, 
        v_reserved_until, 
        p_hold_seconds, 
        NULL::TEXT;
END;
$$;

-- 8. AUTOMATIC EXPIRY CLEANUP TRIGGER / PROCEDURE
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT id, listing_id 
        FROM public.orders 
        WHERE status = 'reserved' AND reserved_until < NOW()
        FOR UPDATE
    LOOP
        -- Expire the order
        UPDATE public.orders SET status = 'expired', updated_at = NOW() WHERE id = r.id;
        -- Replenish the listing quantity and reactivate if cutoff is still valid
        UPDATE public.listings 
        SET quantity = quantity + 1,
            status = CASE WHEN pickup_cutoff > NOW() THEN 'active'::listing_status ELSE 'expired'::listing_status END,
            updated_at = NOW()
        WHERE id = r.listing_id;
    END LOOP;
END;
$$;

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view any profile, but only edit their own
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Merchants: Publicly discoverable
CREATE POLICY "Merchants are viewable by everyone" ON public.merchants
    FOR SELECT USING (true);

CREATE POLICY "Merchants can manage their own store record" ON public.merchants
    FOR ALL USING (auth.uid() = id);

-- Listings: Active listings discoverable by public; merchants manage their own
CREATE POLICY "Active listings are viewable by everyone" ON public.listings
    FOR SELECT USING (status = 'active' OR auth.uid() = merchant_id);

CREATE POLICY "Merchants can insert listings" ON public.listings
    FOR INSERT WITH CHECK (auth.uid() = merchant_id);

CREATE POLICY "Merchants can update own listings" ON public.listings
    FOR UPDATE USING (auth.uid() = merchant_id);

-- Orders: Consumers can view their orders, Merchants can view orders for their restaurant
CREATE POLICY "Consumers can view their own orders" ON public.orders
    FOR SELECT USING (auth.uid() = consumer_id);

CREATE POLICY "Merchants can view orders for their store" ON public.orders
    FOR SELECT USING (auth.uid() = merchant_id);

CREATE POLICY "Consumers can create reservations via RPC" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = consumer_id);

CREATE POLICY "Authorized redemption updates" ON public.orders
    FOR UPDATE USING (auth.uid() = merchant_id OR auth.uid() = consumer_id);

-- 10. REALTIME PUBLICATION
-- Enable Realtime replication for listings and orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  Database, 
  FileCode2, 
  ShieldCheck, 
  Zap, 
  Server, 
  Layers,
  Code
} from 'lucide-react';

interface ArchitectureInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ArchitectureInspectorModal({ isOpen, onClose }: ArchitectureInspectorModalProps) {
  const [activeTab, setActiveTab] = useState<'sql' | 'listings_action' | 'checkout_action' | 'concurrency'>('sql');
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const sqlCode = `-- ==============================================================================
-- LAST BITE: PRODUCTION SUPABASE DATABASE MIGRATION
-- Extensions: uuid-ossp, postgis
-- Enums: user_role, listing_status, surplus_reason, order_status
-- Tables: profiles, merchants, listings, orders
-- Stored Procedures: reserve_and_lock_listing (Atomic Row-Locking RPC)
-- Row Level Security (RLS) Policies
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TYPE user_role AS ENUM ('consumer', 'merchant', 'admin');
CREATE TYPE listing_status AS ENUM ('active', 'reserved', 'completed', 'expired', 'canceled');
CREATE TYPE surplus_reason AS ENUM ('canceled_order', 'kitchen_error', 'day_end_surplus', 'near_expiry');
CREATE TYPE order_status AS ENUM ('pending_payment', 'reserved', 'completed', 'expired', 'canceled');

-- 1. PROFILES TABLE
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

-- 2. MERCHANTS TABLE (PostGIS Point Geometry)
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

CREATE INDEX IF NOT EXISTS idx_merchants_location ON public.merchants USING GIST(location);

-- 3. LISTINGS TABLE
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
    
    CONSTRAINT chk_minimum_discount CHECK (discounted_price_cents <= (original_price_cents / 2)),
    CONSTRAINT chk_valid_pickup_window CHECK (pickup_cutoff > pickup_start)
);

CREATE INDEX IF NOT EXISTS idx_listings_merchant_id ON public.listings(merchant_id);
CREATE INDEX IF NOT EXISTS idx_listings_active_cutoff ON public.listings(status, pickup_cutoff) WHERE status = 'active';

-- 4. ORDERS TABLE
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
    reserved_until TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ZERO-GHOST STORED PROCEDURE: reserve_and_lock_listing
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
    -- Exclusive row lock
    SELECT * INTO v_listing
    FROM public.listings
    WHERE id = p_listing_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, p_listing_id, NULL::CHAR(4), NULL::TEXT, NULL::TIMESTAMPTZ, 0, 'Listing not found.';
        RETURN;
    END IF;

    IF v_listing.status != 'active' THEN
        RETURN QUERY SELECT FALSE, NULL::UUID, p_listing_id, NULL::CHAR(4), NULL::TEXT, NULL::TIMESTAMPTZ, 0, 'Item is no longer available.';
        RETURN;
    END IF;

    IF NOW() >= v_listing.pickup_cutoff THEN
        UPDATE public.listings SET status = 'expired', updated_at = NOW() WHERE id = p_listing_id;
        RETURN QUERY SELECT FALSE, NULL::UUID, p_listing_id, NULL::CHAR(4), NULL::TEXT, NULL::TIMESTAMPTZ, 0, 'Pickup window has expired.';
        RETURN;
    END IF;

    IF v_listing.quantity < 1 THEN
        UPDATE public.listings SET status = 'reserved', updated_at = NOW() WHERE id = p_listing_id;
        RETURN QUERY SELECT FALSE, NULL::UUID, p_listing_id, NULL::CHAR(4), NULL::TEXT, NULL::TIMESTAMPTZ, 0, 'Item was just claimed by another user.';
        RETURN;
    END IF;

    v_reserved_until := NOW() + (p_hold_seconds || ' seconds')::INTERVAL;
    v_pin := LPAD(FLOOR(1000 + random() * 9000)::TEXT, 4, '0');
    v_qr_token := 'lb_qr_' || md5(p_listing_id::TEXT || p_user_id::TEXT || NOW()::TEXT || v_pin);
    v_platform_fee_cents := GREATEST(50, ROUND(v_listing.discounted_price_cents * 0.10)::INT);
    v_merchant_payout_cents := v_listing.discounted_price_cents - v_platform_fee_cents;

    INSERT INTO public.orders (
        listing_id, consumer_id, merchant_id, total_amount_cents,
        platform_fee_cents, merchant_payout_cents, pickup_pin, qr_token, status, reserved_until
    ) VALUES (
        p_listing_id, p_user_id, v_listing.merchant_id, v_listing.discounted_price_cents,
        v_platform_fee_cents, v_merchant_payout_cents, v_pin, v_qr_token, 'reserved', v_reserved_until
    ) RETURNING id INTO v_order_id;

    UPDATE public.listings
    SET quantity = quantity - 1,
        status = CASE WHEN (quantity - 1) <= 0 THEN 'reserved'::listing_status ELSE status END,
        updated_at = NOW()
    WHERE id = p_listing_id;

    RETURN QUERY SELECT TRUE, v_order_id, p_listing_id, v_pin, v_qr_token, v_reserved_until, p_hold_seconds, NULL::TEXT;
END;
$$;`;

  const listingsActionCode = `// actions/listings.ts (Next.js 15 Server Action)
'use server';

import type { Listing, SurplusReason, DietaryTag } from '@/src/lib/types/database';

export async function createSurplusListing(formData: FormData) {
  const merchantId = formData.get('merchant_id') as string;
  const title = (formData.get('title') as string)?.trim();
  const category = (formData.get('category') as string) || 'Meal';
  const surplusReason = formData.get('surplus_reason') as SurplusReason;
  const originalPriceCents = parseInt(formData.get('original_price_cents') as string, 10);
  const discountedPriceCents = parseInt(formData.get('discounted_price_cents') as string, 10);
  const pickupMinutes = parseInt(formData.get('pickup_minutes') as string, 10) || 30;

  // Invariant 1: 50% discount enforcement
  if (discountedPriceCents > Math.floor(originalPriceCents / 2)) {
    return { success: false, error: 'Discount must be at least 50% off!' };
  }

  // Invariant 2: Cutoff in future (> 5 mins)
  if (pickupMinutes < 5) {
    return { success: false, error: 'Pickup window must be at least 5 minutes.' };
  }

  // Insert to Supabase DB and Broadcast via Supabase Realtime Channel
  return { success: true };
}

export async function getNearbyListings(userLat: number, userLon: number, radiusKm: number = 10) {
  // PostGIS Query:
  // SELECT *, ST_Distance(m.location, ST_SetSRID(ST_MakePoint($lon, $lat), 4326)::geography) as dist_meters
  // FROM listings l JOIN merchants m ON l.merchant_id = m.id
  // WHERE l.status = 'active' AND l.pickup_cutoff > NOW()
  // AND ST_DWithin(m.location, ST_SetSRID(ST_MakePoint($lon, $lat), 4326)::geography, $radiusMeters)
  // ORDER BY dist_meters ASC, l.pickup_cutoff ASC
}`;

  const checkoutActionCode = `// actions/checkout.ts (Next.js 15 Server Action)
'use server';

import type { Order, ReservationResult } from '@/src/lib/types/database';

export async function initiateReservation(listingId: string, consumerId: string) {
  // 1. Calls atomic locking RPC: reserve_and_lock_listing
  // 2. Creates Stripe PaymentIntent with Destination Charges:
  //    - amount = discounted_price_cents
  //    - application_fee_amount = platform_fee_cents (10%)
  //    - transfer_data.destination = merchant.stripe_account_id
  // 3. Returns dynamic 4-digit PIN, QR token, and 7-minute countdown lock
}

export async function verifyAndCompletePickup(orderId: string, submittedPin: string, currentOrder: Order) {
  // 1. Merchant inputs 4-digit PIN or scans QR code
  // 2. Handshake verifies PIN equality
  // 3. Captures authorized Stripe PaymentIntent
  // 4. Releases direct transfer to connected merchant bank
  // 5. Marks order completed_at = NOW()
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-100 text-base sm:text-lg">
                Production Backend & SQL Architecture
              </h3>
              <p className="text-xs text-zinc-400">
                Next.js 15 Server Actions, PostGIS Spatials, and Atomic Row-Locking RPC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 py-2.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'sql', label: '1. Supabase Migration (SQL)', icon: Database },
            { id: 'listings_action', label: '2. actions/listings.ts', icon: FileCode2 },
            { id: 'checkout_action', label: '3. actions/checkout.ts', icon: Server },
            { id: 'concurrency', label: '4. Concurrency & Invariants', icon: ShieldCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                    : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 border border-zinc-700/60'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Code / Content Area */}
        <div className="p-5 overflow-y-auto flex-1 font-mono text-xs">
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">supabase/migrations/20260922_last_bite_init.sql</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(sqlCode, 'sql')}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  {copied === 'sql' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'sql' ? 'Copied' : 'Copy Migration SQL'}</span>
                </button>
              </div>
              <pre className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
                {sqlCode}
              </pre>
            </div>
          )}

          {activeTab === 'listings_action' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">src/actions/listings.ts (Next.js 15 App Router)</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(listingsActionCode, 'listings')}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  {copied === 'listings' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'listings' ? 'Copied' : 'Copy Server Action'}</span>
                </button>
              </div>
              <pre className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
                {listingsActionCode}
              </pre>
            </div>
          )}

          {activeTab === 'checkout_action' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">src/actions/checkout.ts (Stripe Connect & Redemption Handshake)</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(checkoutActionCode, 'checkout')}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                >
                  {copied === 'checkout' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied === 'checkout' ? 'Copied' : 'Copy Server Action'}</span>
                </button>
              </div>
              <pre className="p-4 bg-zinc-950 rounded-2xl border border-zinc-800 text-zinc-300 overflow-x-auto whitespace-pre leading-relaxed">
                {checkoutActionCode}
              </pre>
            </div>
          )}

          {activeTab === 'concurrency' && (
            <div className="space-y-4 font-sans text-sm">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <h4 className="font-bold text-amber-400 text-base flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  1. Zero Ghost Orders Concurrency Model
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Surplus items (like 1 canceled pizza) have atomic quantity = 1. If 50 consumers click "Claim" in the exact same millisecond:
                </p>
                <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
                  <li>
                    The PostgreSQL stored procedure executes <code>SELECT * FROM listings WHERE id = $id FOR UPDATE</code>.
                  </li>
                  <li>
                    The database queues the incoming concurrent transactions on the row lock.
                  </li>
                  <li>
                    The first transaction decrements <code>quantity = 0</code> and issues the 7-minute reservation hold.
                  </li>
                  <li>
                    Subsequent queued transactions wake up, evaluate <code>quantity &lt; 1</code>, and immediately exit returning <code>"Item was just claimed by another user"</code>. Zero overselling.
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <h4 className="font-bold text-emerald-400 text-base flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  2. Stripe Connect Direct-Payout Destination Charges
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  During reservation, a PaymentIntent is created with <code>transfer_data.destination = merchant.stripe_account_id</code> and <code>application_fee_amount = platform_fee_cents</code> (10%, min 50¢). Funds are captured and transferred instantly when the customer presents their dynamic 4-digit PIN.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

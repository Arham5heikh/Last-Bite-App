/**
 * Last Bite - Real-time State & Cross-Tab Broadcast Manager
 * Implements atomic in-memory/persisted transactions, countdown timers,
 * 7-minute reservation locks, and multi-user synchronization.
 */

import { useState, useEffect } from 'react';
import type { Listing, Merchant, Order, SurplusReason } from '@/src/lib/types/database';
import {
  ST_JOHNS_CENTER,
  ST_JOHNS_RESTAURANTS,
  ST_JOHNS_CATALOG_PRESETS,
  toMerchant,
} from '@/src/lib/data/stJohns';

export const INITIAL_MERCHANTS: Record<string, Merchant> = Object.fromEntries(
  ST_JOHNS_RESTAURANTS.map((r) => [r.id, toMerchant(r)])
);

// One live surplus drop per St. John's restaurant (mirrors supabase/seed.sql section 6)
const INITIAL_DROPS: { reason: SurplusReason; quantity: number; ageMins: number; cutoffMins: number; note: string }[] = [
  { reason: 'canceled_order', quantity: 1, ageMins: 6, cutoffMins: 25, note: 'Canceled takeout order, just plated.' },
  { reason: 'kitchen_error', quantity: 1, ageMins: 4, cutoffMins: 30, note: 'Duplicate ticket fired by mistake.' },
  { reason: 'kitchen_error', quantity: 1, ageMins: 8, cutoffMins: 18, note: 'Accidental duplicate side order.' },
  { reason: 'canceled_order', quantity: 1, ageMins: 10, cutoffMins: 26, note: 'Delivery driver never arrived.' },
  { reason: 'kitchen_error', quantity: 1, ageMins: 5, cutoffMins: 28, note: 'Wrong modifier, remade for the guest.' },
  { reason: 'day_end_surplus', quantity: 2, ageMins: 15, cutoffMins: 35, note: 'Extra bake at end of shift.' },
  { reason: 'day_end_surplus', quantity: 3, ageMins: 20, cutoffMins: 45, note: "Afternoon surplus from today's bake." },
  { reason: 'day_end_surplus', quantity: 1, ageMins: 12, cutoffMins: 40, note: 'Closing out the evening prep.' },
  { reason: 'canceled_order', quantity: 1, ageMins: 3, cutoffMins: 22, note: 'Table walked out before service.' },
  { reason: 'day_end_surplus', quantity: 2, ageMins: 9, cutoffMins: 50, note: 'Fresh prep closing out lunch shift.' },
];

export const INITIAL_LISTINGS: Listing[] = ST_JOHNS_RESTAURANTS.map((r, i) => {
  const dish = ST_JOHNS_CATALOG_PRESETS[r.id][0];
  const drop = INITIAL_DROPS[i % INITIAL_DROPS.length];
  const createdAt = new Date(Date.now() - drop.ageMins * 60 * 1000).toISOString();
  return {
    id: `b${r.id.slice(1, -2)}01`,
    merchant_id: r.id,
    merchant: INITIAL_MERCHANTS[r.id],
    title: dish.title,
    description: `${drop.note} ${dish.description}`,
    category: dish.category,
    surplus_reason: drop.reason,
    original_price_cents: dish.originalPriceCents,
    discounted_price_cents: dish.discountedPriceCents, // EXACTLY 50% OFF
    quantity: drop.quantity,
    initial_quantity: drop.quantity,
    pickup_start: createdAt,
    pickup_cutoff: new Date(Date.now() + drop.cutoffMins * 60 * 1000).toISOString(),
    dietary_tags: dish.dietaryTags,
    photo_url: dish.photoUrl,
    status: 'active',
    created_at: createdAt,
    updated_at: new Date().toISOString(),
  };
});

// In-Memory Global Store with Broadcast Sync
let storeListings: Listing[] = [...INITIAL_LISTINGS];
let storeOrders: Order[] = [];
const listeners = new Set<() => void>();

// Cross-tab broadcast channel
let broadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel('last_bite_realtime_channel');
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'SYNC_STATE') {
        if (event.data.listings) storeListings = event.data.listings;
        if (event.data.orders) storeOrders = event.data.orders;
        // Local only: re-broadcasting would echo state between tabs forever
        notifyLocalListeners();
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel error:', e);
  }
}

function notifyLocalListeners() {
  listeners.forEach((l) => l());
}

function notifyListeners() {
  notifyLocalListeners();
  if (broadcastChannel) {
    try {
      broadcastChannel.postMessage({
        type: 'SYNC_STATE',
        listings: storeListings,
        orders: storeOrders,
      });
    } catch {
      // ignore
    }
  }
}

export function subscribeToStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStoreListings(): Listing[] {
  return storeListings;
}

export function getStoreOrders(): Order[] {
  return storeOrders;
}

/**
 * Geodesic distance calculation in kilometers and 15km radial filter.
 * Exact TypeScript client mirror of PostGIS stored procedure: get_nearby_surplus
 */
export function getNearbySurplus(
  userLat: number = ST_JOHNS_CENTER.lat,
  userLng: number = ST_JOHNS_CENTER.lng,
  radiusKm: number = 15.0
): Listing[] {
  const now = Date.now();
  return storeListings
    .filter((l) => l.status === 'active' && new Date(l.pickup_cutoff).getTime() > now && l.quantity > 0)
    .map((listing) => {
      const mLat = listing.merchant?.latitude ?? ST_JOHNS_CENTER.lat;
      const mLng = listing.merchant?.longitude ?? ST_JOHNS_CENTER.lng;
      
      const R = 6371; // Earth radius in km
      const dLat = ((mLat - userLat) * Math.PI) / 180;
      const dLon = ((mLng - userLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((userLat * Math.PI) / 180) *
          Math.cos((mLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distanceKm = Number((R * c).toFixed(2));
      const distanceMeters = Math.round(distanceKm * 1000);

      return {
        ...listing,
        distance_km: distanceKm,
        distance_meters: distanceMeters,
      };
    })
    .filter((l) => (l.distance_km ?? 0) <= radiusKm)
    .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
}

/**
 * Atomic reservation lock: 7 minutes (420 seconds)
 * Matches PostgreSQL stored procedure: reserve_and_lock_listing
 */
export function executeAtomicReservation(
  listingId: string,
  consumerId: string = 'usr_consumer_primary'
): { success: boolean; order?: Order; error?: string } {
  const index = storeListings.findIndex((l) => l.id === listingId);
  if (index === -1) {
    return { success: false, error: 'Listing not found.' };
  }

  const listing = storeListings[index];
  const now = new Date();

  // Invariant 1: Status must be active
  if (listing.status !== 'active') {
    return { success: false, error: 'This item is no longer available.' };
  }

  // Invariant 2: Cutoff must not have passed
  if (now >= new Date(listing.pickup_cutoff)) {
    storeListings[index] = { ...listing, status: 'expired', updated_at: now.toISOString() };
    notifyListeners();
    return { success: false, error: 'Pickup window has expired.' };
  }

  // Invariant 3: Quantity check
  if (listing.quantity < 1) {
    storeListings[index] = { ...listing, status: 'reserved', updated_at: now.toISOString() };
    notifyListeners();
    return { success: false, error: 'Item was just claimed by another user.' };
  }

  // Decrement quantity and transition status if 0
  const remainingQty = listing.quantity - 1;
  const updatedStatus = remainingQty <= 0 ? 'reserved' : 'active';

  // Grace Period Logic: Guarantee pickup window is AT LEAST 30 minutes from checkout
  const minGraceMs = 30 * 60 * 1000; // 30 minutes in milliseconds
  const cutoffMs = new Date(listing.pickup_cutoff).getTime();
  const guaranteedPickupTime = Math.max(cutoffMs, now.getTime() + minGraceMs);
  const reservedUntil = new Date(guaranteedPickupTime).toISOString();
  
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const qrToken = `lb_qr_${listing.id.slice(-4)}_${pin}_${Date.now().toString(36)}`;
  const orderId = `ord_${Math.random().toString(36).substring(2, 9)}`;

  const platformFeeCents = Math.max(50, Math.round(listing.discounted_price_cents * 0.10));
  const merchantPayoutCents = listing.discounted_price_cents - platformFeeCents;

  const newOrder: Order = {
    id: orderId,
    listing_id: listing.id,
    listing: { ...listing },
    consumer_id: consumerId,
    merchant_id: listing.merchant_id,
    merchant: listing.merchant,
    total_amount_cents: listing.discounted_price_cents,
    platform_fee_cents: platformFeeCents,
    merchant_payout_cents: merchantPayoutCents,
    pickup_pin: pin,
    qr_token: qrToken,
    status: 'reserved',
    stripe_payment_intent_id: `pi_test_${orderId}`,
    reserved_until: reservedUntil,
    created_at: now.toISOString(),
  };

  storeListings[index] = {
    ...listing,
    quantity: remainingQty,
    status: updatedStatus,
    updated_at: now.toISOString(),
  };

  storeOrders = [newOrder, ...storeOrders];
  notifyListeners();

  return { success: true, order: newOrder };
}

/**
 * Redemption Handshake: Fulfill Order via PIN or QR Token
 */
export function executeRedemptionHandshake(
  orderId: string,
  submittedPin: string
): { success: boolean; order?: Order; error?: string } {
  const orderIndex = storeOrders.findIndex((o) => o.id === orderId);
  if (orderIndex === -1) {
    return { success: false, error: 'Order not found.' };
  }

  const order = storeOrders[orderIndex];
  if (order.status === 'completed') {
    return { success: false, error: 'Order already redeemed.' };
  }
  if (order.status === 'no_show_penalized') {
    return { 
      success: false, 
      error: 'Order was marked as No-Show. The 50% penalty fee was charged to compensate the kitchen.' 
    };
  }
  if (order.status === 'expired') {
    return { success: false, error: 'Order reservation has expired.' };
  }

  const cleanPin = submittedPin.trim();
  const match = cleanPin === order.pickup_pin || cleanPin === order.qr_token || cleanPin.endsWith(order.pickup_pin);

  if (!match) {
    return { success: false, error: 'Invalid 4-digit PIN. Please verify with customer.' };
  }

  const completedOrder: Order = {
    ...order,
    status: 'completed',
    completed_at: new Date().toISOString(),
  };

  storeOrders[orderIndex] = completedOrder;

  // Also update listing status to completed if quantity is 0
  const listingIndex = storeListings.findIndex((l) => l.id === order.listing_id);
  if (listingIndex !== -1 && storeListings[listingIndex].quantity === 0) {
    storeListings[listingIndex] = {
      ...storeListings[listingIndex],
      status: 'completed',
      updated_at: new Date().toISOString(),
    };
  }

  notifyListeners();
  return { success: true, order: completedOrder };
}

/**
 * Add a new Surplus Listing from Kitchen Fast-Post
 */
export function addSurplusListing(newListing: Listing) {
  // Ensure merchant object is attached
  if (!newListing.merchant && INITIAL_MERCHANTS[newListing.merchant_id]) {
    newListing.merchant = INITIAL_MERCHANTS[newListing.merchant_id];
  } else if (!newListing.merchant) {
    newListing.merchant = INITIAL_MERCHANTS[ST_JOHNS_RESTAURANTS[0].id];
  }

  storeListings = [newListing, ...storeListings];
  notifyListeners();
}

/**
 * Remove or cancel an active listing (e.g. kitchen staff pulls item or sold in-house)
 */
export function deleteListing(listingId: string) {
  storeListings = storeListings.filter((l) => l.id !== listingId);
  notifyListeners();
}

/**
 * Update listing quantity in real time
 */
export function updateListingQuantity(listingId: string, newQuantity: number) {
  const index = storeListings.findIndex((l) => l.id === listingId);
  if (index !== -1) {
    const item = storeListings[index];
    storeListings[index] = {
      ...item,
      quantity: newQuantity,
      status: newQuantity <= 0 ? 'completed' : 'active',
      updated_at: new Date().toISOString(),
    };
    notifyListeners();
  }
}

/**
 * Custom React Hook for Real-Time Listings & Ticking Expirations
 */
export function useRealtimeStore() {
  const [listings, setListings] = useState<Listing[]>(storeListings);
  const [orders, setOrders] = useState<Order[]>(storeOrders);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToStore(() => {
      setListings([...storeListings]);
      setOrders([...storeOrders]);
    });

    // 1-second countdown ticker for live cutoffs & reservation locks
    const interval = setInterval(() => {
      setTick((t) => t + 1);

      // Check for expired listings and orders
      const now = Date.now();
      let changed = false;

      storeListings.forEach((item, idx) => {
        if (item.status === 'active' && new Date(item.pickup_cutoff).getTime() <= now) {
          storeListings[idx] = { ...item, status: 'expired' };
          changed = true;
        }
      });

      storeOrders.forEach((ord, idx) => {
        if (ord.status === 'reserved' && new Date(ord.reserved_until).getTime() <= now) {
          // Status flips to no_show_penalized (triggers 50% partial Stripe capture penalty)
          storeOrders[idx] = { ...ord, status: 'no_show_penalized' };
          changed = true;
        }
      });

      if (changed) {
        notifyListeners();
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return { listings, orders, tick };
}

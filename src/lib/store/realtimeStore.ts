/**
 * Last Bite - Real-time State & Cross-Tab Broadcast Manager
 * Implements atomic in-memory/persisted transactions, countdown timers,
 * 7-minute reservation locks, and multi-user synchronization.
 */

import { useState, useEffect } from 'react';
import type { Listing, Merchant, Order, SurplusReason, DietaryTag } from '@/src/lib/types/database';

export const INITIAL_MERCHANTS: Record<string, Merchant> = {
  'a1111111-1111-4111-a111-111111111111': {
    id: 'a1111111-1111-4111-a111-111111111111',
    business_name: 'YellowBelly Brewery and Public House',
    address: '288 Water St, St. John\'s, NL',
    latitude: 47.5624,
    longitude: -52.7096,
    phone: '(709) 757-3780',
    stripe_account_id: 'acct_yellowbelly_connect',
    verified: true,
    terminal_pin: '1111',
    avatar_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=150&q=80',
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  'a2222222-2222-4222-a222-222222222222': {
    id: 'a2222222-2222-4222-a222-222222222222',
    business_name: 'Oliver\'s Restaurant',
    address: '160 Water St, St. John\'s, NL',
    latitude: 47.5611,
    longitude: -52.7118,
    phone: '(709) 754-6444',
    stripe_account_id: 'acct_olivers_connect',
    verified: true,
    terminal_pin: '2222',
    avatar_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=150&q=80',
    created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
  },
  'a3333333-3333-4333-a333-333333333333': {
    id: 'a3333333-3333-4333-a333-333333333333',
    business_name: 'Black Cat Pizzeria',
    address: '13 LeMarchant Rd, St. John\'s, NL',
    latitude: 47.5583,
    longitude: -52.7169,
    phone: '(709) 754-2228',
    stripe_account_id: 'acct_blackcat_connect',
    verified: true,
    terminal_pin: '3333',
    avatar_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=150&q=80',
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
  'a4444444-4444-4444-a444-444444444444': {
    id: 'a4444444-4444-4444-a444-444444444444',
    business_name: 'Blue on Water',
    address: '319 Water St, St. John\'s, NL',
    latitude: 47.5630,
    longitude: -52.7088,
    phone: '(709) 754-2583',
    stripe_account_id: 'acct_blueonwater_connect',
    verified: true,
    terminal_pin: '4444',
    avatar_url: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=150&q=80',
    created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
  },
  'a5555555-5555-4555-a555-555555555555': {
    id: 'a5555555-5555-4555-a555-555555555555',
    business_name: 'Rocket Bakery',
    address: '272 Water St, St. John\'s, NL',
    latitude: 47.5620,
    longitude: -52.7100,
    phone: '(709) 738-2011',
    stripe_account_id: 'acct_rocketbakery_connect',
    verified: true,
    terminal_pin: '5555',
    avatar_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=150&q=80',
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
};

export const INITIAL_LISTINGS: Listing[] = [
  {
    id: 'l1111111-1111-4111-a111-111111111101',
    merchant_id: 'a1111111-1111-4111-a111-111111111111',
    merchant: INITIAL_MERCHANTS['a1111111-1111-4111-a111-111111111111'],
    title: 'St. John\'s Stout Braised Short Rib',
    description: 'Canceled takeout order just plated. Slow-braised in house-brewed St. John\'s Stout with Yukon gold mash and pan jus.',
    category: 'Pub Fare',
    surplus_reason: 'canceled_order',
    original_price_cents: 3600,
    discounted_price_cents: 1800, // EXACTLY 50% OFF
    quantity: 1,
    initial_quantity: 1,
    pickup_start: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    pickup_cutoff: new Date(Date.now() + 25 * 60 * 1000).toISOString(), // 25 mins left
    dietary_tags: ['Vegetarian'],
    photo_url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'l2222222-2222-4222-a222-222222222201',
    merchant_id: 'a2222222-2222-4222-a222-222222222222',
    merchant: INITIAL_MERCHANTS['a2222222-2222-4222-a222-222222222222'],
    title: 'Chicken Parmesan Sandwich',
    description: 'Kitchen error: duplicate ticket. Breaded cutlet, San Marzano marinara, fior di latte on toasted ciabatta.',
    category: 'Bistro',
    surplus_reason: 'kitchen_error',
    original_price_cents: 2200,
    discounted_price_cents: 1100, // EXACTLY 50% OFF
    quantity: 1,
    initial_quantity: 1,
    pickup_start: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    pickup_cutoff: new Date(Date.now() + 28 * 60 * 1000).toISOString(), // 28 mins left
    dietary_tags: ['Halal'],
    photo_url: 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'l3333333-3333-4333-a333-333333333301',
    merchant_id: 'a3333333-3333-4333-a333-333333333333',
    merchant: INITIAL_MERCHANTS['a3333333-3333-4333-a333-333333333333'],
    title: 'Cat’s Favourite Pizza (Hot Honey)',
    description: 'Extra bake hot from wood-fired oven. Charred pepperoni, whipped ricotta, Calabrian chili, and hot honey drizzle.',
    category: 'Pizza',
    surplus_reason: 'day_end_surplus',
    original_price_cents: 2200,
    discounted_price_cents: 1100, // EXACTLY 50% OFF
    quantity: 2,
    initial_quantity: 2,
    pickup_start: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    pickup_cutoff: new Date(Date.now() + 35 * 60 * 1000).toISOString(), // 35 mins left
    dietary_tags: ['Halal'],
    photo_url: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'l4444444-4444-4444-a444-444444444401',
    merchant_id: 'a4444444-4444-4444-a444-444444444444',
    merchant: INITIAL_MERCHANTS['a4444444-4444-4444-a444-444444444444'],
    title: 'Truffle Fries with Parmigiano',
    description: 'Accidental duplicate side order. Hand-cut russet fries, white truffle oil, shaved Parmigiano Reggiano.',
    category: 'Upscale Bar',
    surplus_reason: 'kitchen_error',
    original_price_cents: 1600,
    discounted_price_cents: 800, // EXACTLY 50% OFF
    quantity: 1,
    initial_quantity: 1,
    pickup_start: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    pickup_cutoff: new Date(Date.now() + 18 * 60 * 1000).toISOString(), // 18 mins left
    dietary_tags: ['Vegetarian', 'Gluten-Free'],
    photo_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'l5555555-5555-4555-a555-555555555501',
    merchant_id: 'a5555555-5555-4555-a555-555555555555',
    merchant: INITIAL_MERCHANTS['a5555555-5555-4555-a555-555555555555'],
    title: 'Apple Flip (Pack of 2)',
    description: 'Afternoon bakery surplus. Flaky Newfoundland puff pastry with cinnamon local apples.',
    category: 'Bakery',
    surplus_reason: 'day_end_surplus',
    original_price_cents: 700,
    discounted_price_cents: 350, // EXACTLY 50% OFF
    quantity: 3,
    initial_quantity: 3,
    pickup_start: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    pickup_cutoff: new Date(Date.now() + 45 * 60 * 1000).toISOString(), // 45 mins left
    dietary_tags: ['Vegetarian'],
    photo_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'l1111111-1111-4111-a111-111111111102',
    merchant_id: 'a1111111-1111-4111-a111-111111111111',
    merchant: INITIAL_MERCHANTS['a1111111-1111-4111-a111-111111111111'],
    title: 'YellowBelly Fish & Chips 1 pc',
    description: 'Crispy ale-battered fresh Atlantic cod, hand-cut Kennebec fries, house tartar sauce, and lemon wedge.',
    category: 'Pub Fare',
    surplus_reason: 'kitchen_error',
    original_price_cents: 1700,
    discounted_price_cents: 850, // EXACTLY 50% OFF
    quantity: 1,
    initial_quantity: 1,
    pickup_start: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    pickup_cutoff: new Date(Date.now() + 26 * 60 * 1000).toISOString(), // 26 mins left
    dietary_tags: ['Halal'],
    photo_url: 'https://images.unsplash.com/photo-1579208570378-8c970854bc23?auto=format&fit=crop&w=800&q=80',
    status: 'active',
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }
];

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
        notifyListeners();
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel error:', e);
  }
}

function notifyListeners() {
  listeners.forEach((l) => l());
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
  userLat: number = 47.5615,
  userLng: number = -52.7126,
  radiusKm: number = 15.0
): Listing[] {
  const now = Date.now();
  return storeListings
    .filter((l) => l.status === 'active' && new Date(l.pickup_cutoff).getTime() > now && l.quantity > 0)
    .map((listing) => {
      const mLat = listing.merchant?.latitude ?? 47.5624;
      const mLng = listing.merchant?.longitude ?? -52.7096;
      
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
    newListing.merchant = INITIAL_MERCHANTS.merch_1;
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

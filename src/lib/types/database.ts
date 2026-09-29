/**
 * Last Bite - Database & Application Type Definitions
 * Complete strict TypeScript definitions for PostgreSQL / Supabase Schema & Next.js 15
 */

export type UserRole = 'consumer' | 'merchant' | 'admin';

export type ListingStatus = 'active' | 'reserved' | 'completed' | 'expired' | 'canceled';

export type SurplusReason = 
  | 'canceled_order' 
  | 'kitchen_error' 
  | 'day_end_surplus' 
  | 'near_expiry';

export type DietaryTag = 
  | 'Halal' 
  | 'Vegan' 
  | 'Vegetarian' 
  | 'Gluten-Free' 
  | 'Nut-Free' 
  | 'Dairy-Free' 
  | 'Kosher';

export interface Profile {
  id: string; // references auth.users.id
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Merchant {
  id: string; // references profiles.id
  business_name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string;
  stripe_account_id: string | null;
  verified: boolean;
  avatar_url?: string;
  terminal_pin?: string;
  created_at: string;
}

export interface CatalogItem {
  id: string;
  merchant_id: string;
  title: string;
  description: string;
  category: string;
  original_price_cents: number;
  discounted_price_cents: number;
  allergens: string[];
  dietary_tags: string[];
  photo_url: string;
}

export interface Listing {
  id: string;
  merchant_id: string;
  merchant?: Merchant;
  title: string;
  description: string;
  category: string;
  surplus_reason: SurplusReason;
  original_price_cents: number;
  discounted_price_cents: number;
  quantity: number;
  initial_quantity: number;
  pickup_start: string;
  pickup_cutoff: string;
  dietary_tags: DietaryTag[];
  photo_url: string;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  // Computed fields on query
  distance_meters?: number;
  distance_km?: number;
  remaining_seconds?: number;
}

export type OrderStatus = 'pending_payment' | 'reserved' | 'completed' | 'expired' | 'canceled' | 'no_show_penalized';

export interface Order {
  id: string;
  listing_id: string;
  listing?: Listing;
  consumer_id: string;
  consumer?: Profile;
  merchant_id: string;
  merchant?: Merchant;
  total_amount_cents: number;
  platform_fee_cents: number;
  merchant_payout_cents: number;
  pickup_pin: string; // 4-digit dynamic PIN
  qr_token: string; // Cryptographically signed token string
  status: OrderStatus;
  stripe_payment_intent_id?: string;
  stripe_transfer_id?: string;
  reserved_until: string; // ISO timestamp (usually 7 minutes from creation)
  completed_at?: string | null;
  created_at: string;
}

export interface ReservationResult {
  success: boolean;
  order_id?: string;
  listing_id?: string;
  pickup_pin?: string;
  qr_token?: string;
  reserved_until?: string;
  client_secret?: string;
  hold_seconds: number;
  error?: string;
}

export interface CreateListingInput {
  merchant_id: string;
  title: string;
  description: string;
  category: string;
  surplus_reason: SurplusReason;
  original_price_cents: number;
  discounted_price_cents: number;
  quantity: number;
  pickup_minutes_from_now: number;
  dietary_tags: DietaryTag[];
  photo_url?: string;
  photo_file?: File | Blob | null;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

import React, { useState, useMemo } from 'react';
import { 
  Flame, 
  MapPin, 
  Clock, 
  Zap, 
  Map as MapIcon, 
  Grid, 
  SlidersHorizontal, 
  Filter, 
  Search, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  TrendingDown,
  Navigation,
  UtensilsCrossed,
  Radio
} from 'lucide-react';
import type { Listing, SurplusReason } from '@/src/lib/types/database';
import { RadarMap } from '@/src/components/map/RadarMap';
import { LeafletSurplusMap } from '@/src/components/consumer/LeafletSurplusMap';
import { ST_JOHNS_CENTER, ST_JOHNS_RESTAURANTS } from '@/src/lib/data/stJohns';

interface LiveFeedProps {
  listings: Listing[];
  onClaimListing: (listing: Listing) => void;
  userLat?: number;
  userLon?: number;
}

const CATEGORIES = ['All', ...Array.from(new Set(ST_JOHNS_RESTAURANTS.map((r) => r.category)))];

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function LiveFeed({
  listings,
  onClaimListing,
  userLat = ST_JOHNS_CENTER.lat,
  userLon = ST_JOHNS_CENTER.lng,
}: LiveFeedProps) {
  const [viewMode, setViewMode] = useState<'leaflet' | 'split' | 'cards' | 'radar'>('split');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'proximity' | 'cutoff' | 'discount'>('cutoff');
  const [activeListing, setActiveListing] = useState<Listing | null>(null);

  // Compute live filtered and sorted listings
  const filteredListings = useMemo(() => {
    return listings
      .map((item) =>
        item.merchant
          ? {
              ...item,
              distance_km: Number(
                distanceKm(userLat, userLon, item.merchant.latitude, item.merchant.longitude).toFixed(2)
              ),
            }
          : item
      )
      .filter((item) => {
        if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchMerchant = item.merchant?.business_name.toLowerCase().includes(q);
          const matchCat = item.category.toLowerCase().includes(q);
          if (!matchTitle && !matchMerchant && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'discount') {
          const discountA = 1 - a.discounted_price_cents / a.original_price_cents;
          const discountB = 1 - b.discounted_price_cents / b.original_price_cents;
          return discountB - discountA;
        }
        if (sortBy === 'cutoff') {
          return new Date(a.pickup_cutoff).getTime() - new Date(b.pickup_cutoff).getTime();
        }
        return (a.distance_km ?? 0) - (b.distance_km ?? 0);
      });
  }, [listings, selectedCategory, searchQuery, sortBy, userLat, userLon]);

  const activeCount = listings.filter((l) => l.status === 'active').length;

  return (
    <div className="w-full space-y-6">
      {/* Real-time Discovery Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-zinc-950 p-4 sm:p-5 rounded-3xl border border-zinc-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
              Live Real-Time Consumer Market
            </span>
            <span className="text-xs text-zinc-500 font-mono">· Supabase WebSocket Stream</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight mt-1">
            Rescuing Hot Kitchen Surplus Near You
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Canceled delivery orders, kitchen mistakes, and end-of-day specials at 50%–75% off.
          </p>
        </div>

        {/* View mode toggle button group */}
        <div className="flex items-center gap-1.5 self-start md:self-center bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800 shadow">
          {/* Leaflet Real Map */}
          <button
            type="button"
            onClick={() => setViewMode('leaflet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === 'leaflet'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Real Map</span>
          </button>

          {/* Split View */}
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === 'split'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Split View</span>
          </button>

          {/* Cards Grid */}
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === 'cards'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Cards</span>
          </button>

          {/* Radar Live Sweep */}
          <button
            type="button"
            onClick={() => setViewMode('radar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === 'radar'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Radar Sweep</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search cod, pizza, oysters, or restaurant..."
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        {/* Sort and Category Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none min-w-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2 text-xs text-zinc-300 font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none shrink-0"
          >
            <option value="cutoff">⚡ Expiring Soonest</option>
            <option value="proximity">📍 Closest to Me</option>
            <option value="discount">💰 Deepest Discount</option>
          </select>

          <div className="flex items-center gap-1.5 shrink-0">
            {CATEGORIES.map((cat) => (
              <button
                type="button"
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-zinc-100 text-zinc-950 shadow-md font-bold'
                    : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* VIEW MODES */}

      {/* 1. Full Leaflet Real Map View */}
      {viewMode === 'leaflet' && (
        <div className="w-full">
          <LeafletSurplusMap
            listings={filteredListings}
            onClaimListing={onClaimListing}
            userLat={userLat}
            userLon={userLon}
            className="h-[620px]"
          />
        </div>
      )}

      {/* 2. Full Radar Live Sweep View */}
      {viewMode === 'radar' && (
        <div className="w-full">
          <RadarMap
            listings={filteredListings}
            userLat={userLat}
            userLon={userLon}
            onSelectListing={(l) => setActiveListing(l)}
            onClaimListing={(l) => onClaimListing(l)}
          />
        </div>
      )}

      {/* 3. Split View: Left Real Leaflet Map + Right Feed Cards */}
      {viewMode === 'split' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 sticky top-20">
            <LeafletSurplusMap
              listings={filteredListings}
              onClaimListing={onClaimListing}
              userLat={userLat}
              userLon={userLon}
              className="h-[580px]"
            />
          </div>

          <div className="lg:col-span-6 space-y-3.5 max-h-[85vh] overflow-y-auto pr-1">
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <span>{filteredListings.length} Active Drops</span>
              <span className="font-mono text-emerald-400">Downtown St. John's, NL</span>
            </div>

            {filteredListings.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                onClaim={() => onClaimListing(item)}
              />
            ))}

            {filteredListings.length === 0 && <EmptyState />}
          </div>
        </div>
      )}

      {/* 4. Full Cards Grid View */}
      {viewMode === 'cards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Showing {filteredListings.length} available surplus items</span>
            <span className="font-mono text-emerald-400">Live 1-sec countdown active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredListings.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                onClaim={() => onClaimListing(item)}
              />
            ))}
          </div>

          {filteredListings.length === 0 && <EmptyState />}
        </div>
      )}
    </div>
  );
}

// Subcomponent: High-Conversion Surplus Card
function ListingCard({ listing, onClaim }: { listing: Listing; onClaim: () => void }) {
  const isAvailable = listing.status === 'active' && listing.quantity > 0;
  const minutesLeft = Math.max(
    0,
    Math.floor((new Date(listing.pickup_cutoff).getTime() - Date.now()) / (60 * 1000))
  );
  const secondsLeft = Math.max(
    0,
    Math.floor((new Date(listing.pickup_cutoff).getTime() - Date.now()) / 1000)
  );

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isUrgent = minutesLeft <= 15;
  const discountPercent = Math.round(
    (1 - listing.discounted_price_cents / listing.original_price_cents) * 100
  );

  const reasonConfig: Record<SurplusReason, { label: string; badge: string }> = {
    canceled_order: {
      label: 'Canceled Order',
      badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    },
    kitchen_error: {
      label: 'Kitchen Remake',
      badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    },
    day_end_surplus: {
      label: 'End of Day Surplus',
      badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    },
    near_expiry: {
      label: 'Near Expiry Special',
      badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    },
  };

  return (
    <div className="group relative bg-zinc-900 border border-zinc-800 hover:border-zinc-700/80 rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/5 flex flex-col justify-between">
      {/* Top Media & Tags */}
      <div>
        <div className="relative h-44 w-full overflow-hidden bg-zinc-950">
          <img
            src={listing.photo_url}
            alt={listing.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-black/40" />

          {/* Reason Badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5">
            <span
              className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border backdrop-blur-md ${
                reasonConfig[listing.surplus_reason]?.badge
              }`}
            >
              {reasonConfig[listing.surplus_reason]?.label}
            </span>
          </div>

          {/* Live Cutoff Countdown Timer */}
          <div className="absolute top-3 right-3">
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold shadow-lg backdrop-blur-md ${
                isUrgent
                  ? 'bg-rose-600/90 text-white animate-pulse'
                  : 'bg-zinc-950/80 text-amber-300 border border-amber-500/30'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{formatCountdown(secondsLeft)}</span>
            </div>
          </div>

          {/* Discount Ribbon */}
          <div className="absolute bottom-3 left-3 bg-amber-500 text-zinc-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>{discountPercent}% OFF</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-4 space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-300 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-amber-400" />
                {listing.merchant?.business_name}
              </span>
              <span className="font-mono text-zinc-400">
                {listing.distance_km ? `${listing.distance_km.toFixed(1)} km` : '0.4 km'}
              </span>
            </div>

            <h3 className="font-bold text-base text-zinc-100 mt-1 line-clamp-1 group-hover:text-amber-400 transition-colors">
              {listing.title}
            </h3>

            <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
              {listing.description}
            </p>
          </div>

          {/* Dietary Tags */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {listing.dietary_tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700/60"
              >
                {tag}
              </span>
            ))}
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-800/60 text-zinc-400">
              Qty: {listing.quantity} left
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer: Pricing and Claim CTA */}
      <div className="p-4 pt-3 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] text-zinc-500 block uppercase font-mono">Bite Price</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-emerald-400 font-mono">
              ${(listing.discounted_price_cents / 100).toFixed(2)}
            </span>
            <span className="text-xs text-zinc-500 line-through font-mono">
              ${(listing.original_price_cents / 100).toFixed(2)}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={!isAvailable}
          onClick={onClaim}
          className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shadow-md ${
            isAvailable
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 shadow-amber-500/20 active:scale-95 cursor-pointer'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          <Zap className="w-3.5 h-3.5 fill-zinc-950" />
          <span>{isAvailable ? 'Claim Now' : 'Reserved'}</span>
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center bg-zinc-900/40 rounded-3xl border border-zinc-800/80 space-y-3">
      <UtensilsCrossed className="w-10 h-10 text-zinc-600 mx-auto" />
      <h4 className="text-sm font-bold text-zinc-200">No surplus drops matching your filters</h4>
      <p className="text-xs text-zinc-500 max-w-sm mx-auto">
        Try resetting the search query or category filters to view other rescued food drops nearby.
      </p>
    </div>
  );
}

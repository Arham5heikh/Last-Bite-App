import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Zap, 
  Clock, 
  Trash2, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ChefHat, 
  Flame, 
  Store, 
  Layers, 
  ArrowRight,
  ShieldCheck,
  Percent,
  RefreshCw,
  ShoppingBag,
  Tag,
  DollarSign,
  X,
  Camera,
  Image as ImageIcon
} from 'lucide-react';
import type { Listing, SurplusReason, DietaryTag, Merchant } from '@/src/lib/types/database';
import { addSurplusListing, deleteListing } from '@/src/lib/store/realtimeStore';
import {
  ST_JOHNS_RESTAURANTS,
  ST_JOHNS_CATALOG_PRESETS,
  toMerchant,
  type PresetCatalogItem,
} from '@/src/lib/data/stJohns';
import { CustomSurplusModal } from './CustomSurplusModal';
import confetti from 'canvas-confetti';

const SURPLUS_REASONS: { key: SurplusReason; label: string; desc: string; icon: string }[] = [
  { key: 'canceled_order', label: 'Canceled Pickup', desc: 'Driver never arrived / app cancel', icon: '🛵' },
  { key: 'kitchen_error', label: 'Kitchen Error', desc: 'Remake / wrong modifier / accidental duplicate', icon: '⚠️' },
  { key: 'day_end_surplus', label: 'End of Shift', desc: 'Fresh prep closing out shift', icon: '🌙' },
];

const EXTENDED_PICKUP_OPTIONS = [
  { minutes: 30, label: '30 mins' },
  { minutes: 45, label: '45 mins' },
  { minutes: 60, label: '60 mins' },
  { minutes: 90, label: '90 mins' },
  { minutes: 120, label: '2 hours' },
];

const CURATED_CUSTOM_PHOTOS = [
  { label: 'Artisan Pizza', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80' },
  { label: 'Pub Burger & Fries', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80' },
  { label: 'Atlantic Cod & Chips', url: 'https://images.unsplash.com/photo-1579208570378-8c970854bc23?auto=format&fit=crop&w=800&q=80' },
  { label: 'Fresh Pastries', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80' },
  { label: 'Gourmet Pasta', url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281699?auto=format&fit=crop&w=800&q=80' },
  { label: 'Crispy Wings / Shareable', url: 'https://images.unsplash.com/photo-1527477378697-75d1bf5f2d59?auto=format&fit=crop&w=800&q=80' },
];

interface PresetCatalogListingProps {
  activeListings: Listing[];
  merchantId?: string;
  onOpenCustomModal?: () => void;
  onListingPublished?: (listing: Listing) => void;
}

export function PresetCatalogListing({
  activeListings,
  merchantId = ST_JOHNS_RESTAURANTS[0].id,
  onListingPublished,
}: PresetCatalogListingProps) {
  // Find current merchant info from St. John's roster
  const currentRestaurant = useMemo(() => {
    return ST_JOHNS_RESTAURANTS.find((r) => r.id === merchantId) || ST_JOHNS_RESTAURANTS[0];
  }, [merchantId]);

  // Load preset catalog dishes for THIS restaurant
  const catalogDishes = useMemo(() => {
    return ST_JOHNS_CATALOG_PRESETS[currentRestaurant.id] || ST_JOHNS_CATALOG_PRESETS[ST_JOHNS_RESTAURANTS[0].id];
  }, [currentRestaurant.id]);

  // Flow State
  const [selectedDishId, setSelectedDishId] = useState<string>(() => catalogDishes[0]?.id || '');
  const [selectedReason, setSelectedReason] = useState<SurplusReason>('canceled_order');
  
  // Extended Pickup Windows: 30m, 45m, 60m, 90m, 2h
  const [pickupMinutes, setPickupMinutes] = useState<number>(30);
  const [isPublishing, setIsPublishing] = useState(false);
  const [lastPublishedTitle, setLastPublishedTitle] = useState<string | null>(null);

  // Dynamic Pricing Controls (as in image.png)
  const [originalPriceDollars, setOriginalPriceDollars] = useState<number>(24);
  const [quantity, setQuantity] = useState<number>(1);
  const [discountPercent, setDiscountPercent] = useState<number>(75);
  const [customBitePrice, setCustomBitePrice] = useState<string>('6.00');

  // Custom Dish Modal State
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Sync selected dish if restaurant changes
  React.useEffect(() => {
    if (catalogDishes.length > 0 && !catalogDishes.some((d) => d.id === selectedDishId)) {
      const defaultDish = catalogDishes[0];
      setSelectedDishId(defaultDish.id);
      const orig = defaultDish.originalPriceCents / 100;
      setOriginalPriceDollars(orig);
      // default 50% or 60%
      const discCents = Math.floor(defaultDish.originalPriceCents * 0.5);
      setCustomBitePrice((discCents / 100).toFixed(2));
      setDiscountPercent(50);
    }
  }, [catalogDishes, selectedDishId]);

  // When a preset is clicked, initialize its pricing
  const handleSelectPreset = (dish: PresetCatalogItem) => {
    setSelectedDishId(dish.id);
    const orig = dish.originalPriceCents / 100;
    setOriginalPriceDollars(orig);
    // Recalculate bite rescue price with current discountPercent
    const newBiteCents = Math.max(50, Math.round(dish.originalPriceCents * (1 - discountPercent / 100)));
    setCustomBitePrice((newBiteCents / 100).toFixed(2));
  };

  // Helper chips: [50% Off], [60% Off], [65% Off], [75% Off]
  const handleSelectDiscountPreset = (pct: number) => {
    setDiscountPercent(pct);
    const origCents = Math.round(originalPriceDollars * 100);
    const newBiteCents = Math.max(50, Math.round(origCents * (1 - pct / 100)));
    setCustomBitePrice((newBiteCents / 100).toFixed(2));
  };

  // Manual typing in Bite Price input
  const handleBitePriceChange = (val: string) => {
    setCustomBitePrice(val);
    const num = parseFloat(val);
    if (!isNaN(num) && originalPriceDollars > 0) {
      const calcPct = Math.round(((originalPriceDollars - num) / originalPriceDollars) * 100);
      setDiscountPercent(Math.max(0, Math.min(99, calcPct)));
    }
  };

  // Manual change in Original Menu Price ($)
  const handleOriginalPriceChange = (val: number) => {
    setOriginalPriceDollars(val);
    if (val > 0) {
      const newBiteCents = Math.max(50, Math.round(val * 100 * (1 - discountPercent / 100)));
      setCustomBitePrice((newBiteCents / 100).toFixed(2));
    }
  };

  // Calculations for readout (matches image.png)
  const currentBitePriceNum = parseFloat(customBitePrice) || Math.max(1, originalPriceDollars * (1 - discountPercent / 100));
  const currentBitePriceFormatted = currentBitePriceNum.toFixed(2);
  const currentOriginalFormatted = Number(originalPriceDollars || 0).toFixed(2);
  const currentSavings = Math.max(0, Number(originalPriceDollars || 0) - currentBitePriceNum).toFixed(2);
  const finalDiscountCents = Math.round(currentBitePriceNum * 100);
  const finalOriginalCents = Math.round((originalPriceDollars || 0) * 100);

  // Active listings for THIS specific merchant
  const merchantActiveListings = activeListings.filter(
    (l) => l.merchant_id === currentRestaurant.id && l.status === 'active'
  );

  const selectedDish = catalogDishes.find((d) => d.id === selectedDishId) || catalogDishes[0];

  const handlePublish = (customItemData?: {
    title: string;
    description: string;
    category: string;
    photoUrl: string;
    dietaryTags: DietaryTag[];
  }) => {
    setIsPublishing(true);

    const now = new Date();
    const cutoff = new Date(now.getTime() + pickupMinutes * 60 * 1000);
    const newId = `lst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    // Prepare merchant object with St. John's coordinates
    const merchantObj: Merchant = toMerchant(currentRestaurant);

    const titleToUse = customItemData ? customItemData.title : selectedDish.title;
    const descToUse = customItemData 
      ? `${customItemData.description || 'Fresh kitchen rescue item'} [Reason: ${selectedReason.replace('_', ' ')}]`
      : `${selectedDish.description} [Reason: ${selectedReason.replace('_', ' ')}]`;
    const catToUse = customItemData ? customItemData.category : selectedDish.category;
    const photoToUse = customItemData ? customItemData.photoUrl : selectedDish.photoUrl;
    const tagsToUse = customItemData ? customItemData.dietaryTags : selectedDish.dietaryTags;

    const newListing: Listing = {
      id: newId,
      merchant_id: currentRestaurant.id,
      merchant: merchantObj,
      title: titleToUse,
      description: descToUse,
      category: catToUse,
      surplus_reason: selectedReason,
      original_price_cents: finalOriginalCents,
      discounted_price_cents: finalDiscountCents,
      quantity: quantity,
      initial_quantity: quantity,
      pickup_start: now.toISOString(),
      pickup_cutoff: cutoff.toISOString(),
      dietary_tags: tagsToUse,
      photo_url: photoToUse,
      status: 'active',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    setTimeout(() => {
      addSurplusListing(newListing);
      setIsPublishing(false);
      setLastPublishedTitle(titleToUse);
      if (isCustomModalOpen) setIsCustomModalOpen(false);
      if (onListingPublished) onListingPublished(newListing);

      try {
        confetti({
          particleCount: 45,
          spread: 55,
          origin: { y: 0.6 },
          colors: ['#ff6b00', '#00e599', '#ffb020'],
        });
      } catch {
        // ignore
      }

      setTimeout(() => setLastPublishedTitle(null), 4000);
    }, 250);
  };

  const handleCancelItem = (listingId: string) => {
    deleteListing(listingId);
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-zinc-300">
          <Percent className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Dynamic Discount Pricing Active:</strong> Merchants decide rescue prices with instant helper chips or custom values.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
            Minimum 30m Grace Guaranteed
          </span>
        </div>
      </div>

      {/* Main Grid: Rapid Post & Custom Dishes (Left) + Live Active Inventory (Right) */}
      <div className="grid grid-cols-1 md:landscape:grid-cols-12 lg:grid-cols-12 gap-6 items-start">
        {/* POSTING PANEL (7 Columns) */}
        <div className="md:landscape:col-span-7 lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                  Kitchen Dispatch Terminal
                </span>
                <span className="text-[10px] bg-amber-500/10 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20 font-mono font-bold">
                  St. John's, NL
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-zinc-100 mt-1">
                Drop Surplus to Live Consumer Market
              </h3>
            </div>
            
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 text-xs font-mono font-bold">
              ⚡
            </div>
          </div>

          {/* CATALOG SECTION WITH PROMINENT "+ CUSTOM DISH" BUTTON */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 font-mono">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center text-[11px] font-black">
                  1
                </span>
                Select Preset Dish or Add Custom Dish
              </span>

              {/* PROMINENT "+ CUSTOM DISH" BUTTON AT THE TOP */}
              <button
                type="button"
                onClick={() => setIsCustomModalOpen(true)}
                className="min-h-12 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-sm shadow-md shadow-amber-500/20 flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Custom Dish</span>
              </button>
            </div>

            {/* Preset Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catalogDishes.map((dish) => {
                const isSelected = selectedDish.id === dish.id;
                const origDollars = (dish.originalPriceCents / 100).toFixed(2);
                const discDollars = (Math.max(50, Math.round(dish.originalPriceCents * (1 - discountPercent / 100))) / 100).toFixed(2);

                return (
                  <button
                    key={dish.id}
                    type="button"
                    onClick={() => handleSelectPreset(dish)}
                    className={`relative text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-48 p-4 overflow-hidden group active:scale-[0.98] ${
                      isSelected
                        ? 'border-amber-500 bg-gradient-to-b from-amber-500/15 to-zinc-950 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500'
                        : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Background image preview with dark gradient */}
                    <div className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity">
                      <img src={dish.photoUrl} alt={dish.title} className="w-full h-full object-cover" />
                    </div>

                    <div className="relative z-10">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-[10px] font-mono uppercase bg-zinc-900/90 text-amber-300 border border-zinc-700 px-2 py-0.5 rounded-full">
                          {dish.category}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          Preset
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-zinc-100 line-clamp-2 leading-snug">
                        {dish.title}
                      </h4>
                    </div>

                    <div className="relative z-10 pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-zinc-400 font-mono block">Original Menu Price</span>
                        <span className="text-sm font-black text-zinc-300 font-mono">
                          ${origDollars}
                        </span>
                      </div>

                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
                        isSelected ? 'bg-amber-500 text-zinc-950 font-bold' : 'border border-zinc-700 text-zinc-500'
                      }`}>
                        {isSelected ? '✓' : ''}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DYNAMIC PRICING MODULE (MATCHING IMAGE.PNG SPEC) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            {/* Row 1: Original Menu Price ($) + Available Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Original Menu Price ($)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-zinc-400 font-mono text-sm">$</span>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    step="0.5"
                    value={originalPriceDollars}
                    onChange={(e) => handleOriginalPriceChange(parseFloat(e.target.value) || 0)}
                    className="w-full h-14 pl-8 pr-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 font-mono font-bold text-lg focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Available Quantity
                </label>
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl p-1 px-1.5 h-14 justify-between">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-14 h-11 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-100 text-2xl font-bold flex items-center justify-center transition-all cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono font-black text-xl text-zinc-100">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(25, q + 1))}
                    className="w-14 h-11 rounded-lg bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-100 text-2xl font-bold flex items-center justify-center transition-all cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Discount Preset (Min 50% Off) with -XX% OFF indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">
                  Discount Preset (Min 50% Off)
                </span>
                <span className="font-mono font-bold text-amber-400 text-xs tracking-wide">
                  -{discountPercent}% OFF
                </span>
              </div>

              {/* Helper chips: [50% Off], [60% Off], [65% Off], [75% Off] */}
              <div className="grid grid-cols-4 gap-2">
                {[50, 60, 65, 75].map((pct) => {
                  const isChipSelected = discountPercent === pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleSelectDiscountPreset(pct)}
                      className={`min-h-14 py-3 px-1 rounded-xl text-sm sm:text-base font-bold font-mono transition-all active:scale-95 cursor-pointer ${
                        isChipSelected
                          ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/30'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100'
                      }`}
                    >
                      {pct}% Off
                    </button>
                  );
                })}
              </div>

              {/* Custom typed Bite Price input */}
              <div className="pt-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-zinc-400">Or custom Bite Price ($):</span>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-mono text-sm">$</span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    value={customBitePrice}
                    onChange={(e) => handleBitePriceChange(e.target.value)}
                    className="w-full h-12 pl-7 pr-3 rounded-lg bg-zinc-900 border border-zinc-700 text-right font-mono font-bold text-base text-emerald-400 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Bite Rescue Price Display matching image.png */}
            <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-sm">
              <span className="text-zinc-400 font-medium">Bite Rescue Price:</span>
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-zinc-500 line-through font-mono">
                  ${currentOriginalFormatted}
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  ${currentBitePriceFormatted}
                </span>
                <span className="text-xs font-mono font-semibold text-amber-400">
                  (Save ${currentSavings})
                </span>
              </div>
            </div>
          </div>

          {/* TAP 2: Select Surplus Reason */}
          <div className="space-y-2.5">
            <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 font-mono">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center text-[11px] font-black">
                2
              </span>
              Surplus Reason
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {SURPLUS_REASONS.map((reason) => {
                const isSelected = selectedReason === reason.key;
                return (
                  <button
                    key={reason.key}
                    type="button"
                    onClick={() => setSelectedReason(reason.key)}
                    className={`min-h-24 p-4 rounded-2xl border text-left transition-all active:scale-[0.98] cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/10 shadow-md text-zinc-100'
                        : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/50 text-zinc-400'
                    }`}
                  >
                    <div className="text-2xl mb-1">{reason.icon}</div>
                    <div className="text-sm font-bold text-zinc-200 leading-tight">
                      {reason.label}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">
                      {reason.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* EXTENDED PICKUP WINDOWS: 30 mins, 45 mins, 60 mins, 90 mins, 2 hours */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between text-xs gap-2">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5 font-mono">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center text-[11px] font-black">
                  3
                </span>
                Pickup Cutoff Window (Extended Options)
              </span>

              {/* Extended pickup options */}
              <div className="flex flex-wrap items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                {EXTENDED_PICKUP_OPTIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => setPickupMinutes(opt.minutes)}
                    className={`min-h-12 px-4 py-2.5 rounded-lg text-sm font-mono font-bold transition-all active:scale-95 cursor-pointer ${
                      pickupMinutes === opt.minutes
                        ? 'bg-amber-500 text-zinc-950 shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Broadcast Action Button */}
            <button
              type="button"
              onClick={() => handlePublish()}
              disabled={isPublishing}
              className="w-full min-h-20 py-5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-zinc-950 font-black text-base sm:text-lg transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPublishing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Broadcasting to St. John's Feed...</span>
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5 fill-zinc-950" />
                  <span>
                    Drop to Live Marketplace (${currentBitePriceFormatted} · {discountPercent}% OFF · {pickupMinutes}m Window)
                  </span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </div>

          {/* Feedback Toast */}
          {lastPublishedTitle && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>
                <strong>Live on St. John's Market:</strong> "{lastPublishedTitle}" broadcasted to consumer feeds!
              </span>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Active Live Surplus for This Restaurant (5 Columns) */}
        <div className="md:landscape:col-span-5 lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                Active Kitchen Drops
              </span>
              <h3 className="text-sm sm:text-base font-black text-zinc-100">
                Live Inventory on Feed
              </h3>
            </div>
            <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
              {merchantActiveListings.length} Active
            </span>
          </div>

          {merchantActiveListings.length === 0 ? (
            <div className="py-12 text-center space-y-2 border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/40">
              <ShoppingBag className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-xs text-zinc-400 font-medium">No active surplus listings right now.</p>
              <p className="text-[11px] text-zinc-500">Pick a preset or custom dish on the left to drop an offer.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {merchantActiveListings.map((listing) => {
                const priceDollars = (listing.discounted_price_cents / 100).toFixed(2);
                const originalDollars = (listing.original_price_cents / 100).toFixed(2);
                const diffSecs = Math.max(
                  0,
                  Math.floor((new Date(listing.pickup_cutoff).getTime() - Date.now()) / 1000)
                );
                const diffMins = Math.floor(diffSecs / 60);

                return (
                  <div
                    key={listing.id}
                    className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={listing.photo_url}
                        alt={listing.title}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-zinc-800"
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-zinc-100 truncate">{listing.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono font-bold text-emerald-400 text-xs">
                            ${priceDollars}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500 line-through">
                            ${originalDollars}
                          </span>
                          <span className="text-[10px] font-mono text-amber-400 flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {diffMins}m
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCancelItem(listing.id)}
                      className="w-14 h-14 flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-rose-500/20 active:scale-95 text-zinc-400 hover:text-rose-400 border border-zinc-800 transition-all cursor-pointer shrink-0"
                      title="Pull item from marketplace"
                    >
                      <Trash2 className="w-6 h-6" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: CUSTOM SURPLUS DISH FAST-POST */}
      <CustomSurplusModal
        isOpen={isCustomModalOpen}
        onClose={() => setIsCustomModalOpen(false)}
        initialMerchantId={currentRestaurant.id}
        onSuccess={(newListing) => {
          setLastPublishedTitle(newListing.title);
          if (onListingPublished) onListingPublished(newListing);
        }}
      />
    </div>
  );
}

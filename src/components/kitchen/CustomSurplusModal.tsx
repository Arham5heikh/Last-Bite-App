import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  Camera, 
  Zap, 
  Clock, 
  Store, 
  Check, 
  Plus, 
  AlertCircle,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Trash2,
  HelpCircle
} from 'lucide-react';
import type { SurplusReason, DietaryTag, Listing, Merchant } from '@/src/lib/types/database';
import { addSurplusListing } from '@/src/lib/store/realtimeStore';
import { ST_JOHNS_RESTAURANTS, findRestaurant } from '@/src/lib/data/stJohns';
import confetti from 'canvas-confetti';

export interface CustomSurplusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (listing: Listing) => void;
  initialMerchantId?: string;
}

export interface KitchenProfile {
  id: string;
  name: string;
  address: string;
  phone: string;
  category: string;
  latitude: number;
  longitude: number;
  photoUrl: string;
}

export const KITCHEN_PROFILES: KitchenProfile[] = ST_JOHNS_RESTAURANTS.map((r) => ({
  id: r.id,
  name: r.name,
  address: r.address,
  phone: r.phone,
  category: r.category,
  latitude: r.latitude,
  longitude: r.longitude,
  photoUrl: r.photoUrl,
}));

const CUISINE_OPTIONS = [
  'Pizza',
  'Burger & Grill',
  'Bakery & Cafe',
  'Seafood',
  'Bowls & Salads',
  'Pub Fare',
  'Bistro',
  'Upscale Bar',
];

const STANDARD_CUISINE_PHOTOS: Record<string, string> = {
  'Pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
  'Burger & Grill': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
  'Bakery & Cafe': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
  'Seafood': 'https://images.unsplash.com/photo-1579208570378-8c970854bc23?auto=format&fit=crop&w=800&q=80',
  'Bowls & Salads': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
  'Pub Fare': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  'Bistro': 'https://images.unsplash.com/photo-1525059696034-4967a8e1dca2?auto=format&fit=crop&w=800&q=80',
  'Upscale Bar': 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80',
};

const SURPLUS_REASONS = [
  {
    key: 'canceled_order' as SurplusReason,
    icon: '🛵',
    title: 'Canceled Order',
    desc: 'Driver failed or buyer canceled',
  },
  {
    key: 'kitchen_error' as SurplusReason,
    icon: '🍳',
    title: 'Wrong Topping/Remake',
    desc: 'Remade fresh item with wrong mod',
  },
  {
    key: 'day_end_surplus' as SurplusReason,
    icon: '🥐',
    title: 'End of Day Pastries/Surplus',
    desc: 'Fresh baked batch before closing',
  },
  {
    key: 'near_expiry' as SurplusReason,
    icon: '⏳',
    title: 'Near Expiry Special',
    desc: 'Must sell in next 45 minutes',
  },
];

const DIETARY_OPTIONS: DietaryTag[] = [
  'Halal',
  'Vegan',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Kosher',
];

const CUTOFF_PRESETS = [15, 30, 45, 60];

export function CustomSurplusModal({
  isOpen,
  onClose,
  onSuccess,
  initialMerchantId = 'merch_bella_napoli',
}: CustomSurplusModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active kitchen selector
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>(() => {
    const match = KITCHEN_PROFILES.find((p) => p.id === initialMerchantId);
    return match ? match.id : KITCHEN_PROFILES[0].id;
  });

  // Section 1: Surplus reason
  const [selectedReason, setSelectedReason] = useState<SurplusReason>('canceled_order');

  // Dish details & pricing
  const [itemTitle, setItemTitle] = useState('');
  const [cuisineType, setCuisineType] = useState('Pizza');
  const [originalPriceDollars, setOriginalPriceDollars] = useState<number>(26);
  const [quantity, setQuantity] = useState<number>(1);
  const [discountPercent, setDiscountPercent] = useState<number>(60);

  // Section 2: Pickup cutoff window
  const [pickupMinutes, setPickupMinutes] = useState<number>(30);

  // Section 3: Dietary badges
  const [selectedDietary, setSelectedDietary] = useState<DietaryTag[]>([]);

  // Section 4: Verification photo
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync initial merchant if prop changes
  React.useEffect(() => {
    if (initialMerchantId) {
      const match = KITCHEN_PROFILES.find((p) => p.id === initialMerchantId);
      if (match) setSelectedMerchantId(match.id);
    }
  }, [initialMerchantId]);

  // Current active kitchen profile
  const activeKitchen = useMemo(() => {
    return KITCHEN_PROFILES.find((p) => p.id === selectedMerchantId) || KITCHEN_PROFILES[0];
  }, [selectedMerchantId]);

  if (!isOpen) return null;

  // Real-time Pricing Calculations
  const origPrice = Number(originalPriceDollars) || 0;
  const originalCents = Math.round(origPrice * 100);
  const discountedCents = Math.max(50, Math.round(originalCents * (1 - discountPercent / 100)));
  const bitePriceNum = discountedCents / 100;
  const bitePriceFormatted = bitePriceNum.toFixed(2);
  const originalPriceFormatted = origPrice.toFixed(2);
  const savingsFormatted = Math.max(0, origPrice - bitePriceNum).toFixed(2);

  // Handlers
  const handleToggleDietary = (tag: DietaryTag) => {
    setSelectedDietary((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingPhoto(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoPreview(event.target?.result as string);
        setIsUploadingPhoto(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Invariant Validations
    if (!itemTitle.trim()) {
      setErrorMsg('Please enter an item title.');
      return;
    }

    if (origPrice <= 0) {
      setErrorMsg('Original menu price must be greater than $0.');
      return;
    }

    if (discountPercent < 50) {
      setErrorMsg('Last Bite requires at least a 50% discount to protect consumers.');
      return;
    }

    if (pickupMinutes < 15) {
      setErrorMsg('Pickup cutoff window must be at least 15 minutes.');
      return;
    }

    setIsSubmitting(true);

    const now = new Date();
    // Guarantee minimum 30-minute grace window for consumers upon claiming
    const effectivePickupMinutes = Math.max(30, pickupMinutes);
    const cutoff = new Date(now.getTime() + effectivePickupMinutes * 60 * 1000);
    const newId = `lst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

    const merchantObj: Merchant = {
      id: activeKitchen.id,
      business_name: activeKitchen.name,
      address: activeKitchen.address,
      latitude: activeKitchen.latitude,
      longitude: activeKitchen.longitude,
      phone: activeKitchen.phone,
      stripe_account_id: `acct_${activeKitchen.id.slice(0, 10)}`,
      verified: true,
      terminal_pin: findRestaurant(activeKitchen.id)?.pin,
      avatar_url: activeKitchen.photoUrl,
      created_at: now.toISOString(),
    };

    const finalPhoto = photoPreview || STANDARD_CUISINE_PHOTOS[cuisineType] || STANDARD_CUISINE_PHOTOS['Pizza'];

    const newListing: Listing = {
      id: newId,
      merchant_id: activeKitchen.id,
      merchant: merchantObj,
      title: itemTitle.trim(),
      description: `Fresh kitchen rescue surplus [Reason: ${selectedReason.replace('_', ' ')}]`,
      category: cuisineType,
      surplus_reason: selectedReason,
      original_price_cents: originalCents,
      discounted_price_cents: discountedCents,
      quantity: quantity,
      initial_quantity: quantity,
      pickup_start: now.toISOString(),
      pickup_cutoff: cutoff.toISOString(),
      dietary_tags: selectedDietary,
      photo_url: finalPhoto,
      status: 'active',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    setTimeout(() => {
      addSurplusListing(newListing);
      setIsSubmitting(false);

      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#ff6b00', '#00e599', '#ffb020'],
        });
      } catch {
        // ignore
      }

      if (onSuccess) onSuccess(newListing);
      onClose();
    }, 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg md:landscape:max-w-2xl bg-[#121316] border border-[#26282d] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-sans">
        {/* TOP HEADER (MATCHING EXACT IMAGE.PNG LAYOUT) */}
        <div className="bg-gradient-to-b from-[#2a1b14]/70 to-[#1c1e24]/90 border-b border-[#26282d] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg shadow-inner">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-zinc-100 tracking-tight">
                  Kitchen 30-Sec Fast-Post
                </h2>
                <span className="border border-amber-500/60 bg-amber-500/10 text-amber-400 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full tracking-wider">
                  LIVE BROADCAST
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Rescue hot surplus food before it spoils
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-[#26282d] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE MODAL BODY */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* ACTIVE KITCHEN PROFILE SELECTOR BAR */}
          <div className="bg-[#1c1e24] border border-[#26282d] rounded-2xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-zinc-300 text-xs font-bold">
              <Store className="w-4 h-4 text-amber-400" />
              <span>Active Kitchen:</span>
            </div>

            <div className="relative">
              <select
                value={selectedMerchantId}
                onChange={(e) => setSelectedMerchantId(e.target.value)}
                className="bg-[#121316] border border-[#26282d] text-zinc-200 text-xs font-semibold px-3 py-1.5 pr-8 rounded-xl focus:border-amber-500 focus:outline-none appearance-none cursor-pointer"
              >
                {KITCHEN_PROFILES.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* 1. SURPLUS REASON (TACTILE SELECT) */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
              1. SURPLUS REASON (TACTILE SELECT)
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SURPLUS_REASONS.map((reason) => {
                const isSelected = selectedReason === reason.key;
                return (
                  <button
                    key={reason.key}
                    type="button"
                    onClick={() => setSelectedReason(reason.key)}
                    className={`text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'border-amber-500 bg-gradient-to-b from-amber-500/10 to-[#1c1e24] shadow-md shadow-amber-950/20 ring-1 ring-amber-500'
                        : 'border-[#26282d] bg-[#1c1e24] hover:border-zinc-700 hover:bg-[#22252c]'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 mt-0.5 ${
                        isSelected
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-[#26282d] text-zinc-400'
                      }`}
                    >
                      {reason.icon}
                    </div>

                    <div className="min-w-0">
                      <h4
                        className={`text-xs font-bold leading-tight truncate ${
                          isSelected ? 'text-amber-400' : 'text-zinc-200'
                        }`}
                      >
                        {reason.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-1">
                        {reason.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DISH DETAILS & PRICING GRID */}
          <div className="space-y-3 pt-1">
            {/* Row 1: Item Title + Cuisine / Type */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Item Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. 14' Canceled Burrata Pizza"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#121316] border border-[#26282d] text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Cuisine / Type
                </label>
                <div className="relative">
                  <select
                    value={cuisineType}
                    onChange={(e) => setCuisineType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#121316] border border-[#26282d] text-xs text-zinc-100 focus:outline-none focus:border-amber-500 appearance-none cursor-pointer"
                  >
                    {CUISINE_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 2: Original Menu Price ($) + Available Quantity Stepper */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Original Menu Price ($)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-zinc-400 font-mono text-xs font-bold">$</span>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    step="0.5"
                    value={originalPriceDollars}
                    onChange={(e) => setOriginalPriceDollars(parseFloat(e.target.value) || 0)}
                    className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#121316] border border-[#26282d] text-xs font-mono font-bold text-zinc-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Available Quantity
                </label>
                <div className="flex items-center gap-2 bg-[#121316] border border-[#26282d] rounded-xl p-1 justify-between h-14">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-12 h-11 rounded-lg bg-[#26282d] hover:bg-zinc-700 active:scale-95 text-zinc-100 text-xl font-bold flex items-center justify-center transition-colors cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-mono font-bold text-xs text-zinc-100 w-8 text-center">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(25, q + 1))}
                    className="w-12 h-11 rounded-lg bg-[#26282d] hover:bg-zinc-700 active:scale-95 text-zinc-100 text-xl font-bold flex items-center justify-center transition-colors cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Row 3: Discount Presets (Min 50% Off) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">
                  Discount Preset (Min 50% Off)
                </span>
                <span className="font-mono font-bold text-amber-400 text-xs">
                  -{discountPercent}% OFF
                </span>
              </div>

              {/* 4 Tactile Chips */}
              <div className="grid grid-cols-4 gap-2">
                {[50, 60, 65, 75].map((pct) => {
                  const isChipActive = discountPercent === pct;
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercent(pct)}
                      className={`py-2 px-1 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                        isChipActive
                          ? 'bg-[#ff6b00] text-zinc-950 font-black shadow-md shadow-orange-950/40 border border-transparent'
                          : 'bg-[#1c1e24] border border-[#26282d] text-zinc-300 font-bold hover:text-zinc-100 hover:border-zinc-700'
                      }`}
                    >
                      {pct}% Off
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 4: Dynamic Rescue Price Display */}
            <div className="pt-2 flex items-center justify-between text-xs sm:text-sm">
              <span className="text-zinc-400 font-medium">Bite Rescue Price:</span>
              <div className="flex items-baseline gap-2 font-mono">
                <span className="text-xs text-zinc-500 line-through">
                  ${originalPriceFormatted}
                </span>
                <span className="text-lg font-black text-[#00e599]">
                  ${bitePriceFormatted}
                </span>
                <span className="text-xs font-semibold text-amber-400">
                  (Save ${savingsFormatted})
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: PICKUP CUTOFF WINDOW */}
          <div className="space-y-2.5 pt-2 border-t border-[#26282d]">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                PICKUP CUTOFF WINDOW
              </span>
              <span className="font-bold text-amber-400">
                Ready Now • Expires in {pickupMinutes} mins
              </span>
            </div>

            {/* Preset Buttons */}
            <div className="grid grid-cols-4 gap-2">
              {CUTOFF_PRESETS.map((mins) => {
                const isSelected = pickupMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setPickupMinutes(mins)}
                    className={`py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border border-amber-500 bg-amber-950/30 text-amber-300 font-bold shadow-sm'
                        : 'border border-[#26282d] bg-[#1c1e24] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    {mins} mins
                  </button>
                );
              })}
            </div>

            {/* Direct Slider Control */}
            <div className="pt-1">
              <input
                type="range"
                min="15"
                max="120"
                step="5"
                value={pickupMinutes}
                onChange={(e) => setPickupMinutes(parseInt(e.target.value, 10))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-[#26282d] rounded-lg"
              />
            </div>
          </div>

          {/* SECTION 3: DIETARY BADGES (MULTI-SELECT) */}
          <div className="space-y-2 pt-2 border-t border-[#26282d]">
            <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
              DIETARY BADGES
            </label>

            <div className="flex flex-wrap gap-2">
              {DIETARY_OPTIONS.map((tag) => {
                const isSelected = selectedDietary.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleToggleDietary(tag)}
                    className={`text-xs px-3 py-1.5 rounded-full transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? 'bg-[#00e599]/15 border border-[#00e599] text-[#00e599] font-bold shadow-sm'
                        : 'border border-[#26282d] bg-[#1c1e24] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    {isSelected ? '✓' : '+'} {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 4: VERIFICATION PHOTO (CAMERA / UPLOAD) */}
          <div className="space-y-2 pt-2 border-t border-[#26282d]">
            <label className="text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 block">
              VERIFICATION PHOTO (CAMERA / UPLOAD)
            </label>

            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-[#26282d] hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-[#34373e] shrink-0"
              >
                <Camera className="w-4 h-4 text-amber-400" />
                <span>Snap / Upload Photo</span>
              </button>

              {photoPreview ? (
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-[#00e599] shrink-0 shadow-md">
                    <img
                      src={photoPreview}
                      alt="Verification preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-[#00e599] text-zinc-950 flex items-center justify-center text-[9px] font-black">
                      ✓
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoPreview('')}
                    className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Remove photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-zinc-500 italic">
                  Will use appetizing standard cuisine photo if empty
                </span>
              )}
            </div>
          </div>

          {/* ERROR ALERT */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SUBMIT BUTTON (VIVID ORANGE POS STYLE) */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-16 py-4 rounded-2xl bg-[#ff6b00] hover:bg-[#e56000] active:scale-[0.99] text-zinc-950 font-black text-sm sm:text-base transition-all shadow-xl shadow-orange-950/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-4 h-4 fill-zinc-950" />
              <span>
                Post Surplus (${bitePriceFormatted} · -{discountPercent}%)
              </span>
            </button>

            <p className="text-[11px] text-zinc-500 text-center mt-2 leading-snug">
              Broadcasts immediately to consumers within 5 miles. 7-minute zero-ghost reservation guarantee.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

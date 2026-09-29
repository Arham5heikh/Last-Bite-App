import React, { useState, useEffect } from 'react';
import { 
  X, 
  Lock, 
  CreditCard, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  Check, 
  Sparkles,
  ShoppingBag
} from 'lucide-react';
import type { Listing, Order } from '@/src/lib/types/database';
import { executeAtomicReservation } from '@/src/lib/store/realtimeStore';

interface CheckoutModalProps {
  listing: Listing | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: Order) => void;
}

export function CheckoutModal({ listing, isOpen, onClose, onSuccess }: CheckoutModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(420); // 7 minutes lock window
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useTestCard, setUseTestCard] = useState(true);

  useEffect(() => {
    if (!isOpen || !listing) return;

    // Reset hold timer to 7 mins on open
    setSecondsRemaining(420);
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, listing]);

  if (!isOpen || !listing) return null;

  const originalDollars = (listing.original_price_cents / 100).toFixed(2);
  const itemDollars = (listing.discounted_price_cents / 100).toFixed(2);
  const platformFeeCents = Math.max(50, Math.round(listing.discounted_price_cents * 0.10));
  const platformFeeDollars = (platformFeeCents / 100).toFixed(2);
  const totalDollars = ((listing.discounted_price_cents) / 100).toFixed(2);
  const savingsDollars = ((listing.original_price_cents - listing.discounted_price_cents) / 100).toFixed(2);

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const isTimeUp = secondsRemaining <= 0;

  const handleConfirmCheckout = () => {
    if (isTimeUp) {
      setErrorMessage('Reservation lock timed out. Please select the item again.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    // Call atomic reservation RPC
    setTimeout(() => {
      const res = executeAtomicReservation(listing.id, 'usr_consumer_active');
      setIsProcessing(false);

      if (!res.success || !res.order) {
        setErrorMessage(res.error || 'Failed to secure listing. Another user may have locked it.');
        return;
      }

      onSuccess(res.order);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header with 7-min Lock Warning */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-600/30 via-orange-600/20 to-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-zinc-100 text-sm sm:text-base">7-Minute Reservation Hold</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 font-mono text-xs font-bold border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>
              {mins}:{secs.toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-sm">
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Item Preview Card */}
          <div className="flex gap-3 p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800">
            <img
              src={listing.photo_url}
              alt={listing.title}
              className="w-16 h-16 rounded-xl object-cover shrink-0 border border-zinc-800"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">
                {listing.merchant?.business_name || 'Local Kitchen'}
              </span>
              <h4 className="font-bold text-zinc-100 text-sm truncate">{listing.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-zinc-400 line-through font-mono">${originalDollars}</span>
                <span className="text-emerald-400 font-mono font-bold text-sm">${itemDollars}</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                  Save ${savingsDollars}
                </span>
              </div>
            </div>
          </div>

          {/* Stripe Connect Breakdown */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-zinc-300">
              <span>Rescued Item Subtotal</span>
              <span className="font-mono">${itemDollars}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 text-[11px]">
              <span>Platform Service & Carbon Rescue Fee</span>
              <span className="font-mono">${platformFeeDollars}</span>
            </div>
            <div className="flex items-center justify-between text-zinc-400 text-[11px]">
              <span>Direct Merchant Payout (Stripe Connect)</span>
              <span className="font-mono text-emerald-400">${((listing.discounted_price_cents - platformFeeCents) / 100).toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-sm font-bold text-zinc-100">
              <span>Total Due at Pickup</span>
              <span className="font-mono text-base text-amber-400">${itemDollars}</span>
            </div>
          </div>

          {/* Payment Method (Stripe 1-Click Test Integration) */}
          <div className="p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span>Instant Payment Authorization</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                Stripe Connect
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-5 bg-zinc-900 rounded flex items-center justify-center font-bold text-[9px] text-zinc-300">
                  VISA
                </div>
                <span className="font-mono text-zinc-300">•••• 4242</span>
                <span className="text-[10px] text-zinc-500">(Instant Digital Card)</span>
              </div>
              <Check className="w-4 h-4 text-emerald-400" />
            </div>
          </div>

          {/* Strict Red Warning Banner: 50% No-Show Fee Policy */}
          <div className="p-3 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-xs text-rose-200 leading-relaxed flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-rose-300">Important Policy:</strong> Failure to pick up your order within the designated window will result in a 50% No-Show penalty fee charged to your card to compensate the restaurant.
            </span>
          </div>

          {/* Guaranteed 30-Minute Grace Period & Zero-Ghost Guarantee */}
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300">30-Minute Minimum Pickup Guarantee:</strong>
              <p className="mt-0.5">
                Upon claiming, your active pickup window is guaranteed to be at least 30 minutes. Your item is atomically locked in PostgreSQL and funds are only fully transferred to the restaurant when you show your 4-digit PIN at pickup.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              disabled={isProcessing || isTimeUp}
              onClick={handleConfirmCheckout}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>
                {isProcessing
                  ? 'Locking Listing & Generating PIN...'
                  : `Confirm & Lock for $${itemDollars}`}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel Reservation (Releases back to community)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

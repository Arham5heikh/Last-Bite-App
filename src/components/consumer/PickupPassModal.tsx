import React, { useState, useEffect } from 'react';
import { 
  X, 
  MapPin, 
  Phone, 
  ExternalLink, 
  ShieldCheck, 
  Clock, 
  Navigation, 
  Sparkles, 
  CheckCircle,
  Copy,
  AlertTriangle
} from 'lucide-react';
import type { Order } from '@/src/lib/types/database';
import { QRCodeSVG } from '@/src/lib/utils/qrcode';
import confetti from 'canvas-confetti';

interface PickupPassModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenMerchantTerminal?: (orderId: string) => void;
}

export function PickupPassModal({
  order,
  isOpen,
  onClose,
  onOpenMerchantTerminal,
}: PickupPassModalProps) {
  const [copiedPin, setCopiedPin] = useState(false);
  const [remainingSecs, setRemainingSecs] = useState<number>(420);

  useEffect(() => {
    if (!order) return;

    // Trigger celebratory initial confetti when pass is first opened
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#10b981', '#ffffff'],
      });
    } catch {
      // ignore
    }

    const calculateRemaining = () => {
      const targetTime = new Date(order.reserved_until).getTime();
      const diff = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
      setRemainingSecs(diff);
    };

    calculateRemaining();
    const interval = setInterval(calculateRemaining, 1000);
    return () => clearInterval(interval);
  }, [order]);

  if (!isOpen || !order) return null;

  const handleCopyPin = () => {
    if (order.pickup_pin) {
      navigator.clipboard?.writeText(order.pickup_pin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const minutes = Math.floor(remainingSecs / 60);
  const seconds = remainingSecs % 60;
  const isNoShowPenalized = order.status === 'no_show_penalized';
  const isExpired = (remainingSecs <= 0 && order.status === 'reserved') || order.status === 'expired' || isNoShowPenalized;
  const isCompleted = order.status === 'completed';

  const merchant = order.merchant;
  const merchantAddress = merchant?.address || "Water St, St. John's, NL";
  const merchantPhone = merchant?.phone || '(709) 555-0100';
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${merchant?.business_name || 'Restaurant'} ${merchantAddress}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Pass Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-600/40 via-orange-600/30 to-zinc-900 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isCompleted ? 'bg-emerald-400' : isNoShowPenalized ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse'}`} />
            <h3 className="font-bold text-zinc-100 text-base sm:text-lg">Digital Pickup Pass</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status ribbon */}
        <div
          className={`px-4 py-2 text-center text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-300 border-b border-emerald-500/30'
              : isNoShowPenalized
              ? 'bg-rose-500/30 text-rose-300 border-b border-rose-500/40'
              : isExpired
              ? 'bg-rose-500/20 text-rose-300 border-b border-rose-500/30'
              : 'bg-amber-500/20 text-amber-300 border-b border-amber-500/30'
          }`}
        >
          {isCompleted ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Pickup Completed & Fulfilled
            </>
          ) : isNoShowPenalized ? (
            <>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              No-Show Window Expired · 50% Penalty Captured
            </>
          ) : isExpired ? (
            <>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Reservation Window Expired
            </>
          ) : (
            <>
              <Clock className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              Guaranteed Pickup Window: {minutes}:{seconds.toString().padStart(2, '0')} remaining
            </>
          )}
        </div>

        {/* Strict Red Warning Banner: 50% No-Show Fee Policy */}
        <div className="bg-rose-950/80 border-b border-rose-800/80 px-4 py-2.5 flex items-start gap-2.5 text-xs text-rose-200">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span className="leading-snug">
            <strong>Policy Notice:</strong> Failure to pick up your order within the designated window will result in a 50% No-Show penalty fee charged to your card to compensate the restaurant.
          </span>
        </div>

        {/* Scrollable Pass Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Restaurant & Item Card */}
          <div className="bg-zinc-950/80 p-3.5 rounded-2xl border border-zinc-800">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-amber-400 font-semibold">{merchant?.business_name || 'Restaurant'}</p>
                <h4 className="text-sm font-bold text-zinc-100 mt-0.5">{order.listing?.title || 'Surplus Food Order'}</h4>
              </div>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                ${(order.total_amount_cents / 100).toFixed(2)}
              </span>
            </div>
            <div className="mt-2 text-xs text-zinc-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">{merchantAddress}</span>
            </div>
          </div>

          {/* High-Contrast QR Code & Big 4-Digit PIN */}
          <div className="bg-zinc-950 rounded-2xl p-4 border border-zinc-800 text-center flex flex-col items-center">
            <p className="text-xs text-zinc-400 uppercase tracking-widest font-semibold mb-3">
              Show to Kitchen / Front Desk
            </p>

            {/* QR Code */}
            <div className="p-2 bg-white rounded-2xl shadow-xl inline-block">
              <QRCodeSVG value={order.qr_token || order.pickup_pin} size={160} />
            </div>

            {/* Big 4-digit PIN */}
            <div className="mt-4">
              <p className="text-[11px] text-zinc-400 font-medium">Instant 4-Digit Redemption PIN</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-amber-400 bg-zinc-900 px-4 py-1.5 rounded-xl border border-zinc-700 select-all">
                  {order.pickup_pin}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPin}
                  className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                  title="Copy PIN"
                >
                  {copiedPin ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-500 mt-2">
              Merchant verifies PIN or scans QR code to release the packaging.
            </p>
          </div>

          {/* Quick Actions: Navigation & Call */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
            >
              <Navigation className="w-4 h-4 text-amber-400" />
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>

            <a
              href={`tel:${merchantPhone.replace(/[^0-9+]/g, '')}`}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
            >
              <Phone className="w-4 h-4 text-emerald-400" />
              <span>Call Kitchen</span>
            </a>
          </div>

          {/* Merchant Handshake Simulator Button */}
          {!isCompleted && onOpenMerchantTerminal && (
            <div className="pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMerchantTerminal(order.id);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-800/90 hover:bg-amber-500/20 border border-zinc-700 hover:border-amber-500/50 text-xs font-medium text-amber-300 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Test Merchant Handshake (Open Kitchen Terminal)</span>
              </button>
            </div>
          )}

          {/* Security & Zero Ghost Note */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/60 text-[11px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Order secured via PostgreSQL row lock. Payout releases instantly to restaurant upon redemption.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

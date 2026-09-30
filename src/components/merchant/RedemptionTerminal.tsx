import React, { useState } from 'react';
import { 
  Hash, 
  Scan, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  Store, 
  Clock, 
  DollarSign,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import type { Order } from '@/src/lib/types/database';
import { executeRedemptionHandshake } from '@/src/lib/store/realtimeStore';
import confetti from 'canvas-confetti';

interface RedemptionTerminalProps {
  orders: Order[];
  targetOrderId?: string;
  onSuccess?: (order: Order) => void;
}

export function RedemptionTerminal({ orders, targetOrderId, onSuccess }: RedemptionTerminalProps) {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    targetOrderId || orders.find((o) => o.status === 'reserved')?.id || ''
  );
  const [pinDigits, setPinDigits] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastRedeemedOrder, setLastRedeemedOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeReservedOrders = orders.filter((o) => o.status === 'reserved');
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const handleKeyPress = (num: string) => {
    if (pinDigits.length < 4) {
      const nextPin = pinDigits + num;
      setPinDigits(nextPin);
      setErrorMessage(null);
    }
  };

  const handleBackspace = () => {
    setPinDigits((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    setPinDigits('');
    setErrorMessage(null);
  };

  const handleVerify = () => {
    if (!selectedOrder) {
      setErrorMessage('Please select an active order to redeem.');
      return;
    }

    if (pinDigits.length !== 4) {
      setErrorMessage('Please enter the customer\'s 4-digit pickup PIN.');
      return;
    }

    setIsVerifying(true);
    setErrorMessage(null);

    setTimeout(() => {
      const res = executeRedemptionHandshake(selectedOrder.id, pinDigits);
      setIsVerifying(false);

      if (!res.success || !res.order) {
        setErrorMessage(res.error || 'Verification failed. PIN does not match order.');
        return;
      }

      setLastRedeemedOrder(res.order);
      setPinDigits('');
      if (onSuccess) onSuccess(res.order);

      try {
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#00e599', '#ff6b00', '#ffb020'],
        });
      } catch {
        // ignore
      }
    }, 400);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 rounded-3xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-zinc-100">Merchant Redemption Terminal</h2>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                Front-of-House POS
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Input customer 4-digit PIN or scan QR to complete order and release Stripe payout.
            </p>
          </div>
        </div>

        <div className="text-right sm:self-center">
          <span className="text-[11px] text-zinc-400 font-mono">Active Pickups In-Queue:</span>
          <p className="text-xl font-bold font-mono text-amber-400">{activeReservedOrders.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Active Order Queue */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span className="font-semibold uppercase tracking-wider">Awaiting Customer Arrival</span>
            <span className="font-mono text-amber-400">{activeReservedOrders.length} Pending</span>
          </div>

          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {activeReservedOrders.map((ord) => {
              const isSelected = selectedOrderId === ord.id;
              return (
                <div
                  key={ord.id}
                  onClick={() => {
                    setSelectedOrderId(ord.id);
                    setErrorMessage(null);
                    setLastRedeemedOrder(null);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500 text-zinc-100 shadow-md ring-1 ring-amber-500/50'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-mono font-semibold text-amber-400">
                        {ord.id.toUpperCase()}
                      </span>
                      <h4 className="text-xs font-bold text-zinc-100 mt-0.5 line-clamp-1">
                        {ord.listing?.title}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ${(ord.total_amount_cents / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                    <span className="font-medium text-zinc-400">
                      Payout: ${(ord.merchant_payout_cents / 100).toFixed(2)}
                    </span>
                    <span className="flex items-center gap-1 font-mono text-amber-300/80">
                      <Clock className="w-3 h-3" />
                      7m Lock
                    </span>
                  </div>
                </div>
              );
            })}

            {activeReservedOrders.length === 0 && (
              <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-zinc-200">No Orders Currently Awaiting Pickup</p>
                <p className="text-[11px] text-zinc-500">
                  Switch to the Consumer feed and click "Claim Now" to generate an active pickup order.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tactile POS Keypad */}
        <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
          {/* Target Order Info */}
          {selectedOrder ? (
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400">
                  Verifying Order #{selectedOrder.id}
                </span>
                <p className="text-sm font-bold text-zinc-100 line-clamp-1">{selectedOrder.listing?.title}</p>
                <p className="text-xs text-zinc-400">
                  Payout to Transfer: <strong className="text-emerald-400 font-mono">${(selectedOrder.merchant_payout_cents / 100).toFixed(2)}</strong>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 block">Expected PIN</span>
                <span className="text-xs font-mono font-bold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                  {selectedOrder.pickup_pin}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-dashed border-zinc-800 text-center text-xs text-zinc-400">
              Select an order from the left column to enter PIN
            </div>
          )}

          {/* PIN Display Boxes */}
          <div>
            <div className="flex items-center justify-center gap-3 my-2">
              {[0, 1, 2, 3].map((idx) => {
                const char = pinDigits[idx];
                return (
                  <div
                    key={idx}
                    className={`w-14 h-16 rounded-2xl flex items-center justify-center font-mono text-3xl font-black transition-all ${
                      char
                        ? 'bg-amber-500 text-zinc-950 border-2 border-amber-300 shadow-lg shadow-amber-500/20'
                        : 'bg-zinc-950 text-zinc-600 border border-zinc-800'
                    }`}
                  >
                    {char || '·'}
                  </div>
                );
              })}
            </div>

            {errorMessage && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/30">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Tactile Keypad */}
          <div className="grid grid-cols-3 gap-2.5 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                type="button"
                key={digit}
                onClick={() => handleKeyPress(digit)}
                className="h-14 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:scale-95 text-zinc-100 font-mono text-xl font-bold border border-zinc-700/60 shadow transition-all cursor-pointer"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-14 rounded-2xl bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-xs uppercase tracking-wider border border-zinc-800 transition-all cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-14 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700 active:scale-95 text-zinc-100 font-mono text-xl font-bold border border-zinc-700/60 shadow transition-all cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className="h-14 rounded-2xl bg-zinc-800/40 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 font-bold text-xs uppercase tracking-wider border border-zinc-800 transition-all cursor-pointer flex items-center justify-center"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Submit Verification Button */}
          <button
            type="button"
            disabled={isVerifying || pinDigits.length !== 4 || !selectedOrder}
            onClick={handleVerify}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] text-zinc-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <CheckCircle2 className="w-5 h-5 fill-zinc-950" />
            <span>
              {isVerifying ? 'Capturing Payment & Releasing Payout...' : 'Verify PIN & Fulfill Order'}
            </span>
          </button>

          {/* Success Banner when redeemed */}
          {lastRedeemedOrder && (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 space-y-2 animate-in fade-in duration-300">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span>Handshake Successful! Order Fulfilled</span>
              </div>
              <p className="text-xs text-zinc-300">
                Payment captured via Stripe Connect. Released{' '}
                <strong className="text-emerald-400 font-mono font-bold">
                  ${(lastRedeemedOrder.merchant_payout_cents / 100).toFixed(2)}
                </strong>{' '}
                direct payout to connected merchant balance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Hash, 
  Scan, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  Store, 
  Clock, 
  DollarSign,
  ShieldCheck,
  RotateCcw,
  QrCode,
  Zap,
  Check
} from 'lucide-react';
import type { Order } from '@/src/lib/types/database';
import { executeRedemptionHandshake } from '@/src/lib/store/realtimeStore';
import confetti from 'canvas-confetti';

interface TerminalRedemptionProps {
  orders: Order[];
  merchantId?: string;
  targetOrderId?: string;
  onSuccess?: (order: Order) => void;
}

export function TerminalRedemption({ orders, merchantId, targetOrderId, onSuccess }: TerminalRedemptionProps) {
  // Scope orders to active authenticated merchant if provided
  const scopedOrders = merchantId 
    ? orders.filter((o) => o.merchant_id === merchantId)
    : orders;

  const activeReservedOrders = scopedOrders.filter((o) => o.status === 'reserved');

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    targetOrderId || activeReservedOrders[0]?.id || ''
  );
  const [verificationMode, setVerificationMode] = useState<'pin' | 'qr'>('pin');
  const [pinDigits, setPinDigits] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastRedeemedOrder, setLastRedeemedOrder] = useState<Order | null>(null);
  const [payoutNotification, setPayoutNotification] = useState<{ amount: string; orderId: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanningSim, setIsScanningSim] = useState(false);

  const selectedOrder = scopedOrders.find((o) => o.id === selectedOrderId);

  // Sync selected order if targetOrderId changes or activeReservedOrders update
  useEffect(() => {
    if (targetOrderId && orders.some((o) => o.id === targetOrderId)) {
      setSelectedOrderId(targetOrderId);
    } else if (!selectedOrderId && activeReservedOrders.length > 0) {
      setSelectedOrderId(activeReservedOrders[0].id);
    }
  }, [targetOrderId, activeReservedOrders, selectedOrderId]);

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

  const executeFulfillment = (orderId: string, pin: string) => {
    setIsVerifying(true);
    setErrorMessage(null);

    setTimeout(() => {
      const res = executeRedemptionHandshake(orderId, pin);
      setIsVerifying(false);

      if (!res.success || !res.order) {
        setErrorMessage(res.error || 'Verification failed. Token does not match order.');
        return;
      }

      const payoutDollars = (res.order.merchant_payout_cents / 100).toFixed(2);
      setLastRedeemedOrder(res.order);
      setPayoutNotification({
        amount: payoutDollars,
        orderId: res.order.id,
      });
      setPinDigits('');
      if (onSuccess) onSuccess(res.order);

      try {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#10b981', '#f59e0b', '#3b82f6'],
        });
      } catch {
        // ignore
      }
    }, 400);
  };

  const handleVerifyPin = () => {
    if (!selectedOrder) {
      setErrorMessage('Please select an active order to redeem.');
      return;
    }

    if (pinDigits.length !== 4) {
      setErrorMessage("Please enter customer's 4-digit pickup PIN.");
      return;
    }

    executeFulfillment(selectedOrder.id, pinDigits);
  };

  const handleSimulateQrScan = () => {
    if (!selectedOrder) {
      setErrorMessage('Please select an active order first to scan pass.');
      return;
    }

    setIsScanningSim(true);
    setErrorMessage(null);

    // Simulate optical scan camera laser reading pass
    setTimeout(() => {
      setIsScanningSim(false);
      executeFulfillment(selectedOrder.id, selectedOrder.qr_token);
    }, 1200);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Payout Banner if recently fulfilled */}
      {payoutNotification && (
        <div className="p-4 bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-teal-500/20 border-2 border-emerald-500/60 rounded-3xl flex items-center justify-between gap-4 animate-in slide-in-from-top-3 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-emerald-300">
                Fulfillment Complete · Payout Released
              </h4>
              <p className="text-xs text-zinc-300">
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  +${payoutNotification.amount}
                </span>{' '}
                instantly transferred to your connected Stripe balance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPayoutNotification(null)}
            className="text-zinc-400 hover:text-zinc-200 text-xs px-2 py-1 rounded-lg bg-zinc-900/60 border border-zinc-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* POS Top Bar */}
      <div className="p-5 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 rounded-3xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-zinc-100">
                Front-of-House Redemption Terminal
              </h2>
              <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                Live POS
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Verify customer 4-digit PIN or scan QR pickup pass to capture payment and release Stripe payout.
            </p>
          </div>
        </div>

        {/* Mode Toggle: PIN vs QR */}
        <div className="flex items-center bg-zinc-950 p-1 rounded-2xl border border-zinc-800 self-start sm:self-center">
          <button
            type="button"
            onClick={() => {
              setVerificationMode('pin');
              setErrorMessage(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              verificationMode === 'pin'
                ? 'bg-amber-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>4-Digit PIN</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setVerificationMode('qr');
              setErrorMessage(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              verificationMode === 'qr'
                ? 'bg-amber-500 text-zinc-950 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Scan className="w-3.5 h-3.5" />
            <span>QR Pass Scanner</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Orders in Queue (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span className="font-semibold uppercase tracking-wider">Awaiting Customer Arrival</span>
            <span className="font-mono text-amber-400 font-bold">{activeReservedOrders.length} In-Queue</span>
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-semibold text-amber-400">
                          {ord.id.toUpperCase()}
                        </span>
                        <span className="text-[10px] font-mono bg-zinc-800 text-zinc-300 px-1.5 py-0.2 rounded border border-zinc-700">
                          PIN: {ord.pickup_pin}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-100 mt-1 line-clamp-1">
                        {ord.listing?.title}
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      ${(ord.total_amount_cents / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                    <span className="font-medium text-zinc-400">
                      Payout: <strong className="text-emerald-400 font-mono">${(ord.merchant_payout_cents / 100).toFixed(2)}</strong>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-amber-300/80">
                      <Clock className="w-3 h-3" />
                      30m Window
                    </span>
                  </div>
                </div>
              );
            })}

            {activeReservedOrders.length === 0 && (
              <div className="p-8 text-center bg-zinc-900/50 border border-zinc-800 rounded-2xl space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-zinc-200">No Customers Currently in Queue</p>
                <p className="text-[11px] text-zinc-500">
                  Switch to the Consumer app and tap "Claim Now" to generate an active pickup order.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tactical POS Keypad / QR Scanner (7 cols) */}
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
                <span className="text-[10px] text-zinc-500 block">Customer PIN</span>
                <span className="text-xs font-mono font-bold text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                  {selectedOrder.pickup_pin}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-dashed border-zinc-800 text-center text-xs text-zinc-400">
              Select an order from the left column to verify
            </div>
          )}

          {/* DUAL MODE: PIN KEYPAD vs QR SCANNER */}
          {verificationMode === 'pin' ? (
            <div className="space-y-4">
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
                onClick={handleVerifyPin}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] text-zinc-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5 fill-zinc-950" />
                <span>
                  {isVerifying ? 'Capturing Payment & Transferring...' : 'Verify PIN & Fulfill Order'}
                </span>
              </button>
            </div>
          ) : (
            /* QR SCANNER MODE */
            <div className="space-y-4">
              <div className="relative w-full aspect-video max-w-sm mx-auto rounded-3xl bg-zinc-950 border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center overflow-hidden">
                {isScanningSim ? (
                  <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
                    {/* Viewfinder Laser Animation */}
                    <div className="absolute inset-x-4 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] animate-pulse" />
                    <div className="text-center space-y-2 z-10">
                      <Camera className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
                      <p className="text-xs font-mono text-emerald-400">Scanning Customer Pass...</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-6 space-y-2">
                    <Scan className="w-12 h-12 text-zinc-500 mx-auto" />
                    <p className="text-xs font-bold text-zinc-300">Point Camera at Customer QR Code</p>
                    <p className="text-[11px] text-zinc-500">
                      Align the high-contrast SVG pass displayed on customer's phone
                    </p>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="flex items-center justify-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/30">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Trigger Simulated QR Read */}
              <button
                type="button"
                disabled={!selectedOrder || isScanningSim || isVerifying}
                onClick={handleSimulateQrScan}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.99] text-zinc-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 cursor-pointer"
              >
                <Scan className="w-5 h-5" />
                <span>
                  {isScanningSim ? 'Reading QR Token...' : 'Scan Customer Pass (Simulate)'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

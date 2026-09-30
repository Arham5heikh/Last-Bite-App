import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  KeyRound, 
  ShieldCheck, 
  AlertCircle, 
  Store, 
  ChevronRight, 
  Sparkles,
  Delete,
  RotateCcw,
  CheckCircle2,
  ChefHat,
  MapPin
} from 'lucide-react';

import { ST_JOHNS_RESTAURANTS, type StJohnsRestaurantInfo } from '@/src/lib/data/stJohns';
import { LastBiteLogo } from '@/src/components/common/LastBiteLogo';
import { HowItWorksButton } from '@/src/components/common/HowItWorksVideo';

export { ST_JOHNS_RESTAURANTS, type StJohnsRestaurantInfo };

// Compact label for buttons: drop leading "The" and trailing descriptors
export function shortName(name: string): string {
  return name.replace(/^The\s+/, '').split(/\s+(?:Restaurant|&|Brewery|Pizzeria|Bakery|Oyster|Tavern)\b/)[0];
}

interface TerminalLoginProps {
  onLoginSuccess: (restaurant: StJohnsRestaurantInfo) => void;
}

export function TerminalLogin({ onLoginSuccess }: TerminalLoginProps) {
  const [selectedRestaurant, setSelectedRestaurant] = useState<StJohnsRestaurantInfo>(ST_JOHNS_RESTAURANTS[0]);
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shake, setShake] = useState(false);

  const handleKeyPress = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setErrorMessage(null);

      // Auto-validate on 4th digit
      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage(null);
  };

  const verifyPin = (enteredPin: string) => {
    // Check if entered PIN matches the selected restaurant
    if (enteredPin === selectedRestaurant.pin) {
      executeSuccess(selectedRestaurant);
      return;
    }

    // Smart fallback: Check if entered PIN matches ANY of the St. John's restaurants
    const matched = ST_JOHNS_RESTAURANTS.find((r) => r.pin === enteredPin);
    if (matched) {
      setSelectedRestaurant(matched);
      executeSuccess(matched);
      return;
    }

    // Invalid PIN
    triggerError(`Invalid 4-digit PIN for ${selectedRestaurant.name}. (Default PIN is ${selectedRestaurant.pin})`);
  };

  const executeSuccess = (restaurant: StJohnsRestaurantInfo) => {
    setIsSuccess(true);
    setErrorMessage(null);
    setTimeout(() => {
      onLoginSuccess(restaurant);
    }, 450);
  };

  const triggerError = (msg: string) => {
    setShake(true);
    setErrorMessage(msg);
    setTimeout(() => {
      setShake(false);
      setPin('');
    }, 600);
  };

  // Direct fast test fill
  const handleQuickDemoSelect = (restaurant: StJohnsRestaurantInfo) => {
    setSelectedRestaurant(restaurant);
    setPin(restaurant.pin);
    setErrorMessage(null);
    setTimeout(() => {
      executeSuccess(restaurant);
    }, 200);
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 px-4">
      {/* Header Banner */}
      <div className="text-center mb-8 space-y-2">
        <LastBiteLogo className="w-14 h-14 mx-auto mb-3" />
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold">
          <Lock className="w-3.5 h-3.5" />
          <span>St. John's KDS Security Gateway</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight">
          Kitchen Terminal Gateway
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto">
          Authenticate with your location's 4-digit terminal PIN to access preset dish catalogs, broadcast surplus drops, and scan pickup passes.
        </p>
        <div className="flex justify-center pt-2">
          <HowItWorksButton audience="restaurants" label="Watch: how Last Bite works for restaurants" className="min-h-12 px-4 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:landscape:grid-cols-12 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: St. John's Location Selector */}
        <div className="md:landscape:col-span-7 lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                Select Restaurant Terminal
              </span>
              <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                St. John's, NL
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {ST_JOHNS_RESTAURANTS.map((resto) => {
                const isSelected = selectedRestaurant.id === resto.id;
                return (
                  <button
                    key={resto.id}
                    type="button"
                    onClick={() => {
                      setSelectedRestaurant(resto);
                      setPin('');
                      setErrorMessage(null);
                    }}
                    className={`w-full min-h-16 text-left p-3 rounded-2xl border transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/60 shadow-lg text-zinc-100'
                        : 'bg-zinc-950/60 border-zinc-800/80 hover:bg-zinc-800/60 text-zinc-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-800 overflow-hidden shrink-0 border border-zinc-700">
                        <img 
                          src={resto.photoUrl} 
                          alt={resto.name} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-extrabold text-zinc-200 leading-tight line-clamp-2">
                            {resto.emoji} {resto.name}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5 min-w-0">
                          <MapPin className="w-3 h-3 text-zinc-500" />
                          <span className="truncate">{resto.address.split(',')[0]}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-mono text-zinc-500 block uppercase">
                        PIN
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        {resto.pin}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Demo Test Buttons */}
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3">
            <span className="text-[10px] font-mono uppercase text-zinc-500 tracking-wider block mb-2 font-bold">
              ⚡ Demo Quick-Launch:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {ST_JOHNS_RESTAURANTS.map((resto) => (
                <button
                  key={`demo-${resto.id}`}
                  type="button"
                  onClick={() => handleQuickDemoSelect(resto)}
                  className="min-h-14 px-2 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:scale-95 border border-zinc-700/80 text-xs font-mono text-zinc-300 hover:text-amber-400 text-center transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer min-w-0"
                >
                  <span className="truncate max-w-full">{resto.emoji} {shortName(resto.name)}</span>
                  <span className="font-bold text-amber-400">{resto.pin}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Physical Tactile PIN Pad */}
        <div className="md:landscape:col-span-5 lg:col-span-5 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Terminal PIN Pad
              </span>
              <span className="text-xs font-mono text-zinc-400">
                Target: <strong className="text-zinc-200">{shortName(selectedRestaurant.name)}</strong>
              </span>
            </div>

            {/* PIN Display Dots */}
            <div className={`my-4 p-5 rounded-2xl bg-zinc-950 border transition-all ${
              shake 
                ? 'border-rose-500 shadow-rose-950/50 shadow-lg animate-shake' 
                : isSuccess 
                ? 'border-emerald-500 shadow-emerald-950/50 shadow-lg' 
                : 'border-zinc-800'
            }`}>
              <div className="flex items-center justify-center gap-4">
                {[0, 1, 2, 3].map((index) => {
                  const isFilled = index < pin.length;
                  return (
                    <div
                      key={index}
                      className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                        isFilled
                          ? isSuccess
                            ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-md shadow-emerald-500/50'
                            : 'bg-amber-400 border-amber-400 scale-110 shadow-md shadow-amber-500/50'
                          : 'border-zinc-700 bg-zinc-900'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Status Message */}
              <div className="mt-3 text-center min-h-[20px]">
                {errorMessage ? (
                  <p className="text-xs font-medium text-rose-400 flex items-center justify-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMessage}</span>
                  </p>
                ) : isSuccess ? (
                  <p className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1 animate-pulse">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Terminal Unlocked! Loading KDS...</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Enter {shortName(selectedRestaurant.name)}'s PIN ({selectedRestaurant.pin})
                  </p>
                )}
              </div>
            </div>

            {/* PIN Pad 3x4 Grid */}
            <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  disabled={isSuccess || pin.length >= 4}
                  className="h-20 rounded-2xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/50 text-3xl font-bold font-mono text-zinc-100 hover:text-amber-400 active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  {digit}
                </button>
              ))}

              {/* Bottom Row: Clear, 0, Backspace */}
              <button
                type="button"
                onClick={handleClear}
                disabled={isSuccess || pin.length === 0}
                className="h-20 rounded-2xl bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800/80 text-xs font-mono font-bold text-zinc-400 hover:text-rose-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
                title="Clear PIN"
              >
                <RotateCcw className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                disabled={isSuccess || pin.length >= 4}
                className="h-20 rounded-2xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/50 text-3xl font-bold font-mono text-zinc-100 hover:text-amber-400 active:scale-95 transition-all shadow-md flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                disabled={isSuccess || pin.length === 0}
                className="h-20 rounded-2xl bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800/80 text-xs font-mono font-bold text-zinc-400 hover:text-amber-400 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-30"
                title="Backspace"
              >
                <Delete className="w-7 h-7" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800/80 text-center">
            <span className="text-[10px] text-zinc-500 font-mono">
              Last Bite POS · Encrypted Keypad · Station ID: LB-NL-01
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  Store, 
  LogOut, 
  ShieldCheck, 
  MapPin, 
  Sparkles, 
  ChefHat, 
  Clock, 
  CheckCircle2,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  ArrowRight
} from 'lucide-react';
import { TerminalLogin, ST_JOHNS_RESTAURANTS, type StJohnsRestaurantInfo } from './TerminalLogin';
import type { Merchant, Order, Listing } from '@/src/lib/types/database';

interface KitchenAuthContextType {
  activeRestaurant: StJohnsRestaurantInfo;
  activeRestaurantId: string;
  logout: () => void;
  switchRestaurant: (restoId: string) => void;
}

const KitchenAuthContext = createContext<KitchenAuthContextType | null>(null);

export function useKitchenAuth() {
  const context = useContext(KitchenAuthContext);
  if (!context) {
    throw new Error('useKitchenAuth must be used within a TerminalAuthWrapper');
  }
  return context;
}

interface TerminalAuthWrapperProps {
  children?: React.ReactNode;
  activeSubTab?: 'catalog' | 'verify';
  onSubTabChange?: (tab: 'catalog' | 'verify') => void;
  renderContent?: (restaurant: StJohnsRestaurantInfo) => React.ReactNode;
}

const STORAGE_KEY = 'lastbite_kitchen_active_session_id';

export function TerminalAuthWrapper({
  children,
  activeSubTab = 'catalog',
  onSubTabChange,
  renderContent,
}: TerminalAuthWrapperProps) {
  // Active authenticated restaurant state (persisted across reloads)
  const [authenticatedRestaurant, setAuthenticatedRestaurant] = useState<StJohnsRestaurantInfo | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedId = sessionStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const match = ST_JOHNS_RESTAURANTS.find((r) => r.id === savedId);
          if (match) return match;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });

  const handleLoginSuccess = (restaurant: StJohnsRestaurantInfo) => {
    setAuthenticatedRestaurant(restaurant);
    try {
      sessionStorage.setItem(STORAGE_KEY, restaurant.id);
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    setAuthenticatedRestaurant(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const handleSwitchRestaurant = (restoId: string) => {
    const target = ST_JOHNS_RESTAURANTS.find((r) => r.id === restoId);
    if (target) {
      setAuthenticatedRestaurant(target);
      try {
        sessionStorage.setItem(STORAGE_KEY, target.id);
      } catch {
        // ignore
      }
    }
  };

  // If not authenticated, display the locked PIN Terminal Login Screen
  if (!authenticatedRestaurant) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <TerminalLogin onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // Once authenticated, provide Context and render top bar with scoped interface
  return (
    <KitchenAuthContext.Provider
      value={{
        activeRestaurant: authenticatedRestaurant,
        activeRestaurantId: authenticatedRestaurant.id,
        logout: handleLogout,
        switchRestaurant: handleSwitchRestaurant,
      }}
    >
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-3 sm:p-6 space-y-6">
        {/* Authenticated KDS Station Header */}
        <div className="w-full max-w-6xl mx-auto bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 text-xl">
              {authenticatedRestaurant.emoji}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-zinc-100">
                  {authenticatedRestaurant.name}
                </h1>
                <span className="text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Terminal PIN {authenticatedRestaurant.pin} Active
                </span>
              </div>
              <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-zinc-500" />
                <span>{authenticatedRestaurant.address}</span>
                <span className="text-zinc-600">·</span>
                <span className="text-amber-400 font-mono">50% Rule Enforced</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Sub-tab Navigation (Catalog vs POS Redemption) */}
            {onSubTabChange && (
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-2xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => onSubTabChange('catalog')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'catalog'
                      ? 'bg-amber-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  ⚡ 3-Tap Catalog
                </button>
                <button
                  type="button"
                  onClick={() => onSubTabChange('verify')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeSubTab === 'verify'
                      ? 'bg-amber-500 text-zinc-950 shadow-md'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  🎟️ Redemption POS
                </button>
              </div>
            )}

            {/* Quick Switch Dropdown for Multi-Restaurant Demos */}
            <select
              value={authenticatedRestaurant.id}
              onChange={(e) => handleSwitchRestaurant(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs rounded-xl px-2.5 py-1.5 font-mono cursor-pointer focus:outline-none focus:border-amber-500"
              title="Switch St. John's Restaurant"
            >
              {ST_JOHNS_RESTAURANTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.emoji} {r.name.split(' ')[0]} ({r.pin})
                </option>
              ))}
            </select>

            {/* End Shift / Log Out Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-700/60 text-zinc-400 hover:text-rose-300 text-xs font-mono font-bold transition-all cursor-pointer"
              title="Lock terminal and end shift"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock Station</span>
            </button>
          </div>
        </div>

        {/* Scoped Content Area */}
        <div className="w-full">
          {renderContent ? renderContent(authenticatedRestaurant) : children}
        </div>
      </div>
    </KitchenAuthContext.Provider>
  );
}

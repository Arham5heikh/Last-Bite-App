/**
 * Last Bite - Real-Time Surplus Food Rescue
 * Master Application Shell with Decoupled Portals:
 * 1. Consumer App (/consumer) - Discover, Map (Leaflet), Radar, and Claim with Zero Ghosts
 * 2. Kitchen Terminal (/kitchen) - Standalone Tablet POS / KDS for Restaurant Staff
 */

import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  MapPin, 
  Store, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  Receipt, 
  Database, 
  PlusCircle, 
  UtensilsCrossed, 
  ShoppingBag,
  TrendingDown,
  Info,
  ChevronRight,
  Tablet,
  Smartphone,
  Hash,
  Scan,
  ChefHat,
  ArrowLeftRight
} from 'lucide-react';
import type { Listing, Order } from '@/src/lib/types/database';
import { useRealtimeStore } from '@/src/lib/store/realtimeStore';
import { LiveFeed } from '@/src/components/consumer/LiveFeed';
import { QuickPostModal } from '@/src/components/merchant/QuickPostModal';
import { CheckoutModal } from '@/src/components/consumer/CheckoutModal';
import { PickupPassModal } from '@/src/components/consumer/PickupPassModal';
import { PresetCatalogListing } from '@/src/components/kitchen/PresetCatalogListing';
import { TerminalRedemption } from '@/src/components/kitchen/TerminalRedemption';
import { TerminalAuthWrapper } from '@/src/components/kitchen/TerminalAuthWrapper';
import { ArchitectureInspectorModal } from '@/src/components/common/ArchitectureInspectorModal';

type AppPortal = 'consumer' | 'kitchen';
type KitchenSubView = 'catalog' | 'verify';

export default function App() {
  const { listings, orders, tick } = useRealtimeStore();

  // Route state initialized from window.location.pathname
  const [currentPortal, setCurrentPortal] = useState<AppPortal>('consumer');
  const [kitchenTab, setKitchenTab] = useState<KitchenSubView>('catalog');

  const [isQuickPostOpen, setIsQuickPostOpen] = useState(false);
  const [selectedListingForCheckout, setSelectedListingForCheckout] = useState<Listing | null>(null);
  const [activePassOrder, setActivePassOrder] = useState<Order | null>(null);
  const [isPassModalOpen, setIsPassModalOpen] = useState(false);
  const [isArchModalOpen, setIsArchModalOpen] = useState(false);
  const [terminalTargetOrderId, setTerminalTargetOrderId] = useState<string | undefined>();
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User simulated geolocation (Downtown St. John's, Newfoundland)
  const userLat = 47.5615;
  const userLon = -52.7126;

  // Initialize and handle URL routing
  useEffect(() => {
    const handleUrlSync = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/kitchen/verify')) {
        setCurrentPortal('kitchen');
        setKitchenTab('verify');
      } else if (path.includes('/kitchen')) {
        setCurrentPortal('kitchen');
        setKitchenTab('catalog');
      } else {
        setCurrentPortal('consumer');
      }
    };

    handleUrlSync();
    window.addEventListener('popstate', handleUrlSync);
    return () => window.removeEventListener('popstate', handleUrlSync);
  }, []);

  const navigateTo = (portal: AppPortal, subTab: KitchenSubView = 'catalog') => {
    setCurrentPortal(portal);
    setKitchenTab(subTab);
    const newPath = portal === 'kitchen' 
      ? (subTab === 'verify' ? '/kitchen/verify' : '/kitchen')
      : '/consumer';
    
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleClaim = (listing: Listing) => {
    setSelectedListingForCheckout(listing);
  };

  const handleCheckoutSuccess = (order: Order) => {
    setActivePassOrder(order);
    setIsPassModalOpen(true);
    showToast(`Order reserved! Your 4-digit PIN is: ${order.pickup_pin}`);
  };

  const handleOpenMerchantTerminal = (orderId: string) => {
    setTerminalTargetOrderId(orderId);
    navigateTo('kitchen', 'verify');
  };

  const activeReservationsCount = orders.filter((o) => o.status === 'reserved').length;
  const activeSurplusCount = listings.filter((l) => l.status === 'active').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950">
      {/* Top Banner: Emergency Surplus Ticker & Portal Switcher Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 text-xs py-1.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-inner">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span className="font-mono text-[11px]">
            ZERO-GHOST RESCUE NETWORK: <strong className="text-zinc-200">142 meals rescued today</strong> · 7-minute atomic locks active
          </span>
        </div>

        {/* Top Role Portal Switcher */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-0.5 rounded-xl border border-zinc-800 text-[11px]">
          <span className="text-zinc-500 px-2 font-mono text-[10px] uppercase">Active Portal:</span>
          <button
            type="button"
            onClick={() => navigateTo('consumer')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              currentPortal === 'consumer'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-3 h-3" />
            <span>Consumer App (/consumer)</span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('kitchen', 'catalog')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
              currentPortal === 'kitchen'
                ? 'bg-amber-500 text-zinc-950 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Tablet className="w-3 h-3" />
            <span>Kitchen Terminal (/kitchen)</span>
            {activeReservationsCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* Main Navigation Bar - Contextually Decoupled per Role */}
      {currentPortal === 'consumer' && (
        /* CONSUMER NAVIGATION HEADER */
        <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              onClick={() => navigateTo('consumer')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <Zap className="w-5 h-5 fill-zinc-950 text-zinc-950" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-lg sm:text-xl text-zinc-100 tracking-tight">
                    Last<span className="text-amber-400">Bite</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Consumer
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 -mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  Downtown St. John's, NL
                </p>
              </div>
            </div>
          </div>

          {/* Consumer Action Controls */}
          <div className="flex items-center gap-2.5">
            {/* Active Pass shortcut if order exists */}
            {orders.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const latest = orders[0];
                  setActivePassOrder(latest);
                  setIsPassModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/40 text-xs font-semibold hover:bg-amber-500/25 transition-colors cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>My Active Pass (#{orders[0].pickup_pin})</span>
              </button>
            )}

            {/* Architecture Inspector */}
            <button
              type="button"
              onClick={() => setIsArchModalOpen(true)}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
              title="Inspect SQL Migration & Next.js Server Actions"
            >
              <Database className="w-4 h-4 text-amber-400" />
            </button>

            {/* Switch to Merchant CTA */}
            <button
              type="button"
              onClick={() => navigateTo('kitchen', 'catalog')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ChefHat className="w-3.5 h-3.5 text-amber-400" />
              <span>Kitchen KDS ➔</span>
            </button>
          </div>
        </header>
      )}

      {/* Real-time notification toast */}
      {toastMessage && (
        <div className="fixed top-16 right-4 z-50 bg-zinc-900 border border-amber-500/60 text-zinc-100 px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-top-3 duration-300">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {currentPortal === 'consumer' ? (
          /* DECOUPLED CONSUMER DISCOVERY VIEW */
          <LiveFeed
            listings={listings}
            onClaimListing={handleClaim}
            userLat={userLat}
            userLon={userLon}
          />
        ) : (
          /* DECOUPLED KITCHEN TERMINAL VIEW WITH PIN-PROTECTION GATEWAY */
          <TerminalAuthWrapper
            activeSubTab={kitchenTab}
            onSubTabChange={(tab) => navigateTo('kitchen', tab)}
            renderContent={(restaurant) => (
              <div className="space-y-6">
                {kitchenTab === 'catalog' ? (
                  <PresetCatalogListing
                    activeListings={listings}
                    merchantId={restaurant.id}
                    onOpenCustomModal={() => setIsQuickPostOpen(true)}
                    onListingPublished={(newListing) => {
                      showToast(`Published "${newListing.title}" to live feed!`);
                    }}
                  />
                ) : (
                  <TerminalRedemption
                    orders={orders}
                    merchantId={restaurant.id}
                    targetOrderId={terminalTargetOrderId}
                    onSuccess={(ord) => {
                      showToast(`Order #${ord.pickup_pin} fulfilled! Payment transferred.`);
                    }}
                  />
                )}
              </div>
            )}
          />
        )}
      </main>

      {/* Footer Info Bar */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-6 px-4 sm:px-8 text-xs text-zinc-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-semibold text-zinc-300">Last Bite Marketplace</span>
            <span>· Decoupled Consumer Feed & Kitchen POS Terminal</span>
          </div>

          <div className="flex items-center gap-4 text-zinc-400">
            <button
              onClick={() => setIsArchModalOpen(true)}
              className="hover:text-amber-400 transition-colors underline underline-offset-4 cursor-pointer"
            >
              View SQL Migration & Server Actions
            </button>
            <span>·</span>
            <span>Zero Ghost Invariant Guaranteed</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <QuickPostModal
        isOpen={isQuickPostOpen}
        onClose={() => setIsQuickPostOpen(false)}
        onSuccess={(newListing) => {
          showToast(`Surplus posted: "${newListing.title}" is live!`);
        }}
      />

      <CheckoutModal
        listing={selectedListingForCheckout}
        isOpen={!!selectedListingForCheckout}
        onClose={() => setSelectedListingForCheckout(null)}
        onSuccess={handleCheckoutSuccess}
      />

      <PickupPassModal
        order={activePassOrder}
        isOpen={isPassModalOpen}
        onClose={() => setIsPassModalOpen(false)}
        onOpenMerchantTerminal={handleOpenMerchantTerminal}
      />

      <ArchitectureInspectorModal
        isOpen={isArchModalOpen}
        onClose={() => setIsArchModalOpen(false)}
      />
    </div>
  );
}

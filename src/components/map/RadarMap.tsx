import React, { useState } from 'react';
import { 
  Compass, 
  MapPin, 
  Crosshair, 
  Clock, 
  Zap, 
  Navigation2, 
  Sparkles,
  ShoppingBag,
  Info
} from 'lucide-react';
import type { Listing } from '@/src/lib/types/database';

interface RadarMapProps {
  listings: Listing[];
  userLat: number;
  userLon: number;
  onSelectListing: (listing: Listing) => void;
  onClaimListing: (listing: Listing) => void;
}

export function RadarMap({
  listings,
  userLat,
  userLon,
  onSelectListing,
  onClaimListing,
}: RadarMapProps) {
  const [selectedPin, setSelectedPin] = useState<Listing | null>(listings[0] || null);
  const [radarActive, setRadarActive] = useState(true);

  // Map viewport dimensions & scaling
  const mapCenterLat = userLat;
  const mapCenterLon = userLon;
  const latSpan = 0.05; // ~5km radius
  const lonSpan = 0.06;

  // Converts geographic lat/long to percentage coordinates (0-100%) inside the SVG/Canvas radar
  const getCanvasCoords = (lat: number, lon: number) => {
    const x = 50 + ((lon - mapCenterLon) / lonSpan) * 100;
    const y = 50 - ((lat - mapCenterLat) / latSpan) * 100;
    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(8, Math.min(92, y)),
    };
  };

  return (
    <div className="relative w-full h-[480px] sm:h-[580px] bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl flex flex-col select-none">
      {/* Top Map HUD Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2 bg-zinc-900/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-zinc-700/80 shadow-lg pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-xs font-mono font-bold text-zinc-200">RADAR ACTIVE</span>
          <span className="text-[11px] text-zinc-400 font-mono">| {listings.filter(l => l.status === 'active').length} Surplus Nodes</span>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setRadarActive(!radarActive)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono font-semibold border backdrop-blur-md transition-all ${
              radarActive
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : 'bg-zinc-900/80 text-zinc-400 border-zinc-700'
            }`}
          >
            {radarActive ? 'Sweep: ON' : 'Sweep: PAUSED'}
          </button>
        </div>
      </div>

      {/* Radar Coordinate Grid & Concentric Distance Rings */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:24px_24px]">
        {/* Radar Rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
          <div className="w-[180px] h-[180px] rounded-full border border-dashed border-amber-500/40 flex items-center justify-center">
            <span className="text-[9px] font-mono text-amber-400/80 -mt-2">1 km</span>
          </div>
          <div className="absolute w-[340px] h-[340px] rounded-full border border-zinc-700 flex items-center justify-center">
            <span className="text-[9px] font-mono text-zinc-500 -mt-2">3 km</span>
          </div>
          <div className="absolute w-[500px] h-[500px] rounded-full border border-zinc-800 flex items-center justify-center">
            <span className="text-[9px] font-mono text-zinc-600 -mt-2">5 km</span>
          </div>
          {/* Crosshair lines */}
          <div className="absolute w-full h-[1px] bg-zinc-800/80" />
          <div className="absolute h-full w-[1px] bg-zinc-800/80" />
        </div>

        {/* Radar Rotating Sweep Beam */}
        {radarActive && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] pointer-events-none rounded-full origin-center animate-[spin_6s_linear_infinite]"
            style={{
              background: 'conic-gradient(from 0deg, rgba(245, 158, 11, 0.15) 0deg, rgba(245, 158, 11, 0) 60deg, transparent 360deg)',
            }}
          />
        )}

        {/* User GPS Center Marker */}
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: '50%', top: '50%' }}
        >
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 animate-ping absolute" />
            <div className="w-6 h-6 rounded-full bg-blue-600/50 border border-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/50">
              <div className="w-2.5 h-2.5 rounded-full bg-white shadow" />
            </div>
            <span className="absolute top-7 bg-zinc-900/90 text-blue-300 font-mono text-[10px] px-2 py-0.5 rounded-full border border-blue-500/30 whitespace-nowrap">
              You (Live PostGIS Origin)
            </span>
          </div>
        </div>

        {/* Interactive Radar Pins for Surplus Listings */}
        {listings.map((item) => {
          const merchant = item.merchant;
          const lat = merchant?.latitude ?? 37.765;
          const lon = merchant?.longitude ?? -122.42;
          const coords = getCanvasCoords(lat, lon);
          const isSelected = selectedPin?.id === item.id;
          const isReserved = item.status === 'reserved';
          const isExpired = item.status === 'expired';

          return (
            <div
              key={item.id}
              className="absolute z-30 -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 hover:scale-110 cursor-pointer"
              style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
              onClick={() => {
                setSelectedPin(item);
                onSelectListing(item);
              }}
            >
              <div className="relative group">
                {/* Ping pulse */}
                {!isReserved && !isExpired && (
                  <div className="absolute -inset-1 rounded-full bg-amber-400/40 animate-ping" />
                )}

                {/* Radar Pin Badge */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shadow-xl transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-zinc-950 border-amber-300 ring-2 ring-amber-400/60 font-bold scale-105'
                      : isReserved
                      ? 'bg-zinc-800 text-zinc-400 border-zinc-700 opacity-60'
                      : 'bg-zinc-900/95 text-zinc-100 border-amber-500/60 hover:border-amber-400'
                  }`}
                >
                  <span className="text-xs">
                    {item.category === 'Pizza' ? '🍕' : item.category === 'Japanese' ? '🍣' : item.category === 'Bakery' ? '🥐' : '🥡'}
                  </span>
                  <span className="font-mono text-xs font-bold">
                    ${(item.discounted_price_cents / 100).toFixed(0)}
                  </span>
                  {item.distance_km && (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      · {item.distance_km}km
                    </span>
                  )}
                </div>

                {/* Small indicator needle */}
                <div
                  className={`w-1.5 h-1.5 mx-auto rotate-45 -mt-0.5 border-r border-b ${
                    isSelected
                      ? 'bg-amber-500 border-amber-300'
                      : 'bg-zinc-900 border-amber-500/60'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Selected Pin Card Drawer at bottom of map */}
      {selectedPin && (
        <div className="absolute bottom-4 left-4 right-4 z-40 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 rounded-2xl p-3 sm:p-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={selectedPin.photo_url}
                alt={selectedPin.title}
                className="w-14 h-14 rounded-xl object-cover border border-zinc-700 shrink-0"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-400 truncate">
                    {selectedPin.merchant?.business_name}
                  </span>
                  <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                    {selectedPin.surplus_reason.replace('_', ' ')}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-zinc-100 truncate">{selectedPin.title}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-zinc-400 line-through font-mono">
                    ${(selectedPin.original_price_cents / 100).toFixed(2)}
                  </span>
                  <span className="text-emerald-400 font-mono font-bold text-sm">
                    ${(selectedPin.discounted_price_cents / 100).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                    <Navigation2 className="w-3 h-3 text-amber-400" />
                    {selectedPin.distance_km ?? 1.2} km away
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={selectedPin.status !== 'active'}
                onClick={() => onClaimListing(selectedPin)}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-950 font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{selectedPin.status === 'active' ? 'Claim Now' : 'Reserved'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

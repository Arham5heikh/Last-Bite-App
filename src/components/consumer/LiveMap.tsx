import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, 
  Navigation, 
  RefreshCw, 
  Compass, 
  Crosshair,
  AlertTriangle
} from 'lucide-react';
import type { Listing } from '@/src/lib/types/database';

export interface LiveMapProps {
  listings: Listing[];
  onClaimListing: (listing: Listing) => void;
  onLocationDetected?: (coords: { lat: number; lng: number }) => void;
  className?: string;
  defaultLat?: number;
  defaultLng?: number;
  userLat?: number;
  userLon?: number;
}

// St. John's, Newfoundland & Labrador downtown default coordinates
export const ST_JOHNS_DEFAULT = {
  lat: 47.5615,
  lng: -52.7126,
};

export function LiveMap({
  listings,
  onClaimListing,
  onLocationDetected,
  className = '',
  defaultLat,
  defaultLng,
  userLat,
  userLon,
}: LiveMapProps) {
  const effectiveDefaultLat = defaultLat ?? userLat ?? ST_JOHNS_DEFAULT.lat;
  const effectiveDefaultLng = defaultLng ?? userLon ?? ST_JOHNS_DEFAULT.lng;
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  // Persistent map of marker instances by listing ID to avoid re-mounting and disappearing popups
  const markersMapRef = useRef<Map<string, L.Marker>>(new Map());

  // Geolocation states
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationState, setLocationState] = useState<'requesting' | 'granted' | 'denied' | 'fallback'>('requesting');
  const [locationError, setLocationError] = useState<string | null>(null);

  // Helper to calculate distance in km using Haversine formula (matches PostGIS get_nearby_surplus)
  const calculateDistanceKm = useCallback((lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
  }, []);

  // Request browser geolocation with St. John's fallback
  const requestLiveLocation = useCallback(() => {
    setLocationState('requesting');
    setLocationError(null);

    if (!('geolocation' in navigator)) {
      setLocationState('fallback');
      setLocationError("Geolocation is not supported by your browser. Defaulted to Downtown St. John's.");
      const fallback = { lat: effectiveDefaultLat, lng: effectiveDefaultLng };
      setUserLocation(fallback);
      if (onLocationDetected) onLocationDetected(fallback);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        setLocationState('granted');
        if (onLocationDetected) onLocationDetected(coords);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([coords.lat, coords.lng], 15, {
            duration: 1.2,
          });
        }
      },
      (error) => {
        let errorMsg = 'Location permission denied.';
        if (error.code === error.TIMEOUT) errorMsg = 'Location request timed out.';
        if (error.code === error.POSITION_UNAVAILABLE) errorMsg = 'Location unavailable.';

        setLocationState('denied');
        setLocationError(`${errorMsg} Defaulted to Downtown St. John's, NL.`);
        
        // St. John's fallback
        const fallback = { lat: effectiveDefaultLat, lng: effectiveDefaultLng };
        setUserLocation(fallback);
        if (onLocationDetected) onLocationDetected(fallback);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([effectiveDefaultLat, effectiveDefaultLng], 14, {
            duration: 1,
          });
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  }, [effectiveDefaultLat, effectiveDefaultLng, onLocationDetected]);

  // Request location on mount
  useEffect(() => {
    requestLiveLocation();
  }, [requestLiveLocation]);

  // Initialize Leaflet Map (100% Free OpenStreetMap with Dark Mode CSS Filter)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = userLocation?.lat || effectiveDefaultLat;
      const initialLng = userLocation?.lng || effectiveDefaultLng;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap 100% Free Dark Map (No API Keys or Watermarks)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: 'map-tiles',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;
    }

    return () => {
      // Map instance persists across renders
    };
  }, [effectiveDefaultLat, effectiveDefaultLng]);

  // Update User Marker & 15km PostGIS Ring
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentCoords = userLocation || { lat: effectiveDefaultLat, lng: effectiveDefaultLng };

    // Update User Marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([currentCoords.lat, currentCoords.lng]);
    } else {
      const userIcon = L.divIcon({
        className: 'user-pulse-marker',
        html: `
          <div class="relative flex items-center justify-center">
            <span class="absolute w-8 h-8 rounded-full bg-blue-500/30 animate-ping"></span>
            <span class="relative w-4 h-4 rounded-full bg-blue-500 border-2 border-white shadow-lg"></span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([currentCoords.lat, currentCoords.lng], {
        icon: userIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      marker.bindPopup(
        `<div class="p-2 text-xs font-mono font-bold text-zinc-900">
          📍 You are here ${locationState === 'granted' ? '(Live GPS)' : "(St. John's Downtown)"}
         </div>`,
        { className: 'user-location-popup' }
      );

      userMarkerRef.current = marker;
    }

    // Update 15km PostGIS Radius Circle (15,000 meters)
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setLatLng([currentCoords.lat, currentCoords.lng]);
    } else {
      const circle = L.circle([currentCoords.lat, currentCoords.lng], {
        radius: 15000,
        color: '#f59e0b',
        fillColor: '#f59e0b',
        fillOpacity: 0.04,
        weight: 1.5,
        dashArray: '4, 8',
      }).addTo(map);
      radiusCircleRef.current = circle;
    }
  }, [userLocation, effectiveDefaultLat, effectiveDefaultLng, locationState]);

  // Update Surplus Restaurant Pins without tearing down active popups
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    const userCenter = userLocation || { lat: effectiveDefaultLat, lng: effectiveDefaultLng };
    const activeListings = listings.filter((l) => l.status === 'active');
    const activeListingIds = new Set(activeListings.map((l) => l.id));

    // Remove markers that are no longer active
    markersMapRef.current.forEach((marker, id) => {
      if (!activeListingIds.has(id)) {
        markersGroup.removeLayer(marker);
        markersMapRef.current.delete(id);
      }
    });

    activeListings.forEach((listing) => {
      const lat = listing.merchant?.latitude ?? 47.5624;
      const lon = listing.merchant?.longitude ?? -52.7096;

      const remainingSecs = Math.max(
        0,
        Math.floor((new Date(listing.pickup_cutoff).getTime() - Date.now()) / 1000)
      );
      const remainingMinutes = Math.floor(remainingSecs / 60);
      const isUrgent = remainingMinutes <= 15;

      // Calculate distance relative to current user coordinates (15km radius)
      const distanceKm = calculateDistanceKm(userCenter.lat, userCenter.lng, lat, lon);

      // Only display listings within 15km radius (per get_nearby_surplus)
      if (distanceKm > 15.0) {
        if (markersMapRef.current.has(listing.id)) {
          const m = markersMapRef.current.get(listing.id)!;
          markersGroup.removeLayer(m);
          markersMapRef.current.delete(listing.id);
        }
        return;
      }

      const priceDollars = (listing.discounted_price_cents / 100).toFixed(2);
      const originalDollars = (listing.original_price_cents / 100).toFixed(2);
      const discountPercent = Math.round(
        ((listing.original_price_cents - listing.discounted_price_cents) / listing.original_price_cents) * 100
      );

      // Custom HTML marker badge
      const markerHtml = `
        <div class="relative group cursor-pointer transition-transform duration-200 hover:scale-110">
          ${
            isUrgent
              ? '<span class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 animate-ping"></span>'
              : ''
          }
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-black shadow-xl border ${
            isUrgent
              ? 'bg-rose-950/95 text-rose-300 border-rose-500/80 shadow-rose-900/50'
              : 'bg-zinc-950/95 text-amber-400 border-amber-500/80 shadow-amber-950/50'
          } backdrop-blur-md whitespace-nowrap">
            <span class="text-emerald-400 font-bold">$${priceDollars}</span>
            <span class="text-[10px] text-zinc-400">·</span>
            <span class="text-[11px] ${isUrgent ? 'text-rose-400' : 'text-zinc-300'}">${remainingMinutes}m</span>
          </div>
          <div class="w-2 h-2 bg-zinc-950 rotate-45 border-r border-b border-amber-500/80 mx-auto -mt-1 shadow-md"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'surplus-price-pin',
        html: markerHtml,
        iconSize: [88, 34],
        iconAnchor: [44, 34],
        popupAnchor: [0, -32],
      });

      // Custom Interactive Popup DOM
      const popupHtml = document.createElement('div');
      popupHtml.className = 'w-64 p-3 bg-zinc-950 text-zinc-100 rounded-2xl font-sans';
      popupHtml.innerHTML = `
        <div class="relative h-28 w-full rounded-xl overflow-hidden mb-2.5 bg-zinc-900">
          <img src="${listing.photo_url}" alt="${listing.title}" class="w-full h-full object-cover" />
          <div class="absolute top-1.5 left-1.5 bg-amber-500 text-zinc-950 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
            ${discountPercent}% OFF
          </div>
          <div class="absolute top-1.5 right-1.5 bg-black/70 backdrop-blur text-amber-300 text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
            <span>⏱️</span> ${remainingMinutes}m left
          </div>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between text-[11px] text-zinc-400">
            <span class="font-bold text-zinc-300 truncate max-w-[140px]">
              ${listing.merchant?.business_name || "St. John's Kitchen"}
            </span>
            <span class="font-mono text-amber-400">${distanceKm} km</span>
          </div>

          <h4 class="text-xs font-extrabold text-zinc-100 line-clamp-1 leading-snug">
            ${listing.title}
          </h4>
          
          <p class="text-[10px] text-zinc-400 line-clamp-1">
            ${listing.merchant?.address || "Water St, St. John's, NL"}
          </p>

          <div class="flex items-center justify-between pt-2 border-t border-zinc-800">
            <div>
              <span class="text-[9px] text-zinc-500 block uppercase font-mono">Bite Price</span>
              <div class="flex items-baseline gap-1">
                <span class="text-sm font-black text-emerald-400 font-mono">$${priceDollars}</span>
                <span class="text-[10px] text-zinc-500 line-through font-mono">$${originalDollars}</span>
              </div>
            </div>
            
            <button 
              id="claim-btn-${listing.id}"
              class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition-transform active:scale-95 shadow-md flex items-center gap-1 cursor-pointer"
            >
              <span>Claim</span> ⚡
            </button>
          </div>
        </div>
      `;

      // Wire Claim Button inside Leaflet Popup DOM
      const claimBtn = popupHtml.querySelector(`#claim-btn-${listing.id}`);
      if (claimBtn) {
        claimBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          onClaimListing(listing);
          map.closePopup();
        });
      }

      if (markersMapRef.current.has(listing.id)) {
        // Update existing marker to preserve open popup
        const existingMarker = markersMapRef.current.get(listing.id)!;
        existingMarker.setLatLng([lat, lon]);
        existingMarker.setIcon(customIcon);
        existingMarker.setPopupContent(popupHtml);
      } else {
        // Create new marker with stopPropagation to prevent instant popup closure
        const marker = L.marker([lat, lon], { icon: customIcon });

        marker.bindPopup(popupHtml, {
          maxWidth: 280,
          className: 'custom-leaflet-popup',
          autoClose: true,
          closeOnClick: true,
        });

        // FIX: Ensure click does not bubble up to MapContainer and immediately close the popup
        marker.on('click', (e: L.LeafletMouseEvent) => {
          if (e.originalEvent) {
            e.originalEvent.stopPropagation();
          }
          marker.openPopup();
        });

        marker.addTo(markersGroup);
        markersMapRef.current.set(listing.id, marker);
      }
    });
  }, [listings, userLocation, effectiveDefaultLat, effectiveDefaultLng, calculateDistanceKm, onClaimListing]);

  // Center on user position
  const handleRecenterUser = () => {
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 0.8 });
    } else {
      requestLiveLocation();
    }
  };

  // Center on Downtown St. John's
  const handleCenterStJohns = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([effectiveDefaultLat, effectiveDefaultLng], 15, { duration: 0.8 });
    }
  };

  return (
    <div className={`relative w-full h-[520px] rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl bg-zinc-950 ${className}`}>
      {/* Geolocation Status Ticker Banner */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto z-[400] flex flex-wrap items-center gap-2">
        <div className="bg-zinc-950/90 backdrop-blur-md border border-zinc-800 px-3 py-1.5 rounded-2xl shadow-xl flex items-center gap-2">
          {locationState === 'requesting' ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-[11px] font-medium text-zinc-300">Requesting device GPS...</span>
            </>
          ) : locationState === 'granted' ? (
            <>
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-medium text-zinc-200">
                Live GPS Active: <strong className="text-emerald-400 font-mono">{userLocation?.lat.toFixed(3)}, {userLocation?.lng.toFixed(3)}</strong>
              </span>
            </>
          ) : (
            <>
              <Compass className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-medium text-zinc-300">
                Center: <strong className="text-amber-400">Downtown St. John's, NL</strong>
              </span>
            </>
          )}

          <span className="text-zinc-600 text-xs">|</span>

          {/* 15km PostGIS Radial Filter Indicator */}
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
            PostGIS 15km Radius Active
          </span>
        </div>

        {/* Retry Geolocation Button if denied or fallback */}
        {locationState !== 'granted' && (
          <button
            type="button"
            onClick={requestLiveLocation}
            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-2.5 py-1.5 rounded-2xl text-[11px] shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
            title="Request browser location access"
          >
            <Navigation className="w-3 h-3" />
            <span>Use My Location</span>
          </button>
        )}
      </div>

      {/* Top-Right Quick Map Controls */}
      <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5 bg-zinc-950/90 backdrop-blur-md p-1 rounded-2xl border border-zinc-800 shadow-xl">
        <button
          type="button"
          onClick={handleCenterStJohns}
          className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-zinc-300 hover:text-amber-400 hover:bg-zinc-800/80 transition-colors flex items-center gap-1 cursor-pointer"
          title="Center on Downtown St. John's, NL"
        >
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">St. John's</span>
        </button>

        <button
          type="button"
          onClick={handleRecenterUser}
          className="p-1.5 rounded-xl text-zinc-400 hover:text-blue-400 hover:bg-zinc-800/80 transition-colors cursor-pointer"
          title="Recenter on your location"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Leaflet Map Div Container with OpenStreetMap Dark styling */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Bottom Map Info Footer */}
      <div className="absolute bottom-3 left-3 z-[400] hidden sm:flex items-center gap-2 bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 px-3 py-1.5 rounded-2xl text-[11px] text-zinc-400 font-mono shadow-xl">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-zinc-200">Surplus Food Rescue Active</span>
        </div>
        <span>·</span>
        <span>St. John's, NL Live Feed</span>
      </div>
    </div>
  );
}

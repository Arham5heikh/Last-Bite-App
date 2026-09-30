import { useEffect, useState } from 'react';
import { ST_JOHNS_CENTER } from '@/src/lib/data/stJohns';

export interface UserLocation {
  lat: number;
  lng: number;
  /** true when coordinates came from the device, false when using the St. John's default */
  isLive: boolean;
}

/**
 * Uses the device's live location when the browser grants access,
 * otherwise falls back to Downtown St. John's, NL.
 */
export function useUserLocation(): UserLocation {
  const [location, setLocation] = useState<UserLocation>({ ...ST_JOHNS_CENTER, isLive: false });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          isLive: true,
        });
      },
      () => {
        // Permission denied / unavailable / timeout: keep the St. John's default
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  return location;
}

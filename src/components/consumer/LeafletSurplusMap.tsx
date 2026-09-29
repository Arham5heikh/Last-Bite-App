/**
 * LeafletSurplusMap.tsx
 * Exports the live Leaflet map with browser geolocation and St. John's, NL downtown fallback.
 */

import React from 'react';
import { LiveMap, LiveMapProps } from './LiveMap';

export { LiveMap, type LiveMapProps };

export function LeafletSurplusMap(props: LiveMapProps) {
  return <LiveMap {...props} />;
}

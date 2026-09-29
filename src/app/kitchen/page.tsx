'use client';

import React, { useState } from 'react';
import { useRealtimeStore } from '@/src/lib/store/realtimeStore';
import { TerminalAuthWrapper } from '@/src/components/kitchen/TerminalAuthWrapper';
import { PresetCatalogListing } from '@/src/components/kitchen/PresetCatalogListing';
import { TerminalRedemption } from '@/src/components/kitchen/TerminalRedemption';

export default function KitchenPage() {
  const { listings, orders } = useRealtimeStore();
  const [kitchenTab, setKitchenTab] = useState<'catalog' | 'verify'>('catalog');

  return (
    <TerminalAuthWrapper
      activeSubTab={kitchenTab}
      onSubTabChange={setKitchenTab}
      renderContent={(restaurant) => (
        <div className="w-full">
          {kitchenTab === 'catalog' ? (
            <PresetCatalogListing 
              activeListings={listings} 
              merchantId={restaurant.id}
            />
          ) : (
            <TerminalRedemption 
              orders={orders} 
              merchantId={restaurant.id}
            />
          )}
        </div>
      )}
    />
  );
}

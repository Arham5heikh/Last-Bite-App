'use client';

import React from 'react';
import { useRealtimeStore } from '@/src/lib/store/realtimeStore';
import { LiveFeed } from '@/src/components/consumer/LiveFeed';
import { CheckoutModal } from '@/src/components/consumer/CheckoutModal';
import { PickupPassModal } from '@/src/components/consumer/PickupPassModal';
import type { Listing, Order } from '@/src/lib/types/database';

export default function ConsumerPage() {
  const { listings, orders } = useRealtimeStore();
  const [selectedListing, setSelectedListing] = React.useState<Listing | null>(null);
  const [activePassOrder, setActivePassOrder] = React.useState<Order | null>(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 lg:p-8">
      <LiveFeed
        listings={listings}
        onClaimListing={(item) => setSelectedListing(item)}
      />

      <CheckoutModal
        listing={selectedListing}
        isOpen={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        onSuccess={(order) => {
          setActivePassOrder(order);
        }}
      />

      <PickupPassModal
        order={activePassOrder}
        isOpen={!!activePassOrder}
        onClose={() => setActivePassOrder(null)}
      />
    </div>
  );
}

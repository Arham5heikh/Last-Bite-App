import React from 'react';
import type { Listing } from '@/src/lib/types/database';
import { CustomSurplusModal } from '@/src/components/kitchen/CustomSurplusModal';

export interface QuickPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (listing: Listing) => void;
  initialMerchantId?: string;
}

export function QuickPostModal({
  isOpen,
  onClose,
  onSuccess,
  initialMerchantId,
}: QuickPostModalProps) {
  return (
    <CustomSurplusModal
      isOpen={isOpen}
      onClose={onClose}
      onSuccess={onSuccess}
      initialMerchantId={initialMerchantId}
    />
  );
}

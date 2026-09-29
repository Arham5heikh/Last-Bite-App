/**
 * Next.js 15 Server Actions: Checkout & Redemption Handshake
 * Module 2: Stripe Connect & Zero-Ghost Atomic Reservations
 */

'use server';

import type { Order, ReservationResult } from '@/src/lib/types/database';

export interface PickupVerificationResult {
  success: boolean;
  order?: Order;
  payout_released_cents?: number;
  error?: string;
}

/**
 * Server Action: initiateReservation
 * 1. Executes atomic locking RPC (preventing race condition oversells).
 * 2. Prepares Stripe PaymentIntent with Stripe Connect destination charge:
 *    - total amount = listing.discounted_price_cents
 *    - application_fee_amount = platform_fee_cents (e.g. 10%, min 50c)
 *    - transfer_data.destination = merchant.stripe_account_id
 * 3. Starts the 7-minute (420 seconds) hold timer.
 */
export async function initiateReservation(
  listingId: string,
  consumerId: string = 'usr_consumer_primary',
  merchantStripeId?: string
): Promise<ReservationResult> {
  try {
    if (!listingId) {
      return {
        success: false,
        hold_seconds: 0,
        error: 'Missing listingId parameter.',
      };
    }

    // In a live Supabase environment:
    // const { data, error } = await supabase.rpc('reserve_and_lock_listing', {
    //   p_listing_id: listingId,
    //   p_user_id: consumerId,
    //   p_hold_seconds: 420
    // });
    
    // Guaranteed 30-Minute Grace Period Logic:
    // When a consumer claims an item, ensure their active pickup window is guaranteed
    // to be at least 30 minutes from the time of checkout, even if the merchant's cutoff was shorter.
    const now = new Date();
    const minGraceSeconds = 30 * 60; // 30 minutes (1800 seconds)
    const reservedUntil = new Date(now.getTime() + minGraceSeconds * 1000).toISOString();
    const dynamicPin = Math.floor(1000 + Math.random() * 9000).toString();
    const qrToken = `lb_qr_${listingId.slice(-6)}_${dynamicPin}_${Date.now().toString(36)}`;
    const orderId = `ord_${Math.random().toString(36).substring(2, 10)}`;

    // Simulated Stripe Connect PaymentIntent client secret:
    // pi_3Nxxx_secret_xxx with destination charge to merchant
    const mockClientSecret = `pi_test_${orderId}_secret_${Math.random().toString(36).slice(2, 12)}`;

    return {
      success: true,
      order_id: orderId,
      listing_id: listingId,
      pickup_pin: dynamicPin,
      qr_token: qrToken,
      reserved_until: reservedUntil,
      client_secret: mockClientSecret,
      hold_seconds: minGraceSeconds,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Reservation failed';
    return {
      success: false,
      hold_seconds: 0,
      error: message,
    };
  }
}

/**
 * Server Action: verifyAndCompletePickup
 * The Redemption Handshake:
 * 1. Front-of-house or kitchen inputs 4-digit PIN or scans QR token.
 * 2. Compares against encrypted/stored pickup_pin and checks status.
 * 3. Captures the authorized Stripe PaymentIntent.
 * 4. Releases the direct payout to the merchant's connected bank account.
 * 5. Updates order status to 'completed' with completed_at timestamp.
 */
export async function verifyAndCompletePickup(
  orderId: string,
  submittedPin: string,
  currentOrder: Order
): Promise<PickupVerificationResult> {
  try {
    if (!orderId || !submittedPin) {
      return { success: false, error: 'Order ID and 4-digit PIN are required.' };
    }

    // Check if order exists
    if (!currentOrder || currentOrder.id !== orderId) {
      return { success: false, error: 'Order not found in merchant register.' };
    }

    // Check if already completed
    if (currentOrder.status === 'completed') {
      return {
        success: false,
        error: `Order was already redeemed at ${new Date(currentOrder.completed_at || '').toLocaleTimeString()}.`,
      };
    }

    // Check if marked as no-show penalized
    if (currentOrder.status === 'no_show_penalized') {
      return {
        success: false,
        error: 'Order was marked as No-Show. A 50% penalty fee was charged to compensate the kitchen.',
      };
    }

    // Check if expired
    if (currentOrder.status === 'expired') {
      return {
        success: false,
        error: 'This reservation has expired and inventory was returned to market.',
      };
    }

    // Validate 4-digit PIN / QR Token match
    const cleanPin = submittedPin.trim();
    const isPinMatch = cleanPin === currentOrder.pickup_pin;
    const isQrMatch = cleanPin === currentOrder.qr_token || cleanPin.endsWith(currentOrder.pickup_pin);

    if (!isPinMatch && !isQrMatch) {
      return {
        success: false,
        error: 'Invalid 4-digit PIN. Please ask customer to show their active Last Bite pass.',
      };
    }

    // Stripe Capture & Transfer execution (Production pattern):
    // await stripe.paymentIntents.capture(currentOrder.stripe_payment_intent_id);
    // await stripe.transfers.create({
    //   amount: currentOrder.merchant_payout_cents,
    //   currency: 'usd',
    //   destination: currentOrder.merchant?.stripe_account_id,
    //   source_transaction: currentOrder.stripe_payment_intent_id,
    // });

    const completedOrder: Order = {
      ...currentOrder,
      status: 'completed',
      completed_at: new Date().toISOString(),
    };

    return {
      success: true,
      order: completedOrder,
      payout_released_cents: currentOrder.merchant_payout_cents,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Redemption verification failed';
    return { success: false, error: message };
  }
}

/** Checkout use case. Business rules live below the controller boundary. */
export { createCheckout, mergeItems } from '@/lib/checkout/service';
export type { CheckoutDeps, OrderStore, ReservedOrder } from '@/lib/checkout/service';

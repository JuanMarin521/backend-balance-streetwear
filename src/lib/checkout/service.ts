import { ApiError } from '../domain/errors';
import { MAX_QTY_PER_LINE, type CheckoutRequest } from '../domain/schemas';
import type { PaymentProvider } from '../payments/types';

export interface ReservedOrder { orderId: string; reference: string; totalCop: number }

/** Persistence port. The Supabase implementation performs everything in one DB transaction. */
export interface OrderStore {
  releaseExpired(): Promise<void>;
  reserve(input: {
    items: { variantId: string; quantity: number }[];
    customer: Record<string, unknown>;
    userId: string | null;
    shippingCop: number;
  }): Promise<ReservedOrder>;
  release(orderId: string, status: 'failed' | 'cancelled'): Promise<void>;
}

export interface CheckoutDeps {
  store: OrderStore;
  provider: PaymentProvider;
  shippingCop: number;
  siteUrl: string;
  resultPath: string;
}

/** Merges duplicate variant lines and enforces the per-line cap. */
export function mergeItems(items: CheckoutRequest['items']) {
  const map = new Map<string, number>();
  for (const { variantId, quantity } of items) {
    map.set(variantId, (map.get(variantId) ?? 0) + quantity);
  }
  return [...map].map(([variantId, quantity]) => {
    if (quantity > MAX_QTY_PER_LINE) {
      throw new ApiError(422, 'quantity_exceeded', `Max ${MAX_QTY_PER_LINE} units per item`, { variantId });
    }
    return { variantId, quantity };
  });
}

/**
 * Prices and stock never come from the client: the store reads current values
 * and reserves stock transactionally.
 */
export async function createCheckout(
  request: CheckoutRequest,
  userId: string | null,
  deps: CheckoutDeps,
) {
  const items = mergeItems(request.items);
  await deps.store.releaseExpired().catch((e) => console.warn('[checkout] expiry sweep failed', e));

  const order = await deps.store.reserve({
    items,
    customer: { ...request.customer, shippingAddress: request.shippingAddress },
    userId,
    shippingCop: deps.shippingCop,
  });

  try {
    const redirectUrl = new URL(deps.resultPath, deps.siteUrl).toString();
    const { checkoutUrl } = await deps.provider.createCheckout({
      reference: order.reference,
      amountCop: order.totalCop,
      customerEmail: request.customer.email,
      redirectUrl,
    });
    return { orderId: order.orderId, reference: order.reference, totalCop: order.totalCop, currency: 'COP', checkoutUrl };
  } catch (err) {
    await deps.store.release(order.orderId, 'failed').catch((e) => console.error('[checkout] release failed', e));
    if (err instanceof ApiError) throw err;
    console.error('[checkout] provider error', err);
    throw new ApiError(502, 'payment_provider_error', 'Could not start the payment session');
  }
}

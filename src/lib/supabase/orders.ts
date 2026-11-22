import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderStore } from '../checkout/service';
import { ApiError } from '../domain/errors';
import type { OrderStatus } from '../domain/schemas';
import { canAdminTransition } from '../orders/transitions';
import type { VerifiedPaymentEvent } from '../payments/types';

export function createOrderStore(db: SupabaseClient): OrderStore {
  return {
    async releaseExpired() {
      const { error } = await db.rpc('release_expired_reservations');
      if (error) throw error;
    },
    async reserve({ items, customer, userId, shippingCop }) {
      const { data, error } = await db.rpc('create_order_with_reservation', {
        p_items: items,
        p_customer: customer,
        p_user_id: userId,
        p_shipping_cop: shippingCop,
      });
      if (error) {
        if (error.message === 'INSUFFICIENT_STOCK') {
          throw new ApiError(409, 'insufficient_stock', 'Not enough stock for one of the items', { variantId: error.details });
        }
        if (error.message === 'VARIANT_UNAVAILABLE') {
          throw new ApiError(422, 'variant_unavailable', 'One of the items is no longer available', { variantId: error.details });
        }
        throw error;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return { orderId: row.order_id, reference: row.reference, totalCop: row.total_cop };
    },
    async release(orderId, status) {
      const { error } = await db.rpc('release_order', { p_order_id: orderId, p_new_status: status });
      if (error) throw error;
    },
  };
}

export async function applyPaymentEvent(db: SupabaseClient, provider: string, e: VerifiedPaymentEvent): Promise<string> {
  const { data, error } = await db.rpc('apply_payment_event', {
    p_provider: provider,
    p_event_id: e.eventId,
    p_reference: e.reference,
    p_status: e.status,
    p_amount_cop: e.amountCop,
    p_transaction_id: e.transactionId,
    p_payload: e.raw,
  });
  if (error) throw error;
  return data as string;
}

export async function listOrders(db: SupabaseClient, q: { id?: string; status?: OrderStatus; limit: number; offset: number }) {
  let query = db
    .from('orders')
    .select('*, order_items(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);
  if (q.id) query = query.eq('id', q.id);
  if (q.status) query = query.eq('status', q.status);
  const { data, count, error } = await query;
  if (error) throw error;
  return { orders: data ?? [], total: count ?? 0 };
}

export async function transitionOrder(
  db: SupabaseClient,
  input: { orderId: string; status: 'shipped' | 'delivered' | 'cancelled'; trackingNumber?: string },
) {
  const { data: current, error } = await db.from('orders').select('id, status').eq('id', input.orderId).maybeSingle();
  if (error) throw error;
  if (!current) throw new ApiError(404, 'order_not_found', 'Order not found');
  if (!canAdminTransition(current.status, input.status)) {
    throw new ApiError(409, 'invalid_transition', `Cannot move order from ${current.status} to ${input.status}`);
  }

  if (input.status === 'cancelled') {
    const { data: released, error: rErr } = await db.rpc('release_order', {
      p_order_id: input.orderId, p_new_status: 'cancelled',
    });
    if (rErr) throw rErr;
    if (!released) throw new ApiError(409, 'invalid_transition', 'Order changed state; reload and retry');
  } else {
    const patch: Record<string, unknown> = { status: input.status };
    if (input.trackingNumber) patch.tracking_number = input.trackingNumber;
    // Optimistic guard: only applies if the status is still what we validated.
    const { data: updated, error: uErr } = await db
      .from('orders').update(patch).eq('id', input.orderId).eq('status', current.status).select('id').maybeSingle();
    if (uErr) throw uErr;
    if (!updated) throw new ApiError(409, 'invalid_transition', 'Order changed state; reload and retry');
  }
  const { orders } = await listOrders(db, { id: input.orderId, limit: 1, offset: 0 });
  return orders[0];
}

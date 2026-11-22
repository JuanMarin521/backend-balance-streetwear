import type { OrderStatus } from '../domain/schemas';

/** Manual (admin) transitions. Payment-driven transitions happen in the webhook. */
const ADMIN_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ['cancelled'],
  payment_review: ['cancelled'],
  paid: ['shipped'],
  shipped: ['delivered'],
};

export function canAdminTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_TRANSITIONS[from]?.includes(to) ?? false;
}

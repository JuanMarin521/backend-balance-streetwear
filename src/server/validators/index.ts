/** Request contracts. Keep validation at the HTTP boundary. */
export {
  adminCreateProductSchema,
  adminInventoryQuerySchema,
  adminOrdersQuerySchema,
  adminUpdateOrderSchema,
  adminUpdateVariantSchema,
  checkoutRequestSchema,
  inventoryQuerySchema,
  MAX_QTY_PER_LINE,
  ORDER_STATUSES,
} from '@/lib/domain/schemas';
export type { CheckoutRequest, OrderStatus } from '@/lib/domain/schemas';

/** Pure helpers that are safe to reuse across HTTP and application layers. */
export { publicAvailability, LOW_STOCK_THRESHOLD, PUBLIC_STOCK_CAP } from '@/lib/domain/inventory';
export { canAdminTransition } from '@/lib/orders/transitions';

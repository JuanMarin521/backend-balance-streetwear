/**
 * Persistence adapters. Controllers and services depend on these adapters,
 * never on Supabase SDK calls directly.
 */
export {
  createProduct,
  getPublicAvailability,
  listAdminInventory,
  updateVariant,
} from '@/lib/supabase/inventory';
export {
  applyPaymentEvent,
  createOrderStore,
  listOrders,
  transitionOrder,
} from '@/lib/supabase/orders';
export { getServiceClient } from '@/lib/supabase/server';
export { getOptionalUser, requireAdmin } from '@/lib/supabase/auth';

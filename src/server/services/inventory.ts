import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createProduct as persistProduct,
  getPublicAvailability as readPublicAvailability,
  listAdminInventory as readAdminInventory,
  updateVariant as persistVariant,
} from '@/server/repositories';
import type { z } from 'zod';
import type { adminCreateProductSchema, adminUpdateVariantSchema } from '@/server/validators';

export function getPublicInventory(db: SupabaseClient, variantIds: string[]) {
  return readPublicAvailability(db, variantIds);
}

export function listInventory(
  db: SupabaseClient,
  query: { productId?: string; limit: number; offset: number },
) {
  return readAdminInventory(db, query);
}

export function createInventoryProduct(
  db: SupabaseClient,
  input: z.infer<typeof adminCreateProductSchema>,
) {
  return persistProduct(db, input);
}

export function updateInventoryVariant(
  db: SupabaseClient,
  input: z.infer<typeof adminUpdateVariantSchema>,
) {
  return persistVariant(db, input);
}

import { handle, json, parseJsonBody, parseQuery } from '@/server/middlewares/http';
import {
  adminCreateProductSchema,
  adminInventoryQuerySchema,
  adminUpdateVariantSchema,
} from '@/server/validators';
import { requireAdmin } from '@/server/repositories';
import {
  createInventoryProduct,
  listInventory,
  updateInventoryVariant,
} from '@/server/services/inventory';
import { getServiceClient } from '@/server/repositories';

export const prerender = false;
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = handle(async ({ request, url }) => {
  const db = getServiceClient();
  await requireAdmin(request, db);
  return json(await listInventory(db, parseQuery(url, adminInventoryQuerySchema)), 200, NO_STORE);
});

export const POST = handle(async ({ request }) => {
  const db = getServiceClient();
  await requireAdmin(request, db);
  const body = await parseJsonBody(request, adminCreateProductSchema);
  return json(await createInventoryProduct(db, body), 201, NO_STORE);
});

export const PATCH = handle(async ({ request }) => {
  const db = getServiceClient();
  await requireAdmin(request, db);
  const body = await parseJsonBody(request, adminUpdateVariantSchema);
  return json({ variant: await updateInventoryVariant(db, body) }, 200, NO_STORE);
});

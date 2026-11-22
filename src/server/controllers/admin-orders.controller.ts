import { handle, json, parseJsonBody, parseQuery } from '@/server/middlewares/http';
import { adminOrdersQuerySchema, adminUpdateOrderSchema } from '@/server/validators';
import { requireAdmin, getServiceClient } from '@/server/repositories';
import { listOrders, transitionOrder } from '@/server/services/orders';

export const prerender = false;
const NO_STORE = { 'cache-control': 'no-store' };

export const GET = handle(async ({ request, url }) => {
  const db = getServiceClient();
  await requireAdmin(request, db);
  return json(await listOrders(db, parseQuery(url, adminOrdersQuerySchema)), 200, NO_STORE);
});

export const PATCH = handle(async ({ request }) => {
  const db = getServiceClient();
  await requireAdmin(request, db);
  const body = await parseJsonBody(request, adminUpdateOrderSchema);
  return json({ order: await transitionOrder(db, body) }, 200, NO_STORE);
});

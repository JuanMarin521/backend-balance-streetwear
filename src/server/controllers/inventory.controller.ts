import { handle, json, parseQuery } from '@/server/middlewares/http';
import { inventoryQuerySchema } from '@/server/validators';
import { getPublicInventory } from '@/server/services/inventory';
import { getServiceClient } from '@/server/repositories';

export const prerender = false;

export const GET = handle(async ({ url }) => {
  const { variantIds } = parseQuery(url, inventoryQuerySchema);
  const availability = await getPublicInventory(getServiceClient(), variantIds);
  return json({ availability }, 200, {
    'cache-control': 'public, max-age=15, stale-while-revalidate=30',
  });
});

import { handle, json, parseJsonBody } from '@/server/middlewares/http';
import { checkoutRequestSchema } from '@/server/validators';
import { createCheckout } from '@/server/services/checkout';
import { getServerEnv } from '@/server/config/env';
import { getPaymentProvider } from '@/lib/payments';
import { getOptionalUser } from '@/server/repositories';
import { createOrderStore, getServiceClient } from '@/server/repositories';

export const prerender = false;

export const POST = handle(async ({ request }) => {
  const env = getServerEnv();
  const body = await parseJsonBody(request, checkoutRequestSchema);
  const db = getServiceClient();
  const user = await getOptionalUser(request, db);

  const result = await createCheckout(body, user?.id ?? null, {
    store: createOrderStore(db),
    provider: getPaymentProvider(env),
    shippingCop: env.SHIPPING_FLAT_COP,
    siteUrl: env.PUBLIC_SITE_URL,
    resultPath: env.CHECKOUT_RESULT_PATH,
  });
  return json(result, 201, { 'cache-control': 'no-store' });
});

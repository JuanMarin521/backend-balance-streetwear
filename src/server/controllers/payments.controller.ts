import { ApiError } from '@/server/exceptions';
import { handle, json, readBody } from '@/server/middlewares/http';
import { getServerEnv } from '@/server/config/env';
import { getPaymentProvider } from '@/lib/payments';
import { WebhookVerificationError } from '@/lib/payments/types';
import { applyPaymentEvent } from '@/server/services/orders';
import { getServiceClient } from '@/server/repositories';

export const prerender = false;

export const POST = handle(async ({ request }) => {
  const provider = getPaymentProvider(getServerEnv());
  const raw = await readBody(request, 256_000);

  let event;
  try {
    event = provider.verifyWebhook(raw, request.headers);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      throw new ApiError(401, 'invalid_signature', 'Webhook verification failed');
    }
    throw err;
  }
  if (!event) return json({ received: true, ignored: true });

  const outcome = await applyPaymentEvent(getServiceClient(), provider.name, event);
  return json({ received: true, outcome });
});

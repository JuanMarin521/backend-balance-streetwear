import { ApiError } from '../domain/errors';
import type { ServerEnv } from '../env';
import type { PaymentProvider } from './types';
import { WompiProvider } from './wompi';

export function getPaymentProvider(env: ServerEnv): PaymentProvider {
  switch (env.PAYMENT_PROVIDER) {
    case 'wompi':
      if (!env.PAYMENT_PUBLIC_KEY) {
        throw new ApiError(500, 'server_misconfigured', 'Payment provider is not configured');
      }
      return new WompiProvider({
        publicKey: env.PAYMENT_PUBLIC_KEY,
        integritySecret: env.PAYMENT_SECRET_KEY,
        eventsSecret: env.PAYMENT_WEBHOOK_SECRET,
      });
    default:
      throw new ApiError(501, 'provider_not_implemented', `Provider "${env.PAYMENT_PROVIDER}" is not implemented yet`);
  }
}

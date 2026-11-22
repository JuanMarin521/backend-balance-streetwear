import { z } from 'zod';
import { ApiError } from './domain/errors';

const serverEnvSchema = z.object({
  PUBLIC_SITE_URL: z.string().url(),
  PUBLIC_SUPABASE_URL: z.string().url(),
  PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  PAYMENT_PROVIDER: z.enum(['stripe', 'wompi', 'mercadopago']),
  PAYMENT_PUBLIC_KEY: z.string().optional(),
  PAYMENT_SECRET_KEY: z.string().min(1),
  PAYMENT_WEBHOOK_SECRET: z.string().min(1),
  SHIPPING_FLAT_COP: z.coerce.number().int().min(0).default(0),
  CHECKOUT_RESULT_PATH: z.string().startsWith('/').default('/checkout/result'),
});
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Names only; never echo values.
    const names = Object.keys(result.error.flatten().fieldErrors).join(', ');
    console.error(`[env] invalid or missing server configuration: ${names}`);
    throw new ApiError(500, 'server_misconfigured', 'Server is not configured correctly');
  }
  return result.data;
}

let cached: ServerEnv | undefined;
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv({
    ...(import.meta.env as Record<string, string | undefined>),
    ...process.env,
  });
  return cached;
}

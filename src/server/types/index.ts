/** Shared server contracts; framework-specific request types stay in controllers. */
export type { AuthUser } from '@/lib/supabase/auth';
export type {
  CheckoutParams,
  PaymentProvider,
  PaymentStatus,
  VerifiedPaymentEvent,
} from '@/lib/payments/types';
export type { OrderStatus } from '@/lib/domain/schemas';

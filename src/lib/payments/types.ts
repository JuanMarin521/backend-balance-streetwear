export type PaymentStatus = 'approved' | 'declined' | 'voided' | 'error' | 'pending';

export interface CheckoutParams {
  reference: string;
  amountCop: number;
  customerEmail: string;
  redirectUrl: string;
}

export interface VerifiedPaymentEvent {
  /** Stable, unique per provider state change; used for idempotency. */
  eventId: string;
  reference: string;
  status: PaymentStatus;
  amountCop: number;
  transactionId: string;
  raw: unknown;
}

export class WebhookVerificationError extends Error {}

export interface PaymentProvider {
  readonly name: string;
  createCheckout(params: CheckoutParams): Promise<{ checkoutUrl: string }>;
  /** Returns null for verified-but-irrelevant events. Throws WebhookVerificationError on bad signature. */
  verifyWebhook(rawBody: string, headers: Headers): VerifiedPaymentEvent | null;
}

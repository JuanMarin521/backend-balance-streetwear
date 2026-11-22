import { createHash, timingSafeEqual } from 'node:crypto';
import {
  WebhookVerificationError,
  type CheckoutParams,
  type PaymentProvider,
  type PaymentStatus,
  type VerifiedPaymentEvent,
} from './types';

export interface WompiConfig {
  publicKey: string;
  integritySecret: string;
  eventsSecret: string;
  checkoutBaseUrl?: string;
}

const STATUS_MAP: Record<string, PaymentStatus> = {
  APPROVED: 'approved',
  DECLINED: 'declined',
  VOIDED: 'voided',
  ERROR: 'error',
  PENDING: 'pending',
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    obj,
  );
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a.toLowerCase());
  const bb = Buffer.from(b.toLowerCase());
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export class WompiProvider implements PaymentProvider {
  readonly name = 'wompi';
  constructor(private readonly cfg: WompiConfig) {}

  async createCheckout(p: CheckoutParams) {
    const currency = 'COP';
    const cents = p.amountCop * 100;
    const integrity = sha256(`${p.reference}${cents}${currency}${this.cfg.integritySecret}`);
    const url = new URL(this.cfg.checkoutBaseUrl ?? 'https://checkout.wompi.co/p/');
    url.searchParams.set('public-key', this.cfg.publicKey);
    url.searchParams.set('currency', currency);
    url.searchParams.set('amount-in-cents', String(cents));
    url.searchParams.set('reference', p.reference);
    url.searchParams.set('signature:integrity', integrity);
    url.searchParams.set('redirect-url', p.redirectUrl);
    url.searchParams.set('customer-data:email', p.customerEmail);
    return { checkoutUrl: url.toString() };
  }

  verifyWebhook(rawBody: string, _headers: Headers): VerifiedPaymentEvent | null {
    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw new WebhookVerificationError('Malformed webhook body');
    }
    const props = event?.signature?.properties;
    const checksum = event?.signature?.checksum;
    if (!Array.isArray(props) || typeof checksum !== 'string' || event?.timestamp === undefined) {
      throw new WebhookVerificationError('Missing signature fields');
    }
    const concat = props.map((path: string) => String(lookup(event.data, path) ?? '')).join('');
    const expected = sha256(`${concat}${event.timestamp}${this.cfg.eventsSecret}`);
    if (!safeEqualHex(expected, checksum)) {
      throw new WebhookVerificationError('Invalid webhook signature');
    }

    if (event.event !== 'transaction.updated') return null;
    const tx = event.data?.transaction;
    const status = STATUS_MAP[String(tx?.status)];
    if (!tx || !status || typeof tx.reference !== 'string' || typeof tx.amount_in_cents !== 'number') {
      throw new WebhookVerificationError('Unexpected transaction payload');
    }
    return {
      eventId: `${tx.id}:${tx.status}`,
      reference: tx.reference,
      status,
      amountCop: tx.amount_in_cents / 100,
      transactionId: String(tx.id),
      raw: event,
    };
  }
}

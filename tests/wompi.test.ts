import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WebhookVerificationError } from '@/lib/payments/types';
import { WompiProvider } from '@/lib/payments/wompi';

const cfg = { publicKey: 'pub_test_x', integritySecret: 'integ', eventsSecret: 'events' };
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

function signedEvent(overrides: Partial<{ status: string; amount: number; secret: string; type: string }> = {}) {
  const tx = { id: 'tx-1', status: overrides.status ?? 'APPROVED', amount_in_cents: overrides.amount ?? 15000000, reference: 'BAL-ABC', currency: 'COP' };
  const timestamp = 1700000000;
  const checksum = sha(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${overrides.secret ?? cfg.eventsSecret}`);
  return JSON.stringify({
    event: overrides.type ?? 'transaction.updated',
    data: { transaction: tx },
    timestamp,
    signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum },
  });
}

describe('WompiProvider', () => {
  const provider = new WompiProvider(cfg);

  it('builds a checkout URL with a valid integrity signature', async () => {
    const { checkoutUrl } = await provider.createCheckout({
      reference: 'BAL-ABC', amountCop: 150000, customerEmail: 'a@b.co', redirectUrl: 'https://x.co/r',
    });
    const u = new URL(checkoutUrl);
    expect(u.searchParams.get('amount-in-cents')).toBe('15000000');
    expect(u.searchParams.get('signature:integrity')).toBe(sha('BAL-ABC15000000COPinteg'));
    expect(u.searchParams.get('public-key')).toBe('pub_test_x');
  });

  it('accepts a correctly signed event', () => {
    const e = provider.verifyWebhook(signedEvent(), new Headers());
    expect(e).toMatchObject({ reference: 'BAL-ABC', status: 'approved', amountCop: 150000, eventId: 'tx-1:APPROVED' });
  });

  it('rejects a bad signature', () => {
    expect(() => provider.verifyWebhook(signedEvent({ secret: 'wrong' }), new Headers())).toThrow(WebhookVerificationError);
  });

  it('rejects tampered amounts', () => {
    const body = JSON.parse(signedEvent());
    body.data.transaction.amount_in_cents = 1;
    expect(() => provider.verifyWebhook(JSON.stringify(body), new Headers())).toThrow(WebhookVerificationError);
  });

  it('rejects malformed bodies', () => {
    expect(() => provider.verifyWebhook('not json', new Headers())).toThrow(WebhookVerificationError);
  });

  it('ignores verified events of other types', () => {
    expect(provider.verifyWebhook(signedEvent({ type: 'nequi_token.updated' }), new Headers())).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { createCheckout, mergeItems, type CheckoutDeps } from '@/lib/checkout/service';
import { ApiError } from '@/lib/domain/errors';
import { checkoutRequestSchema } from '@/lib/domain/schemas';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';

const request = checkoutRequestSchema.parse({
  items: [{ variantId: V1, quantity: 2 }, { variantId: V1, quantity: 1 }, { variantId: V2, quantity: 1 }],
  customer: { email: 'cliente@example.com', fullName: 'Ana Pérez', phone: '+57 300 123 4567' },
  shippingAddress: { line1: 'Calle 10 # 20-30', city: 'Medellín', department: 'Antioquia' },
  price: 1, // client-supplied price must be ignored
});

function deps(overrides: Partial<CheckoutDeps> = {}) {
  const store = {
    releaseExpired: vi.fn().mockResolvedValue(undefined),
    reserve: vi.fn().mockResolvedValue({ orderId: 'o1', reference: 'BAL-1', totalCop: 300000 }),
    release: vi.fn().mockResolvedValue(undefined),
  };
  const provider = {
    name: 'fake',
    createCheckout: vi.fn().mockResolvedValue({ checkoutUrl: 'https://pay.example/c/1' }),
    verifyWebhook: vi.fn(),
  };
  const d: CheckoutDeps = { store, provider, shippingCop: 12000, siteUrl: 'https://balancestreetwear.com', resultPath: '/checkout/result', ...overrides };
  return { d, store, provider };
}

describe('mergeItems', () => {
  it('merges duplicate variants', () => {
    expect(mergeItems(request.items)).toEqual([{ variantId: V1, quantity: 3 }, { variantId: V2, quantity: 1 }]);
  });
  it('rejects merged quantities over the cap', () => {
    expect(() => mergeItems([{ variantId: V1, quantity: 8 }, { variantId: V1, quantity: 8 }])).toThrow(ApiError);
  });
});

describe('createCheckout', () => {
  it('reserves stock server-side and returns the provider URL', async () => {
    const { d, store, provider } = deps();
    const res = await createCheckout(request, 'user-1', d);
    expect(store.reserve).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', shippingCop: 12000,
      items: [{ variantId: V1, quantity: 3 }, { variantId: V2, quantity: 1 }],
    }));
    expect(JSON.stringify(store.reserve.mock.calls[0])).not.toContain('"price"');
    expect(provider.createCheckout).toHaveBeenCalledWith(expect.objectContaining({
      reference: 'BAL-1', amountCop: 300000, redirectUrl: 'https://balancestreetwear.com/checkout/result',
    }));
    expect(res).toMatchObject({ orderId: 'o1', checkoutUrl: 'https://pay.example/c/1', currency: 'COP' });
  });

  it('releases the reservation when the provider fails', async () => {
    const { d, store, provider } = deps();
    provider.createCheckout.mockRejectedValue(new Error('boom'));
    await expect(createCheckout(request, null, d)).rejects.toMatchObject({ status: 502, code: 'payment_provider_error' });
    expect(store.release).toHaveBeenCalledWith('o1', 'failed');
  });

  it('propagates stock errors without calling the provider', async () => {
    const { d, store, provider } = deps();
    store.reserve.mockRejectedValue(new ApiError(409, 'insufficient_stock', 'x'));
    await expect(createCheckout(request, null, d)).rejects.toMatchObject({ status: 409 });
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it('still proceeds if the expiry sweep fails', async () => {
    const { d, store } = deps();
    store.releaseExpired.mockRejectedValue(new Error('sweep'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(createCheckout(request, null, d)).resolves.toBeDefined();
  });
});

describe('checkoutRequestSchema', () => {
  it('rejects empty carts, bad emails and non-CO countries', () => {
    const base = { customer: request.customer, shippingAddress: request.shippingAddress };
    expect(checkoutRequestSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...base, items: request.items, customer: { ...request.customer, email: 'nope' } }).success).toBe(false);
    expect(checkoutRequestSchema.safeParse({ ...base, items: request.items, shippingAddress: { ...request.shippingAddress, country: 'US' } }).success).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/domain/errors';
import { errorResponse, parseJsonBody } from '@/lib/domain/http';
import { publicAvailability } from '@/lib/domain/inventory';
import { adminUpdateVariantSchema, inventoryQuerySchema } from '@/lib/domain/schemas';
import { parseServerEnv } from '@/lib/env';
import { canAdminTransition } from '@/lib/orders/transitions';
import { z } from 'zod';

describe('publicAvailability', () => {
  it('caps quantities and never exposes exact stock', () => {
    expect(publicAvailability(500, 0)).toEqual({ status: 'in_stock', maxQuantity: 10 });
  });
  it('reports low and out of stock, accounting for reservations', () => {
    expect(publicAvailability(5, 3)).toEqual({ status: 'low_stock', maxQuantity: 2 });
    expect(publicAvailability(5, 5)).toEqual({ status: 'out_of_stock', maxQuantity: 0 });
    expect(publicAvailability(5, 0, false)).toEqual({ status: 'out_of_stock', maxQuantity: 0 });
  });
});

describe('canAdminTransition', () => {
  it('allows only the defined manual transitions', () => {
    expect(canAdminTransition('paid', 'shipped')).toBe(true);
    expect(canAdminTransition('shipped', 'delivered')).toBe(true);
    expect(canAdminTransition('pending', 'cancelled')).toBe(true);
    expect(canAdminTransition('paid', 'delivered')).toBe(false);
    expect(canAdminTransition('delivered', 'cancelled')).toBe(false);
    expect(canAdminTransition('paid', 'cancelled')).toBe(false);
  });
});

describe('http helpers', () => {
  it('returns stable error shapes', async () => {
    const api = errorResponse(new ApiError(409, 'conflict', 'nope', { a: 1 }));
    expect(api.status).toBe(409);
    expect(await api.json()).toEqual({ error: { code: 'conflict', message: 'nope', details: { a: 1 } } });

    const zod = errorResponse(z.object({ a: z.string() }).safeParse({}).error);
    expect(zod.status).toBe(422);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    const unknown = errorResponse(new Error('secret db detail'));
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(await unknown.json())).not.toContain('secret');
  });

  it('requires JSON content-type and valid JSON', async () => {
    const schema = z.object({ a: z.number() });
    const mk = (body: string, ct = 'application/json') =>
      new Request('http://x/y', { method: 'POST', body, headers: { 'content-type': ct } });
    await expect(parseJsonBody(mk('{"a":1}', 'text/plain'), schema)).rejects.toMatchObject({ status: 415 });
    await expect(parseJsonBody(mk('{bad'), schema)).rejects.toMatchObject({ status: 400 });
    await expect(parseJsonBody(mk('{"a":1}'), schema)).resolves.toEqual({ a: 1 });
  });
});

describe('schemas', () => {
  it('parses comma-separated variant ids', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(inventoryQuerySchema.parse({ variantIds: `${id}, ${id}` }).variantIds).toHaveLength(2);
    expect(inventoryQuerySchema.safeParse({ variantIds: 'abc' }).success).toBe(false);
  });
  it('requires at least one variant field to update', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(adminUpdateVariantSchema.safeParse({ variantId: id }).success).toBe(false);
    expect(adminUpdateVariantSchema.safeParse({ variantId: id, stockOnHand: 4 }).success).toBe(true);
  });
});

describe('parseServerEnv', () => {
  it('fails without leaking values', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: 'super-secret' })).toThrow(ApiError);
    expect(JSON.stringify(spy.mock.calls)).not.toContain('super-secret');
  });
});

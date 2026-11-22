import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../domain/errors';
import { publicAvailability } from '../domain/inventory';
import type { z } from 'zod';
import type { adminCreateProductSchema, adminUpdateVariantSchema } from '../domain/schemas';
import { mapDbError } from './errors';

export async function getPublicAvailability(db: SupabaseClient, variantIds: string[]) {
  const { data, error } = await db
    .from('product_variants')
    .select('id, stock_on_hand, stock_reserved, is_active, products!inner(is_active)')
    .in('id', variantIds);
  if (error) throw error;
  const found = new Map<string, ReturnType<typeof publicAvailability>>();
  for (const v of data ?? []) {
    const productActive = (v as any).products?.is_active ?? false;
    found.set(v.id, publicAvailability(v.stock_on_hand, v.stock_reserved, v.is_active && productActive));
  }
  return variantIds.map((variantId) => ({
    variantId,
    ...(found.get(variantId) ?? { status: 'out_of_stock' as const, maxQuantity: 0 }),
  }));
}

export async function listAdminInventory(
  db: SupabaseClient,
  q: { productId?: string; limit: number; offset: number },
) {
  let query = db
    .from('product_variants')
    .select(
      'id, sku, size, design, color, price_cop, stock_on_hand, stock_reserved, is_active, products!inner(id, slug, name, is_active)',
      { count: 'exact' },
    )
    .order('sku')
    .range(q.offset, q.offset + q.limit - 1);
  if (q.productId) query = query.eq('product_id', q.productId);
  const { data, count, error } = await query;
  if (error) throw error;
  return { variants: data ?? [], total: count ?? 0 };
}

export async function createProduct(db: SupabaseClient, input: z.infer<typeof adminCreateProductSchema>) {
  const { product, variants } = input;
  const { data: category, error: cErr } = await db
    .from('categories').select('id').eq('slug', product.categorySlug).maybeSingle();
  if (cErr) throw cErr;
  if (!category) throw new ApiError(422, 'invalid_category', 'Unknown category');

  const { data: created, error: pErr } = await db
    .from('products')
    .insert({
      slug: product.slug,
      name: product.name,
      description: product.description ?? null,
      category_id: category.id,
      gender: product.gender,
      showroom_slot: product.showroomSlot ?? null,
      image_urls: product.imageUrls,
    })
    .select('id')
    .single();
  if (pErr) mapDbError(pErr);

  const { error: vErr } = await db.from('product_variants').insert(
    variants.map((v) => ({
      product_id: created!.id,
      sku: v.sku,
      size: v.size,
      design: v.design,
      color: v.color ?? null,
      price_cop: v.priceCop,
      stock_on_hand: v.stockOnHand,
    })),
  );
  if (vErr) {
    // Compensate: do not leave a product without its variants.
    await db.from('products').delete().eq('id', created!.id);
    mapDbError(vErr);
  }
  return listAdminInventory(db, { productId: created!.id, limit: 100, offset: 0 });
}

export async function updateVariant(db: SupabaseClient, input: z.infer<typeof adminUpdateVariantSchema>) {
  const patch: Record<string, unknown> = {};
  if (input.stockOnHand !== undefined) patch.stock_on_hand = input.stockOnHand;
  if (input.priceCop !== undefined) patch.price_cop = input.priceCop;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await db
    .from('product_variants')
    .update(patch)
    .eq('id', input.variantId)
    .select('id, sku, size, design, color, price_cop, stock_on_hand, stock_reserved, is_active')
    .maybeSingle();
  if (error) mapDbError(error);
  if (!data) throw new ApiError(404, 'variant_not_found', 'Variant not found');
  return data;
}

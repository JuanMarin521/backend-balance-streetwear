import { z } from 'zod';

export const MAX_QTY_PER_LINE = 10;

export const checkoutRequestSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().min(1).max(MAX_QTY_PER_LINE),
      }),
    )
    .min(1)
    .max(20),
  customer: z.object({
    email: z.string().trim().email().max(254),
    fullName: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^\+?[\d\s-]{7,20}$/, 'Invalid phone number'),
  }),
  shippingAddress: z.object({
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().min(2).max(100),
    department: z.string().trim().min(2).max(100),
    postalCode: z.string().trim().max(20).optional(),
    country: z.literal('CO').default('CO'),
  }),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const inventoryQuerySchema = z.object({
  variantIds: z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(z.string().uuid()).min(1).max(100)),
});

const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
};

export const adminInventoryQuerySchema = z.object({
  productId: z.string().uuid().optional(),
  ...pagination,
});

export const adminCreateProductSchema = z.object({
  product: z.object({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(120),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(4000).optional(),
    categorySlug: z.enum(['pants', 'hoodies', 't-shirts', 'sets']),
    gender: z.enum(['male', 'female', 'unisex']),
    showroomSlot: z.enum(['top', 'bottom', 'full']).optional(),
    imageUrls: z.array(z.string().url()).max(12).default([]),
  }),
  variants: z
    .array(
      z.object({
        sku: z.string().trim().min(2).max(64),
        size: z.string().trim().min(1).max(16),
        design: z.string().trim().min(1).max(80).default('default'),
        color: z.string().trim().max(40).optional(),
        priceCop: z.number().int().positive().max(100_000_000),
        stockOnHand: z.number().int().min(0).max(100_000).default(0),
      }),
    )
    .min(1)
    .max(100),
});

export const adminUpdateVariantSchema = z
  .object({
    variantId: z.string().uuid(),
    stockOnHand: z.number().int().min(0).max(100_000).optional(),
    priceCop: z.number().int().positive().max(100_000_000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (v) => v.stockOnHand !== undefined || v.priceCop !== undefined || v.isActive !== undefined,
    { message: 'At least one field to update is required' },
  );

export const ORDER_STATUSES = [
  'pending', 'paid', 'shipped', 'delivered', 'cancelled', 'failed', 'payment_review',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const adminOrdersQuerySchema = z.object({
  id: z.string().uuid().optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  ...pagination,
});

export const adminUpdateOrderSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['shipped', 'delivered', 'cancelled']),
  trackingNumber: z.string().trim().min(3).max(64).optional(),
});

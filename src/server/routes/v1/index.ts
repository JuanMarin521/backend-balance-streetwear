/**
 * Versioned route registry. Astro still maps URL paths from src/pages/api;
 * these exports are the stable server route boundary used by those adapters.
 */
export * as checkoutSession from './checkout-session';
export * as inventory from './inventory';
export * as adminInventory from './admin-inventory';
export * as adminOrders from './admin-orders';
export * as paymentsWebhook from './payments-webhook';

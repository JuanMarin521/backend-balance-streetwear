export const PUBLIC_STOCK_CAP = 10;
export const LOW_STOCK_THRESHOLD = 3;

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

/** Customer-safe availability: never reveals exact stock above the cap. */
export function publicAvailability(onHand: number, reserved: number, isActive = true) {
  const available = isActive ? Math.max(0, onHand - reserved) : 0;
  const status: StockStatus =
    available === 0 ? 'out_of_stock' : available <= LOW_STOCK_THRESHOLD ? 'low_stock' : 'in_stock';
  return { status, maxQuantity: Math.min(available, PUBLIC_STOCK_CAP) };
}

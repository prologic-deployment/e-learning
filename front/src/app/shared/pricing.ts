/**
 * Course pricing for display — mirrors back/src/utils/pricing.js.
 * The server always recomputes prices at checkout; this is only for showing
 * "new price / old price" consistently across the site.
 */
export interface PriceView {
  price: number;          // regular price
  finalPrice: number;     // price after promotion (before vouchers)
  onSale: boolean;
  discountPercent: number;
  saleEndsAt: string | null;
  free: boolean;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function isOnSale(course: any, now = new Date()): boolean {
  if (!course) return false;
  const price = Number(course.price) || 0;
  const sale = course.salePrice;
  if (sale === null || sale === undefined || price <= 0) return false;
  if (Number(sale) < 0 || Number(sale) >= price) return false;
  if (course.saleEndsAt && new Date(course.saleEndsAt) <= now) return false;
  return true;
}

export function priceView(course: any): PriceView {
  const price = round2(course?.price);
  const onSale = isOnSale(course);
  const finalPrice = onSale ? round2(course.salePrice) : price;
  return {
    price,
    finalPrice,
    onSale,
    discountPercent: onSale && price > 0 ? Math.round((1 - finalPrice / price) * 100) : 0,
    saleEndsAt: onSale ? course.saleEndsAt || null : null,
    free: price <= 0
  };
}

/** "12.5" → "12.50 TND", integers stay short: "60 TND" */
export function formatTnd(n: number): string {
  const v = round2(n);
  return (Number.isInteger(v) ? String(v) : v.toFixed(2)) + ' TND';
}

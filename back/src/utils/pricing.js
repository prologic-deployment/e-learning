/**
 * Course pricing rules — the single source of truth on the server.
 * (front/src/app/shared/pricing.ts mirrors them for display only.)
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** A promotion applies when a sale price below the regular price is set and not expired */
function isOnSale(course, now = new Date()) {
  if (!course) return false;
  const price = Number(course.price) || 0;
  const sale = course.salePrice;
  if (sale === null || sale === undefined || price <= 0) return false;
  if (Number(sale) < 0 || Number(sale) >= price) return false;
  if (course.saleEndsAt && new Date(course.saleEndsAt) <= now) return false;
  return true;
}

/** Price the learner pays before any voucher */
function effectivePrice(course, now = new Date()) {
  return round2(isOnSale(course, now) ? course.salePrice : course.price);
}

/** Display block sent to clients */
function priceInfo(course, now = new Date()) {
  const onSale = isOnSale(course, now);
  const price = round2(course.price);
  const finalPrice = effectivePrice(course, now);
  return {
    price,
    finalPrice,
    onSale,
    discountPercent: onSale && price > 0 ? Math.round((1 - finalPrice / price) * 100) : 0,
    saleEndsAt: onSale ? course.saleEndsAt || null : null
  };
}

module.exports = { round2, isOnSale, effectivePrice, priceInfo };

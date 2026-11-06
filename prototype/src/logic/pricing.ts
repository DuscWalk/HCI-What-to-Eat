import type { Coupon, Dish, Listing, Platform, Shop } from '../types';

export interface OrderLine {
  dish: Dish;
  qty: number;
}

/** 一个购物车在某个平台上的报价。 */
export interface Quote {
  platform: Platform;
  /** 该平台不卖的菜（报价不完整，不参与比最低价） */
  missing: Dish[];
  dish: number;
  pack: number;
  delivery: number;
  /** 店铺满减 */
  shopOff: number;
  /** 用上的平台券 */
  coupon?: Coupon;
  couponOff: number;
  total: number;
  deliveryMin: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function yuan(n: number) {
  return `¥${Number.isInteger(n) ? n : n.toFixed(1)}`;
}

export const listingOf = (shop: Shop, platform: Platform) => shop.listings.find((l) => l.platform === platform);

/**
 * 实付 = 菜品小计 + 包装费 + 配送费 − 店铺满减 − 该平台可用的最优一张券。
 * 店铺满减按「菜品 + 包装」判断门槛，平台券按满减后的金额判断门槛。
 */
export function quoteListing(listing: Listing, lines: OrderLine[], coupons: Coupon[]): Quote {
  const missing = lines.filter((l) => listing.prices[l.dish.id] === undefined).map((l) => l.dish);
  const dish = round1(lines.reduce((sum, l) => sum + (listing.prices[l.dish.id] ?? 0) * l.qty, 0));
  const pack = dish > 0 ? listing.packFee : 0;
  const subtotal = dish + pack;
  const shopOff = listing.discounts.filter((d) => subtotal >= d.threshold).reduce((best, d) => Math.max(best, d.off), 0);
  const afterShop = subtotal - shopOff;
  const coupon = coupons
    .filter((c) => c.platform === listing.platform && dish > 0 && afterShop >= c.threshold)
    .sort((a, b) => b.off - a.off)[0];
  const couponOff = coupon ? Math.min(coupon.off, afterShop) : 0;
  return {
    platform: listing.platform,
    missing,
    dish,
    pack,
    delivery: listing.deliveryFee,
    shopOff,
    coupon,
    couponOff,
    total: round1(Math.max(0, afterShop + listing.deliveryFee - couponOff)),
    deliveryMin: listing.deliveryMin,
  };
}

/** 各平台的报价（顺序与店铺上架顺序一致）。 */
export function quoteAll(shop: Shop, lines: OrderLine[], coupons: Coupon[]): Quote[] {
  return shop.listings.map((l) => quoteListing(l, lines, coupons));
}

/** 最低价：只在菜都能买到的平台里比。 */
export function cheapest(quotes: Quote[]): Quote | undefined {
  return quotes.filter((q) => q.missing.length === 0 && q.dish > 0).sort((a, b) => a.total - b.total)[0];
}

/** 单点这道菜时，各平台中最低的实付。 */
export function bestSingle(shop: Shop, dish: Dish, coupons: Coupon[]): Quote | undefined {
  return cheapest(quoteAll(shop, [{ dish, qty: 1 }], coupons));
}

export const fastestMin = (shop: Shop) => Math.min(...shop.listings.map((l) => l.deliveryMin));
export const lowestDeliveryFee = (shop: Shop) => Math.min(...shop.listings.map((l) => l.deliveryFee));

export function cheapestDishTotal(shop: Shop, coupons: Coupon[]) {
  const totals = shop.dishes.map((d) => bestSingle(shop, d, coupons)?.total ?? Infinity);
  return Math.min(...totals);
}

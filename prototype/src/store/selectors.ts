import { useMemo } from 'react';
import { summarizeHistory, type ShopHistory } from '../logic/history';
import { resolveLines } from '../logic/order';
import { cheapest, quoteAll, type Quote } from '../logic/pricing';
import type { Cart, Coupon, Shop } from '../types';
import { useData } from './data';
import { useStore } from './store';

const EMPTY = new Map<string, ShopHistory>();
const NO_COUPONS: Coupon[] = [];

/** 推荐与首页使用的历史；用户关闭「使用历史记录」授权时为空（N5）。 */
export function useHistoryStats() {
  const { orders } = useData();
  const { state } = useStore();
  const { useHistory } = state.settings;
  return useMemo(
    () => (useHistory ? summarizeHistory(orders, state.events, state.edits) : EMPTY),
    [useHistory, orders, state.events, state.edits],
  );
}

/** 计算价格时可用的优惠券；用户关闭授权时不用券（N5）。 */
export function useCoupons() {
  const { coupons } = useData();
  const { state } = useStore();
  return state.settings.useCoupons ? coupons : NO_COUPONS;
}

export interface CartView {
  cart: Cart;
  shop: Shop;
  portions: number;
  quotes: Quote[];
  best?: Quote;
}

/** 各家店的购物车及其在每个平台上的报价。 */
export function useCartViews(): CartView[] {
  const { shopById } = useData();
  const { state } = useStore();
  const coupons = useCoupons();
  return useMemo(
    () =>
      state.carts.flatMap((cart) => {
        const shop = shopById.get(cart.shopId);
        if (!shop) return [];
        const quotes = quoteAll(shop, resolveLines(shop, cart.lines), coupons);
        return [
          {
            cart,
            shop,
            portions: cart.lines.reduce((sum, l) => sum + l.qty, 0),
            quotes,
            best: cheapest(quotes),
          },
        ];
      }),
    [state.carts, shopById, coupons],
  );
}

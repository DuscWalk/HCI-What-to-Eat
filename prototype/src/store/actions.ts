import { createContext, useContext } from 'react';
import type { MealSlot } from '../logic/meal';
import type { Platform } from '../types';

export interface Actions {
  meal: MealSlot;
  navigate: (path: string, options?: { replace?: boolean }) => void;
  back: () => void;

  /* 候选：跨店比较的「想吃」清单，开关式 */
  isCandidate: (dishId: string) => boolean;
  toggleCandidate: (shopId: string, dishId: string) => void;
  removeCandidate: (dishId: string) => void;
  restoreCandidate: (dishId: string) => void;
  clearCandidates: () => void;

  /* 购物车：每家店一个，有份数 */
  cartQty: (shopId: string, dishId: string) => number;
  cartAdd: (shopId: string, dishId: string) => void;
  cartDec: (shopId: string, dishId: string) => void;
  clearCart: (shopId: string) => void;
  /** 把候选放进那家店的购物车，并打开店铺页的购物车 */
  candidateToCart: (shopId: string, dishId: string) => void;
  /** 「再来一单」：放进购物车后直接去结算 */
  reorder: (shopId: string, dishId: string) => void;

  /** 打开 App 内的店铺页（浏览与点餐都在 App 内完成）；openCart 时展开购物车。 */
  goShop: (shopId: string, openCart?: boolean) => void;
  /** 打开某家店购物车的确认订单页；不指定平台时默认选最低价的平台。 */
  openCheckout: (shopId: string, platform?: Platform) => void;
  openRecommend: () => void;
}

export const ActionsContext = createContext<Actions | null>(null);

export function useActions() {
  const value = useContext(ActionsContext);
  if (!value) throw new Error('useActions must be used inside ActionsContext');
  return value;
}

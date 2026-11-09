import type { Avoid, Dish, Shop, Taste } from '../types';

export interface TastePrefs {
  likes: Taste[];
  avoids: Avoid[];
}

export const avoidedBy = (dish: Dish, prefs: TastePrefs) => dish.contains.filter((a) => prefs.avoids.includes(a));

const liked = (dish: Dish, prefs: TastePrefs) =>
  dish.tastes.some((t) => prefs.likes.includes(t)) && avoidedBy(dish, prefs).length === 0;

/**
 * 长期口味的权重。评分×销量的基础分在 11–19 之间，权重要大到让「菜大多合口味」的店排到前面，
 * 否则在个性化里选了「健康」，首页看不出变化。
 */
const TASTE_WEIGHT = 8;

/** 首页「综合」排序：评分与销量为基础，再按长期口味加权（白板：长期偏好作用于首页浏览）。 */
export function browseScore(shop: Shop, prefs: TastePrefs) {
  const base = shop.rating * Math.log10(shop.monthlySales);
  const fit = shop.dishes.filter((d) => liked(d, prefs)).length / shop.dishes.length;
  return base + fit * TASTE_WEIGHT;
}

/** 店内菜品顺序：符合长期口味的在前，含忌口的排到最后。 */
export function orderDishes(dishes: Dish[], prefs: TastePrefs) {
  const rank = (d: Dish) => (avoidedBy(d, prefs).length ? 2 : liked(d, prefs) ? 0 : 1);
  return [...dishes].sort((a, b) => rank(a) - rank(b));
}

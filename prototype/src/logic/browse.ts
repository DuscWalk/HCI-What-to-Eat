import type { Avoid, Dish, Shop, Taste } from '../types';

export interface TastePrefs {
  likes: Taste[];
  avoids: Avoid[];
}

export const avoidedBy = (dish: Dish, prefs: TastePrefs) => dish.contains.filter((a) => prefs.avoids.includes(a));

const liked = (dish: Dish, prefs: TastePrefs) =>
  dish.tastes.some((t) => prefs.likes.includes(t)) && avoidedBy(dish, prefs).length === 0;

/** 首页「综合」排序：评分与销量为基础，再按长期口味加权（白板：长期偏好作用于首页浏览）。 */
export function browseScore(shop: Shop, prefs: TastePrefs) {
  const base = shop.rating * Math.log10(shop.monthlySales);
  const fit = shop.dishes.filter((d) => liked(d, prefs)).length / shop.dishes.length;
  return base + fit * 2;
}

/** 店内菜品顺序：符合长期口味的在前，含忌口的排到最后。 */
export function orderDishes(dishes: Dish[], prefs: TastePrefs) {
  const rank = (d: Dish) => (avoidedBy(d, prefs).length ? 2 : liked(d, prefs) ? 0 : 1);
  return [...dishes].sort((a, b) => rank(a) - rank(b));
}

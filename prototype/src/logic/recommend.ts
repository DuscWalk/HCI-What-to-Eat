import type { Conditions, Coupon, Dish, Settings, Shop } from '../types';
import type { ShopHistory } from './history';
import { bestSingle, type Quote } from './pricing';

export type RecKind = 'again' | 'familiarNew' | 'reliableNew' | 'match';

export const KIND_LABEL: Partial<Record<RecKind, string>> = {
  again: '常点',
  familiarNew: '熟店新品',
  reliableNew: '口碑新店',
};

export interface RecItem {
  shop: Shop;
  dish: Dish;
  kind: RecKind;
  score: number;
  /** 单点这道菜时各平台中最低的含券实付 */
  price: Quote;
}

export interface RecInput {
  shops: Shop[];
  history: Map<string, ShopHistory>;
  settings: Settings;
  conditions: Conditions;
  coupons: Coupon[];
  count: number;
  excludeShopIds?: Set<string>;
}

/**
 * 首版规则推荐（PRD 第四节）：
 * 1. 预算（按各平台含券最低实付）、送达时间、忌口、本次口味做硬筛选；
 * 2. 本次口味计算匹配（未选时参考长期口味）；评分、销量降低尝新风险；
 * 3. 历史订单识别可靠复购；
 * 4. 组合：优先放复购，固定留一个低风险尝新位，每家店只出一道菜。
 */
export function recommend({ shops, history, settings, conditions, coupons, count, excludeShopIds }: RecInput): RecItem[] {
  const avoids = settings.useTastePrefs ? settings.avoids : [];
  // 弹窗以本次（短期）口味为准；本次没选口味时，才参考长期口味
  const likes = settings.useTastePrefs && conditions.tastes.length === 0 ? settings.likes : [];
  const pool: RecItem[] = [];

  for (const shop of shops) {
    if (excludeShopIds?.has(shop.id)) continue;

    const h = history.get(shop.id);
    const lowRated = h?.avgRating !== undefined && h.avgRating < 3.5;
    const reliable = Boolean(h) && h!.orderCount >= 2 && !lowRated;
    const familiar = Boolean(h) && !lowRated;

    for (const dish of shop.dishes) {
      const price = bestSingle(shop, dish, coupons);
      if (!price) continue;
      if (conditions.maxMinutes && price.deliveryMin > conditions.maxMinutes) continue;
      if (conditions.budget && price.total > conditions.budget) continue;
      if (dish.contains.some((a) => avoids.includes(a))) continue;
      const hits = conditions.tastes.filter((t) => dish.tastes.includes(t)).length;
      if (conditions.tastes.length && hits === 0) continue;

      const ordered = h?.orderedDishIds.has(dish.id) ?? false;
      const kind: RecKind =
        reliable && ordered
          ? 'again'
          : familiar && !ordered
            ? 'familiarNew'
            : !h && shop.rating >= 4.7 && shop.monthlySales >= 800
              ? 'reliableNew'
              : 'match';

      let score = hits * 3;
      score += likes.filter((t) => dish.tastes.includes(t)).length;
      score += (shop.rating - 4.5) * 4;
      score += Math.log10(dish.monthlySales + 1) * 0.6;
      if (kind === 'again') score += 2 + Math.min(h!.orderCount, 5) * 0.3;
      if (kind === 'familiarNew') score += 0.5;
      if (lowRated) score -= 3;

      pool.push({ shop, dish, kind, score, price });
    }
  }

  const byScore = (a: RecItem, b: RecItem) => b.score - a.score;
  const used = new Set<string>();
  const out: RecItem[] = [];
  const take = (list: RecItem[], slots: number) => {
    for (const item of list) {
      if (slots <= 0 || out.length >= count) break;
      if (used.has(item.shop.id)) continue;
      out.push(item);
      used.add(item.shop.id);
      slots -= 1;
    }
  };

  take(pool.filter((i) => i.kind === 'again').sort(byScore), count >= 4 ? 2 : 1);
  const trial = pool
    .filter((i) => (i.kind === 'familiarNew' || i.kind === 'reliableNew') && !used.has(i.shop.id))
    .sort(byScore)[0];
  if (trial) used.add(trial.shop.id);
  const rest = [...pool].sort(byScore);
  const restSlots = () => count - out.length - (trial ? 1 : 0);
  // 其余位置优先给非复购的选择，复购不够多样时才补位
  take(rest.filter((i) => i.kind !== 'again'), restSlots());
  take(rest, restSlots());
  if (trial) out.push(trial);
  return out;
}

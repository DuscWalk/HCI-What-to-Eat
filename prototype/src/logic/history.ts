import type { AppEvent, OrderRecord, RecordEdit } from '../types';

export interface ShopHistory {
  orderCount: number;
  orderedDishIds: Set<string>;
  avgRating?: number;
  lastAt: number;
}

/**
 * 推荐与首页「点过的店」使用的历史：平台订单 + App 内跳转下单。
 * 用户在记录页标记「不用于推荐」或删除的店不计入。
 */
export function summarizeHistory(
  orders: OrderRecord[],
  events: AppEvent[],
  edits: Record<string, RecordEdit>,
): Map<string, ShopHistory> {
  const all: OrderRecord[] = [
    ...orders,
    ...events
      .filter((e): e is AppEvent & { dishId: string } => e.type === 'chosen' && Boolean(e.dishId))
      .map((e) => ({ shopId: e.shopId, dishId: e.dishId, at: e.at })),
  ];
  const map = new Map<string, ShopHistory & { ratings: number[] }>();
  for (const o of all) {
    const edit = edits[o.shopId];
    if (edit?.excluded || edit?.deleted) continue;
    const h = map.get(o.shopId) ?? { orderCount: 0, orderedDishIds: new Set(), ratings: [], lastAt: 0 };
    h.orderCount += 1;
    h.orderedDishIds.add(o.dishId);
    if (o.myRating) h.ratings.push(o.myRating);
    h.lastAt = Math.max(h.lastAt, o.at);
    map.set(o.shopId, h);
  }
  const out = new Map<string, ShopHistory>();
  for (const [id, { ratings, ...h }] of map) {
    out.set(id, {
      ...h,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
    });
  }
  return out;
}

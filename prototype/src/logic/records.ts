import type { AppEvent, OrderRecord, RecordEdit, RecordReason, Shop } from '../types';

export type RecordStatus = 'chosen' | 'candidate' | 'ordered';

export const STATUS_LABEL: Record<RecordStatus, string> = {
  chosen: '最终选定',
  candidate: '进入候选未选',
  ordered: '曾点过',
};

export const REASON_LABEL: Record<RecordReason, string> = {
  love: '就是爱吃',
  rush: '赶时间',
  deal: '有优惠',
  others: '帮别人点',
  settle: '随便凑合',
};

export interface ShopRecord {
  shop: Shop;
  status: RecordStatus;
  lastAt: number;
  orderCount: number;
  chosenCount: number;
  candidateCount: number;
  dishIds: string[];
  lastDishId?: string;
  edit: RecordEdit;
}

interface Touch {
  at: number;
  dishId?: string;
}

/** 记录页以「店」为主体，合并平台订单与 App 内行为。 */
export function buildRecords(
  shops: Map<string, Shop>,
  orders: OrderRecord[],
  events: AppEvent[],
  edits: Record<string, RecordEdit>,
): ShopRecord[] {
  const groups = new Map<string, { orders: Touch[]; chosen: Touch[]; candidate: Touch[] }>();
  const group = (id: string) => {
    let g = groups.get(id);
    if (!g) groups.set(id, (g = { orders: [], chosen: [], candidate: [] }));
    return g;
  };
  for (const o of orders) group(o.shopId).orders.push({ at: o.at, dishId: o.dishId });
  for (const e of events) group(e.shopId)[e.type].push({ at: e.at, dishId: e.dishId });

  const records: ShopRecord[] = [];
  for (const [shopId, g] of groups) {
    const shop = shops.get(shopId);
    if (!shop) continue;
    const touches = [...g.orders, ...g.chosen, ...g.candidate].sort((a, b) => b.at - a.at);
    const dishIds = [...new Set(touches.map((t) => t.dishId).filter((d): d is string => Boolean(d)))];
    records.push({
      shop,
      status: g.chosen.length ? 'chosen' : g.candidate.length ? 'candidate' : 'ordered',
      lastAt: touches[0]?.at ?? 0,
      orderCount: g.orders.length,
      chosenCount: g.chosen.length,
      candidateCount: g.candidate.length,
      dishIds: dishIds.slice(0, 3),
      lastDishId: dishIds[0],
      edit: edits[shopId] ?? {},
    });
  }
  return records.sort((a, b) => b.lastAt - a.lastAt);
}

export function relativeDay(at: number, now = Date.now()) {
  const start = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const days = Math.round((start(now) - start(at)) / 86_400_000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  const d = new Date(at);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

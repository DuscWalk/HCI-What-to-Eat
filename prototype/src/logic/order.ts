import type { CartLine, Dish, Shop } from '../types';
import type { OrderLine } from './pricing';

/** 订单内容放在地址里（如 benpao-1*2,benpao-3），付款后购物车清空也能还原这一单。 */
export function encodeLines(lines: CartLine[]) {
  return lines.map((l) => (l.qty > 1 ? `${l.dishId}*${l.qty}` : l.dishId)).join(',');
}

export function decodeLines(raw: string | undefined): CartLine[] {
  if (!raw) return [];
  return raw
    .split(',')
    .filter(Boolean)
    .map((part) => {
      const [dishId, qty] = part.split('*');
      return { dishId, qty: Math.max(1, Math.min(9, Number(qty) || 1)) };
    });
}

export function resolveLines(shop: Shop, refs: CartLine[]): OrderLine[] {
  const byId = new Map<string, Dish>(shop.dishes.map((d) => [d.id, d]));
  return refs.flatMap((r) => {
    const dish = byId.get(r.dishId);
    return dish ? [{ dish, qty: r.qty }] : [];
  });
}

export function arrivalTime(minutes: number, now = Date.now()) {
  const d = new Date(now + minutes * 60_000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

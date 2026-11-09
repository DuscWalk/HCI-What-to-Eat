import type { AppEvent, Coupon, RecordEdit, Shop } from '../types';
import { GENERATED_SHOPS } from './shops.generated';

/**
 * 店铺、菜品和各平台报价由 scripts/build_data.py 生成（来源见 prototype/README.md）。
 * 这个文件只放手写的部分：用户的优惠券、平台历史订单、记录页的初始记录。
 */
export const SHOPS: Shop[] = GENERATED_SHOPS;

/** 按店铺 id 和菜名找菜品 id；重新生成数据后菜名对不上时直接报错，免得演示数据悄悄失效。 */
function dishId(shopId: string, name: string) {
  const dish = SHOPS.find((s) => s.id === shopId)?.dishes.find((d) => d.name === name);
  if (!dish) throw new Error(`mockData：找不到 ${shopId} 的「${name}」，请检查 shops.generated.ts`);
  return dish.id;
}

/** 模拟的用户优惠券（各平台账户里的红包）。 */
export const COUPONS: Coupon[] = [
  { id: 'mt-20-3', platform: 'meituan', name: '美团红包', threshold: 20, off: 3 },
  { id: 'mt-35-6', platform: 'meituan', name: '美团红包', threshold: 35, off: 6 },
  { id: 'el-0-2', platform: 'eleme', name: '饿了么无门槛券', threshold: 0, off: 2 },
  { id: 'el-30-5', platform: 'eleme', name: '饿了么红包', threshold: 30, off: 5 },
];

export interface HistorySeed {
  dishId: string;
  daysAgo: number;
  hour: number;
  myRating?: number;
}

/** 模拟的平台历史订单（相对今天的天数）。 */
export const HISTORY_SEED: HistorySeed[] = [
  // 常点、评价好：推荐里出「常点」
  { dishId: dishId('benpao', '小炒黄牛肉饭'), daysAgo: 2, hour: 12, myRating: 5 },
  { dishId: dishId('benpao', '小炒黄牛肉饭'), daysAgo: 9, hour: 18 },
  { dishId: dishId('benpao', '四季豆肉丝饭'), daysAgo: 16, hour: 12, myRating: 5 },
  { dishId: dishId('benpao', '小炒黄牛肉饭'), daysAgo: 25, hour: 12 },
  { dishId: dishId('huajia', '花甲粉丝'), daysAgo: 5, hour: 12, myRating: 4 },
  { dishId: dishId('huajia', '花甲粉丝'), daysAgo: 19, hour: 18 },
  { dishId: dishId('fantuan', '鸡柳紫米饭团'), daysAgo: 4, hour: 8, myRating: 5 },
  { dishId: dishId('fantuan', '鸡柳紫米饭团'), daysAgo: 15, hour: 8 },
  { dishId: dishId('chuanwei', '麻婆豆腐饭'), daysAgo: 8, hour: 18, myRating: 4 },
  { dishId: dishId('chuanwei', '宫保鸡丁饭'), daysAgo: 22, hour: 19 },
  // 赶时间时点的：记录页标了「赶时间」、不用于推荐
  { dishId: dishId('huangmen', '微辣黄焖鸡米饭'), daysAgo: 3, hour: 13, myRating: 3 },
  { dishId: dishId('huangmen', '微辣黄焖鸡米饭'), daysAgo: 20, hour: 12 },
  // 前两天刚吃过炸鸡（拍摄脚本场景三）
  { dishId: dishId('kfc', '香辣鸡腿堡'), daysAgo: 2, hour: 19, myRating: 4 },
  // 吃过一次、评价差：不当作可靠复购
  { dishId: dishId('mcd', '经典麦辣鸡腿汉堡中薯套餐'), daysAgo: 10, hour: 21, myRating: 2 },
  { dishId: dishId('chabaidao', '杨枝甘露'), daysAgo: 6, hour: 15 },
  { dishId: dishId('shengjian', '招牌鲜肉生煎'), daysAgo: 27, hour: 8 },
];

/** 记录页一开始就有三类状态：最终选定、进入候选未选、曾点过。 */
export function demoEvents(now: number): AppEvent[] {
  const H = 3_600_000;
  return [
    { type: 'candidate', shopId: 'junsi', dishId: dishId('junsi', '腊味煲仔饭'), at: now - 74 * H },
    { type: 'candidate', shopId: 'huhutai', dishId: dishId('huhutai', '冬阴功炒饭'), at: now - 26 * H },
    { type: 'candidate', shopId: 'jintang', dishId: dishId('jintang', '竹荪马蹄椰子鸡炖汤'), at: now - 26 * H + 60_000 },
    { type: 'candidate', shopId: 'benpao', dishId: dishId('benpao', '小炒黄牛肉饭'), at: now - 26 * H + 120_000 },
    { type: 'chosen', shopId: 'benpao', dishId: dishId('benpao', '小炒黄牛肉饭'), platform: 'eleme', at: now - 26 * H + 300_000 },
  ];
}

/** 记录页的初始修正：黄焖鸡是赶时间时点的，不用于推荐。 */
export const DEMO_EDITS: Record<string, RecordEdit> = {
  huangmen: { reason: 'rush', excluded: true },
};

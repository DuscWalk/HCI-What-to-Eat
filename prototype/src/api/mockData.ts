import type { Avoid, Coupon, Discount, Dish, Listing, Platform, Shop, Taste } from '../types';

type DishSeed = [
  key: string,
  name: string,
  price: number,
  tastes: Taste[],
  contains: Avoid[],
  emoji: string,
  monthlySales: number,
  isNew?: boolean,
];

interface ListingSeed {
  platform: Platform;
  deliveryMin: number;
  deliveryFee: number;
  packFee: number;
  discounts: Discount[];
  /** 该平台菜价相对基准价的差额 */
  delta?: number;
  /** 该平台不卖的菜（菜品 key） */
  missing?: string[];
}

type ShopBase = Omit<Shop, 'dishes' | 'listings'>;

function shop(base: ShopBase, dishes: DishSeed[], listings: ListingSeed[]): Shop {
  const built: Listing[] = listings.map((l) => ({
    platform: l.platform,
    deliveryMin: l.deliveryMin,
    deliveryFee: l.deliveryFee,
    packFee: l.packFee,
    discounts: l.discounts,
    prices: Object.fromEntries(
      dishes
        .filter(([key]) => !l.missing?.includes(key))
        .map(([key, , price]) => [`${base.id}-${key}`, price + (l.delta ?? 0)]),
    ),
  }));
  const allDishes: Dish[] = dishes.map(([key, name, , tastes, contains, emoji, monthlySales, isNew]) => {
    const id = `${base.id}-${key}`;
    const prices = built.map((l) => l.prices[id]).filter((p): p is number => p !== undefined);
    return { id, shopId: base.id, name, price: Math.min(...prices), tastes, contains, emoji, monthlySales, isNew: Boolean(isNew) };
  });
  return { ...base, dishes: allDishes, listings: built };
}

/** 虚拟商家数据。店名均为虚构；多数店同时在两个平台上架，价格、配送和满减各不相同。 */
export const SHOPS: Shop[] = [
  shop(
    { id: 's01', name: '老街鸡腿饭', category: '盖饭', rating: 4.7, monthlySales: 3200, distanceKm: 0.8, emoji: '🍗', hue: 28 },
    [
      ['a', '招牌鸡腿饭', 18, ['重口'], ['葱蒜'], '🍗', 2100],
      ['b', '卤肉饭', 16, ['重口'], [], '🍚', 900],
      ['c', '照烧鸡排饭', 20, ['甜口'], [], '🍱', 300, true],
    ],
    [
      { platform: 'meituan', deliveryMin: 25, deliveryFee: 2, packFee: 1, discounts: [{ threshold: 20, off: 4 }] },
      { platform: 'eleme', deliveryMin: 28, deliveryFee: 1.5, packFee: 1, discounts: [{ threshold: 22, off: 5 }], delta: 1, missing: ['c'] },
    ],
  ),
  shop(
    { id: 's02', name: '阿婆手擀面', category: '面食', rating: 4.8, monthlySales: 2600, distanceKm: 1.1, emoji: '🍜', hue: 40 },
    [
      ['a', '番茄鸡蛋面', 15, ['清淡'], [], '🍅', 1300],
      ['b', '红烧牛肉面', 22, ['重口'], ['牛羊肉'], '🍜', 800],
      ['c', '葱油拌面', 12, ['清淡'], ['葱蒜'], '🍝', 600],
      ['d', '酸汤肥牛面', 26, ['酸辣'], ['牛羊肉', '辣椒'], '🍲', 260, true],
    ],
    [
      { platform: 'eleme', deliveryMin: 28, deliveryFee: 1.5, packFee: 1, discounts: [{ threshold: 15, off: 3 }, { threshold: 25, off: 6 }] },
      { platform: 'meituan', deliveryMin: 26, deliveryFee: 2, packFee: 1, discounts: [{ threshold: 20, off: 4 }], missing: ['d'] },
    ],
  ),
  shop(
    { id: 's03', name: '一碗轻食', category: '轻食', rating: 4.8, monthlySales: 1200, distanceKm: 1.6, emoji: '🥗', hue: 110, isNewShop: true },
    [
      ['a', '鸡胸肉藜麦碗', 28, ['健康', '清淡'], [], '🥗', 520],
      ['b', '牛油果虾仁沙拉', 32, ['健康', '清淡'], ['海鲜'], '🥑', 380],
      ['c', '照烧鸡腿能量碗', 26, ['健康', '甜口'], [], '🍱', 300, true],
    ],
    [{ platform: 'meituan', deliveryMin: 32, deliveryFee: 3, packFee: 2, discounts: [{ threshold: 30, off: 6 }] }],
  ),
  shop(
    { id: 's04', name: '川味小馆', category: '川湘菜', rating: 4.6, monthlySales: 2900, distanceKm: 1.3, emoji: '🌶️', hue: 8 },
    [
      ['a', '麻婆豆腐饭', 16, ['香辣', '重口'], ['辣椒', '葱蒜'], '🌶️', 1500],
      ['b', '宫保鸡丁饭', 19, ['香辣'], ['辣椒'], '🥜', 1100],
      ['c', '水煮肉片饭', 26, ['香辣', '重口'], ['辣椒'], '🥘', 700],
      ['d', '番茄炒蛋饭', 15, ['清淡', '甜口'], [], '🍳', 400],
    ],
    [
      { platform: 'eleme', deliveryMin: 30, deliveryFee: 2, packFee: 1, discounts: [{ threshold: 20, off: 3 }, { threshold: 35, off: 7 }] },
      { platform: 'meituan', deliveryMin: 32, deliveryFee: 2.5, packFee: 1, discounts: [{ threshold: 25, off: 5 }], delta: 1 },
    ],
  ),
  shop(
    { id: 's05', name: '粤式烧腊', category: '烧腊', rating: 4.7, monthlySales: 1800, distanceKm: 2.0, emoji: '🦆', hue: 18 },
    [
      ['a', '蜜汁叉烧饭', 22, ['甜口'], [], '🍖', 900],
      ['b', '烧鸭饭', 24, ['重口'], [], '🦆', 600],
      ['c', '白切鸡饭', 23, ['清淡'], ['葱蒜'], '🍗', 500],
    ],
    [{ platform: 'meituan', deliveryMin: 35, deliveryFee: 3, packFee: 1, discounts: [{ threshold: 25, off: 5 }] }],
  ),
  shop(
    { id: 's06', name: '小份砂锅粥', category: '粥点', rating: 4.6, monthlySales: 1500, distanceKm: 0.9, emoji: '🥣', hue: 48 },
    [
      ['a', '皮蛋瘦肉粥', 13, ['清淡'], [], '🥣', 800],
      ['b', '艇仔粥', 16, ['清淡'], ['海鲜'], '🦐', 300],
      ['c', '南瓜小米粥配包子', 11, ['清淡', '健康', '甜口'], [], '🎃', 500],
    ],
    [
      { platform: 'eleme', deliveryMin: 26, deliveryFee: 1, packFee: 1.5, discounts: [{ threshold: 15, off: 2 }] },
      { platform: 'meituan', deliveryMin: 27, deliveryFee: 1.5, packFee: 1.5, discounts: [{ threshold: 15, off: 3 }], delta: 0.5 },
    ],
  ),
  shop(
    { id: 's07', name: '汉堡研究所', category: '汉堡炸鸡', rating: 4.5, monthlySales: 4100, distanceKm: 1.0, emoji: '🍔', hue: 35 },
    [
      ['a', '双层牛肉堡套餐', 29, ['重口'], ['牛羊肉'], '🍔', 1600],
      ['b', '香辣鸡腿堡套餐', 24, ['香辣'], ['辣椒'], '🍟', 2000],
      ['c', '鸡肉卷单人餐', 18, [], [], '🌯', 900],
    ],
    [
      { platform: 'meituan', deliveryMin: 22, deliveryFee: 2, packFee: 1, discounts: [{ threshold: 25, off: 6 }] },
      { platform: 'eleme', deliveryMin: 24, deliveryFee: 0, packFee: 1, discounts: [{ threshold: 30, off: 5 }], delta: 2 },
    ],
  ),
  shop(
    { id: 's08', name: '小柳螺蛳粉', category: '粉/米线', rating: 4.6, monthlySales: 2300, distanceKm: 1.4, emoji: '🍲', hue: 60 },
    [
      ['a', '招牌螺蛳粉', 15, ['酸辣', '重口'], ['辣椒', '葱蒜'], '🍜', 1400],
      ['b', '加炸蛋螺蛳粉', 18, ['酸辣', '重口'], ['辣椒'], '🍳', 700],
      ['c', '干捞螺蛳粉', 17, ['酸辣'], ['辣椒'], '🥢', 200, true],
    ],
    [{ platform: 'eleme', deliveryMin: 30, deliveryFee: 2, packFee: 1, discounts: [{ threshold: 18, off: 3 }] }],
  ),
  shop(
    { id: 's09', name: '东北饺子馆', category: '饺子', rating: 4.8, monthlySales: 1700, distanceKm: 1.2, emoji: '🥟', hue: 210 },
    [
      ['a', '猪肉白菜饺', 16, ['清淡'], [], '🥟', 900],
      ['b', '三鲜饺子', 20, ['清淡'], ['海鲜'], '🦐', 500],
      ['c', '酸菜猪肉饺', 17, ['重口'], [], '🥟', 300],
    ],
    [
      { platform: 'meituan', deliveryMin: 28, deliveryFee: 2, packFee: 1, discounts: [{ threshold: 20, off: 4 }] },
      { platform: 'eleme', deliveryMin: 30, deliveryFee: 1, packFee: 1, discounts: [{ threshold: 20, off: 3 }] },
    ],
  ),
  shop(
    { id: 's10', name: '咖喱小屋', category: '咖喱/日料', rating: 4.7, monthlySales: 1300, distanceKm: 1.8, emoji: '🍛', hue: 42 },
    [
      ['a', '炸猪排咖喱饭', 26, ['重口'], [], '🍛', 600],
      ['b', '鸡肉咖喱饭', 22, [], [], '🍛', 500],
      ['c', '滑蛋蛋包饭', 20, ['甜口', '清淡'], [], '🍳', 300],
    ],
    [{ platform: 'eleme', deliveryMin: 34, deliveryFee: 3, packFee: 1, discounts: [{ threshold: 25, off: 5 }] }],
  ),
  shop(
    { id: 's11', name: '李记黄焖鸡', category: '盖饭', rating: 4.4, monthlySales: 5200, distanceKm: 0.6, emoji: '🐔', hue: 30 },
    [
      ['a', '黄焖鸡米饭', 17, ['重口'], ['葱蒜'], '🐔', 3500],
      ['b', '黄焖排骨饭', 22, ['重口'], [], '🍖', 900],
      ['c', '黄焖豆腐饭', 14, ['清淡'], [], '🍲', 400, true],
    ],
    [
      { platform: 'meituan', deliveryMin: 20, deliveryFee: 1, packFee: 1, discounts: [{ threshold: 18, off: 3 }] },
      { platform: 'eleme', deliveryMin: 21, deliveryFee: 1, packFee: 1, discounts: [{ threshold: 18, off: 4 }], delta: 1 },
    ],
  ),
  shop(
    { id: 's12', name: '首尔拌饭', category: '韩式', rating: 4.7, monthlySales: 900, distanceKm: 1.7, emoji: '🍱', hue: 0, isNewShop: true },
    [
      ['a', '石锅拌饭', 23, ['香辣', '健康'], ['辣椒'], '🍲', 500],
      ['b', '泡菜炒饭', 18, ['酸辣'], ['辣椒'], '🥘', 300],
      ['c', '芝士年糕部队锅', 32, ['香辣', '重口'], ['辣椒'], '🧀', 200],
    ],
    [{ platform: 'eleme', deliveryMin: 33, deliveryFee: 2.5, packFee: 1, discounts: [{ threshold: 25, off: 5 }] }],
  ),
  shop(
    { id: 's13', name: '云岭米线', category: '粉/米线', rating: 4.6, monthlySales: 1600, distanceKm: 1.5, emoji: '🍜', hue: 160 },
    [
      ['a', '过桥米线', 21, ['清淡'], [], '🍜', 700],
      ['b', '酸辣米线', 18, ['酸辣'], ['辣椒', '香菜'], '🌶️', 600],
      ['c', '番茄肥牛米线', 24, ['酸辣'], ['牛羊肉'], '🍅', 400],
    ],
    [
      { platform: 'meituan', deliveryMin: 31, deliveryFee: 2, packFee: 1, discounts: [{ threshold: 20, off: 4 }] },
      { platform: 'eleme', deliveryMin: 33, deliveryFee: 2, packFee: 1, discounts: [{ threshold: 25, off: 5 }], delta: -1, missing: ['b'] },
    ],
  ),
  shop(
    { id: 's14', name: '大盘鸡拌面', category: '西北菜', rating: 4.5, monthlySales: 1100, distanceKm: 2.3, emoji: '🍝', hue: 25 },
    [
      ['a', '大盘鸡拌面', 28, ['香辣', '重口'], ['辣椒', '葱蒜'], '🍗', 600],
      ['b', '羊肉抓饭', 30, ['重口'], ['牛羊肉'], '🍚', 300],
      ['c', '新疆拉条子', 22, ['香辣'], ['辣椒', '牛羊肉'], '🍝', 300],
    ],
    [{ platform: 'eleme', deliveryMin: 38, deliveryFee: 3, packFee: 2, discounts: [{ threshold: 30, off: 6 }] }],
  ),
  shop(
    { id: 's15', name: '秦味凉皮', category: '西北菜', rating: 4.6, monthlySales: 2700, distanceKm: 1.0, emoji: '🥙', hue: 45 },
    [
      ['a', '招牌凉皮', 10, ['酸辣'], ['辣椒', '香菜'], '🥗', 1300],
      ['b', '腊汁肉夹馍', 9, ['重口'], [], '🥙', 1200],
      ['c', '凉皮肉夹馍套餐', 17, ['酸辣', '重口'], ['辣椒', '香菜'], '🍱', 1000],
    ],
    [
      { platform: 'meituan', deliveryMin: 24, deliveryFee: 1.5, packFee: 0.5, discounts: [{ threshold: 15, off: 2 }] },
      { platform: 'eleme', deliveryMin: 25, deliveryFee: 1, packFee: 0.5, discounts: [{ threshold: 15, off: 2 }] },
    ],
  ),
  shop(
    { id: 's16', name: '香锅研究室', category: '香锅', rating: 4.5, monthlySales: 1400, distanceKm: 1.9, emoji: '🥘', hue: 12 },
    [
      ['a', '麻辣香锅单人份', 32, ['香辣', '重口'], ['辣椒'], '🥘', 800],
      ['b', '微辣蔬菜香锅', 26, ['健康'], [], '🥦', 300],
    ],
    [
      { platform: 'eleme', deliveryMin: 36, deliveryFee: 3, packFee: 2, discounts: [{ threshold: 30, off: 6 }, { threshold: 45, off: 10 }] },
      { platform: 'meituan', deliveryMin: 35, deliveryFee: 3, packFee: 2, discounts: [{ threshold: 30, off: 5 }, { threshold: 50, off: 12 }] },
    ],
  ),
];

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
  { dishId: 's01-a', daysAgo: 2, hour: 12, myRating: 5 },
  { dishId: 's01-a', daysAgo: 6, hour: 18 },
  { dishId: 's01-a', daysAgo: 11, hour: 12, myRating: 5 },
  { dishId: 's01-b', daysAgo: 17, hour: 19 },
  { dishId: 's01-a', daysAgo: 25, hour: 12 },
  { dishId: 's02-a', daysAgo: 4, hour: 19, myRating: 4 },
  { dishId: 's02-a', daysAgo: 13, hour: 12 },
  { dishId: 's02-c', daysAgo: 29, hour: 18 },
  { dishId: 's11-a', daysAgo: 3, hour: 13, myRating: 3 },
  { dishId: 's11-a', daysAgo: 20, hour: 12 },
  { dishId: 's04-a', daysAgo: 8, hour: 18, myRating: 4 },
  { dishId: 's04-b', daysAgo: 22, hour: 19 },
  { dishId: 's06-a', daysAgo: 15, hour: 8 },
  { dishId: 's07-b', daysAgo: 10, hour: 21, myRating: 2 },
  { dishId: 's09-a', daysAgo: 5, hour: 18, myRating: 5 },
  { dishId: 's09-a', daysAgo: 19, hour: 12 },
  { dishId: 's15-b', daysAgo: 27, hour: 12 },
];

export type Platform = 'meituan' | 'eleme';
export const PLATFORMS: Platform[] = ['meituan', 'eleme'];

export type Taste = '清淡' | '香辣' | '酸辣' | '重口' | '健康' | '甜口';
export type Avoid = '香菜' | '葱蒜' | '辣椒' | '海鲜' | '牛羊肉';

export const TASTES: Taste[] = ['清淡', '香辣', '酸辣', '重口', '健康', '甜口'];
export const AVOIDS: Avoid[] = ['香菜', '葱蒜', '辣椒', '海鲜', '牛羊肉'];

export interface Dish {
  id: string;
  shopId: string;
  name: string;
  /** 各平台中最低的菜单价，只用于浏览时展示 */
  price: number;
  tastes: Taste[];
  contains: Avoid[];
  emoji: string;
  monthlySales: number;
  isNew: boolean;
  /** 菜品图（相对路径）；没有时显示 emoji */
  image?: string;
  /** 点开放大时用的图 */
  imageLarge?: string;
  /** 数据自带的标签（如「高蛋白」「低脂」），只用于搜索 */
  tags?: string[];
}

export interface Discount {
  threshold: number;
  off: number;
}

/** 一家店在某个外卖平台上的上架信息：菜价、配送、满减都可能和其他平台不同。 */
export interface Listing {
  platform: Platform;
  deliveryMin: number;
  deliveryFee: number;
  packFee: number;
  discounts: Discount[];
  /** 菜品 id → 该平台的菜单价；没有的菜表示该平台不卖 */
  prices: Record<string, number>;
}

export interface Shop {
  id: string;
  name: string;
  category: string;
  rating: number;
  monthlySales: number;
  distanceKm: number;
  emoji: string;
  hue: number;
  isNewShop?: boolean;
  /** 搜索用的标签，如「工作餐」「练后餐」「夜宵」 */
  tags: string[];
  /** 店铺图（相对路径）；没有时显示 emoji */
  image?: string;
  /** 点开放大时用的图 */
  imageLarge?: string;
  reviews?: Review[];
  dishes: Dish[];
  listings: Listing[];
}

export interface Review {
  user: string;
  rating: number;
  daysAgo: number;
  text: string;
  /** 评价里提到的菜名 */
  dish?: string;
}

/** 用户在某平台账户里的优惠券（理想 API 提供，需授权）。 */
export interface Coupon {
  id: string;
  platform: Platform;
  name: string;
  threshold: number;
  off: number;
}

/** 外卖平台历史订单（理想 API 提供，需用户授权）。 */
export interface OrderRecord {
  shopId: string;
  dishId: string;
  at: number;
  myRating?: number;
}

export type MealKind = 'breakfast' | 'lunch' | 'dinner';

/** 候选：跨店比较用的「想吃」清单，以菜品为单位，不记份数（会议决策：候选对象为菜品）。 */
export interface Candidate {
  shopId: string;
  dishId: string;
  addedAt: number;
  mealKey: string;
}

export type TrashReason = 'manual' | 'expired' | 'cleared' | 'replaced' | 'ordered';

export interface TrashItem extends Candidate {
  deletedAt: number;
  reason: TrashReason;
}

export interface CartLine {
  dishId: string;
  qty: number;
}

/**
 * 购物车：每家店一个，菜只选一次；App 按每个上架平台分别算出含券实付，
 * 相当于「每家店 × 每个平台一个购物车」。
 */
export interface Cart {
  shopId: string;
  lines: CartLine[];
  updatedAt: number;
}

export type Retention = 'meal' | 'day' | 'manual';

export interface Settings {
  likes: Taste[];
  avoids: Avoid[];
  /** 首页浏览多少秒后自动探出推荐，0 为不自动。 */
  autoPopupSec: number;
  recommendCount: number;
  candidateLimit: number;
  retention: Retention;
  showRandom: boolean;
  useHistory: boolean;
  useTastePrefs: boolean;
  /** 用各平台优惠券计算最低实付 */
  useCoupons: boolean;
}

/** 本次条件：只在当前会话有效。 */
export interface Conditions {
  budget: number | null;
  maxMinutes: number | null;
  tastes: Taste[];
}

export type RecordReason = 'love' | 'rush' | 'deal' | 'others' | 'settle';

/** 用户对记录的修正（记录页 F12）。 */
export interface RecordEdit {
  reason?: RecordReason;
  excluded?: boolean;
  deleted?: boolean;
}

/** App 内产生的行为：加入候选、付款下单。 */
export interface AppEvent {
  type: 'candidate' | 'chosen';
  shopId: string;
  dishId?: string;
  platform?: Platform;
  at: number;
}

import type { Coupon, OrderRecord, Platform, Shop } from '../types';
import { COUPONS, HISTORY_SEED, SHOPS } from './mockData';

/**
 * 数据访问层（N6）。界面只通过这里取数；
 * 以后接入真实 API 时只需替换这个文件的实现，接口保持不变。
 * 会议假设：能获取各平台的菜价、配送费、送达时间、店铺满减与用户优惠券。
 */
export interface DataApi {
  listShops(): Promise<Shop[]>;
  listOrderHistory(): Promise<OrderRecord[]>;
  listCoupons(): Promise<Coupon[]>;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const api: DataApi = {
  async listShops() {
    await wait(380);
    return structuredClone(SHOPS);
  },
  async listOrderHistory() {
    await wait(260);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return HISTORY_SEED.map((h) => ({
      shopId: h.dishId.split('-')[0],
      dishId: h.dishId,
      at: today.getTime() - h.daysAgo * DAY + h.hour * HOUR,
      myRating: h.myRating,
    }));
  },
  async listCoupons() {
    await wait(200);
    return structuredClone(COUPONS);
  },
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  meituan: '美团',
  eleme: '饿了么',
};

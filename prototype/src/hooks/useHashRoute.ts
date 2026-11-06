import { useCallback, useEffect, useState } from 'react';
import type { Platform } from '../types';

export type Route =
  | { name: 'home' }
  | { name: 'cart' }
  | { name: 'records' }
  | { name: 'me' }
  /** App 内的店铺页：浏览菜单、加入候选、加购物车 */
  | { name: 'shop'; shopId: string; openCart: boolean }
  /** App 内的确认订单页（内容来自这家店的购物车） */
  | { name: 'order'; shopId: string; platform?: Platform }
  /** 外卖平台收银台（模拟）：只在付款这一步跳转平台 */
  | { name: 'pay'; shopId: string; platform: Platform; lines: string }
  /** 付款后回到 App 的下单结果页 */
  | { name: 'done'; shopId: string; platform: Platform; lines: string };

const asPlatform = (v: string | null): Platform | undefined => (v === 'meituan' || v === 'eleme' ? v : undefined);

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, search = ''] = raw.split('?');
  const [page, id] = path.split('/').filter(Boolean);
  const q = new URLSearchParams(search);
  const platform = asPlatform(q.get('p'));
  switch (page) {
    case 'cart':
      return { name: 'cart' };
    case 'records':
      return { name: 'records' };
    case 'me':
      return { name: 'me' };
    case 'shop':
      return id ? { name: 'shop', shopId: id, openCart: q.get('cart') === '1' } : { name: 'home' };
    case 'order':
      return id ? { name: 'order', shopId: id, platform } : { name: 'home' };
    case 'pay':
    case 'done':
      return id && platform ? { name: page, shopId: id, platform, lines: q.get('d') ?? '' } : { name: 'home' };
    default:
      return { name: 'home' };
  }
}

const depth = () => (window.history.state as { idx?: number } | null)?.idx ?? 0;

/** 极简 hash 路由：支持浏览器返回键，直接打开深链时返回回到首页。 */
export function useHashRoute() {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const sync = () => setRoute(parse());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const navigate = useCallback((path: string, options?: { replace?: boolean }) => {
    if (options?.replace) window.history.replaceState({ idx: depth() }, '', `#${path}`);
    else window.history.pushState({ idx: depth() + 1 }, '', `#${path}`);
    setRoute(parse());
  }, []);

  const back = useCallback(() => {
    if (depth() > 0) window.history.back();
    else navigate('/', { replace: true });
  }, [navigate]);

  return { route, navigate, back };
}

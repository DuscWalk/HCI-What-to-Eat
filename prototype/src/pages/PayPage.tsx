import { useState } from 'react';
import { PLATFORM_LABEL } from '../api/client';
import { IconBack } from '../components/Icons';
import { decodeLines, resolveLines } from '../logic/order';
import { listingOf, quoteListing, yuan } from '../logic/pricing';
import { useActions } from '../store/actions';
import { useData } from '../store/data';
import { useCoupons } from '../store/selectors';
import { useStore } from '../store/store';
import type { Platform } from '../types';

/**
 * 外卖平台收银台（模拟）。这是整个流程里唯一跳转平台的一步；
 * 付款成功后回到 App 的下单结果页，并记为「最终选定」。
 */
export function PayPage({ shopId, platform, lines: raw }: { shopId: string; platform: Platform; lines: string }) {
  const { shopById, loading } = useData();
  const { dispatch } = useStore();
  const { back, navigate } = useActions();
  const coupons = useCoupons();
  const [paying, setPaying] = useState(false);
  const shop = shopById.get(shopId);
  const listing = shop && listingOf(shop, platform);

  if (loading) return <div className="page pay" />;
  if (!shop || !listing) return <div className="page pay"><div className="empty">找不到订单</div></div>;

  const label = PLATFORM_LABEL[platform];
  const refs = decodeLines(raw);
  const lines = resolveLines(shop, refs);
  const quote = quoteListing(listing, lines, coupons);

  const confirm = () => {
    setPaying(true);
    window.setTimeout(() => {
      const at = Date.now();
      for (const r of refs) dispatch({ type: 'chosen', shopId, dishId: r.dishId, platform, at });
      dispatch({ type: 'cartClear', shopId });
      dispatch({ type: 'remove', dishIds: refs.map((r) => r.dishId), reason: 'ordered', at });
      navigate(`/done/${shopId}?p=${platform}&d=${raw}`, { replace: true });
    }, 900);
  };

  return (
    <div className="page pay">
      <header className="pay-bar">
        <button type="button" className="pay-back" onClick={back} disabled={paying}>
          <IconBack size={18} /> 返回修改订单
        </button>
        <span className="pay-brand">{label} · 收银台（模拟）</span>
      </header>
      <div className="pay-body">
        <div className="pay-merchant">{shop.name}</div>
        <div className="pay-amount">{yuan(quote.total)}</div>
        <ul className="pay-lines">
          {lines.map(({ dish, qty }) => (
            <li key={dish.id}>
              <span>
                {dish.name} × {qty}
              </span>
              <span>{yuan((listing.prices[dish.id] ?? 0) * qty)}</span>
            </li>
          ))}
          <li className="muted">
            <span>包装 + 配送</span>
            <span>{yuan(Math.round((quote.pack + quote.delivery) * 10) / 10)}</span>
          </li>
          {quote.shopOff > 0 && (
            <li className="muted">
              <span>店铺满减</span>
              <span>−{yuan(quote.shopOff)}</span>
            </li>
          )}
          {quote.coupon && (
            <li className="muted">
              <span>{quote.coupon.name}</span>
              <span>−{yuan(quote.couponOff)}</span>
            </li>
          )}
        </ul>
        <div className="pay-method">支付方式：{label}账户默认方式</div>
        <button type="button" className="pay-confirm" onClick={confirm} disabled={paying || !lines.length}>
          {paying ? '正在支付…' : `确认支付 ${yuan(quote.total)}`}
        </button>
        <p className="pay-note">
          首版为模拟。正式版本只在这一步跳转到{label}，用平台账户完成付款，付款后自动回到「今天吃什么」。
        </p>
      </div>
    </div>
  );
}

import { PLATFORM_LABEL } from '../api/client';
import { IconCheck } from '../components/Icons';
import { Thumb } from '../components/ui';
import { arrivalTime, decodeLines, resolveLines } from '../logic/order';
import { listingOf, quoteListing, yuan } from '../logic/pricing';
import { useActions } from '../store/actions';
import { useData } from '../store/data';
import { useCoupons } from '../store/selectors';
import { useStore } from '../store/store';
import type { Platform } from '../types';

/** 付款后回到 App：下单结果，并顺手处理这一餐剩下的候选和购物车。 */
export function DonePage({ shopId, platform, lines: raw }: { shopId: string; platform: Platform; lines: string }) {
  const { shopById, loading } = useData();
  const { state } = useStore();
  const { navigate, clearCandidates } = useActions();
  const coupons = useCoupons();
  const shop = shopById.get(shopId);
  const listing = shop && listingOf(shop, platform);

  if (loading) return <div className="page done" />;
  if (!shop || !listing) return <div className="page done"><div className="empty">找不到订单</div></div>;

  const lines = resolveLines(shop, decodeLines(raw));
  const quote = quoteListing(listing, lines, coupons);
  const leftCandidates = state.candidates.length;
  const leftCarts = state.carts.length;

  return (
    <div className="page done">
      <div className="done-hero">
        <span className="done-check">
          <IconCheck size={30} />
        </span>
        <h1>下单成功</h1>
        <p>
          {shop.name} · 预计 {arrivalTime(listing.deliveryMin)} 送达
        </p>
        <small>
          已在{PLATFORM_LABEL[platform]}付款 {yuan(quote.total)}
          {quote.coupon ? `，用了${quote.coupon.name}` : ''}，并记入「记录」的最终选定
        </small>
      </div>

      <section className="card">
        <ul className="order-lines">
          {lines.map(({ dish, qty }) => (
            <li key={dish.id}>
              <Thumb emoji={dish.emoji} hue={shop.hue} size={40} />
              <span className="order-line-name">{dish.name}</span>
              <span className="muted">× {qty}</span>
            </li>
          ))}
        </ul>
      </section>

      {(leftCandidates > 0 || leftCarts > 0) && (
        <section className="card done-left">
          <div>
            <b>
              这一餐还有{' '}
              {[leftCandidates > 0 && `${leftCandidates} 个候选`, leftCarts > 0 && `${leftCarts} 个别家的购物车`]
                .filter(Boolean)
                .join('、')}
            </b>
            <small>候选会按设置在这一餐结束后自动清空；购物车会一直保留</small>
          </div>
          {leftCandidates > 0 && (
            <button type="button" className="btn ghost small" onClick={clearCandidates}>
              清空候选
            </button>
          )}
        </section>
      )}

      <div className="done-actions">
        <button type="button" className="btn primary wide" onClick={() => navigate('/', { replace: true })}>
          回首页
        </button>
      </div>
    </div>
  );
}

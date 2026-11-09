import { useState } from 'react';
import { PLATFORM_LABEL } from '../api/client';
import { IconPin, IconPlus } from '../components/Icons';
import { QuoteBreakdown, QuoteChips } from '../components/Quotes';
import { PageHeader, QtyControl, Thumb } from '../components/ui';
import { arrivalTime, encodeLines, resolveLines } from '../logic/order';
import { cheapest, quoteAll, yuan } from '../logic/pricing';
import { useActions } from '../store/actions';
import { useData } from '../store/data';
import { useCoupons } from '../store/selectors';
import { MAX_QTY, useStore } from '../store/store';
import type { Platform } from '../types';

/**
 * 确认订单：内容就是这家店的购物车。顶部切换平台，默认选含券实付最低的平台；
 * 付款时才跳转到所选平台。
 */
export function OrderPage({ shopId, platform: initial }: { shopId: string; platform?: Platform }) {
  const { shopById, loading } = useData();
  const { state } = useStore();
  const { back, navigate, goShop, cartAdd, cartDec } = useActions();
  const coupons = useCoupons();
  const [picked, setPicked] = useState<Platform | undefined>(initial);

  const shop = shopById.get(shopId);
  if (loading) return <div className="page order" />;
  if (!shop) {
    return (
      <div className="page order">
        <PageHeader title="确认订单" onBack={back} />
        <div className="empty">找不到这家店</div>
      </div>
    );
  }

  const cart = state.carts.find((c) => c.shopId === shopId);
  const lines = cart ? resolveLines(shop, cart.lines) : [];
  const quotes = quoteAll(shop, lines, coupons);
  const best = cheapest(quotes);
  const platform = picked ?? best?.platform ?? shop.listings[0].platform;
  const quote = quotes.find((q) => q.platform === platform)!;
  const listing = shop.listings.find((l) => l.platform === platform)!;
  const others = shop.dishes.filter((d) => !cart?.lines.some((l) => l.dishId === d.id) && listing.prices[d.id] !== undefined);
  const payable = lines.length > 0 && quote.missing.length === 0;

  return (
    <div className="page order">
      <PageHeader title="确认订单" sub={shop.name} onBack={back} />

      {lines.length > 0 && (
        <section className="card">
          <div className="sheet-label">在哪个平台下单（已算优惠券）</div>
          <QuoteChips quotes={quotes} best={best} selected={platform} onSelect={setPicked} />
        </section>
      )}

      <section className="card order-addr">
        <IconPin size={18} />
        <div>
          <b>仙林校区 · 宿舍 4 栋</b>
          <small>
            {PLATFORM_LABEL[platform]}配送 · 预计 {arrivalTime(quote.deliveryMin)} 送达（约 {quote.deliveryMin} 分钟）
          </small>
        </div>
      </section>

      <section className="card">
        {lines.length === 0 ? (
          <div className="order-empty">
            <p>购物车是空的</p>
            <button type="button" className="btn ghost small" onClick={() => goShop(shop.id)}>
              去店里选
            </button>
          </div>
        ) : (
          <ul className="order-lines">
            {lines.map(({ dish, qty }) => {
              const unit = listing.prices[dish.id];
              return (
                <li key={dish.id} className={unit === undefined ? 'missing' : ''}>
                  <Thumb emoji={dish.emoji} src={dish.image} hue={shop.hue} size={44} zoom={{ src: dish.imageLarge, title: dish.name, sub: shop.name }} />
                  <span className="order-line-name">
                    {dish.name}
                    <small>{unit === undefined ? `${PLATFORM_LABEL[platform]}没有这道菜` : `¥${unit}`}</small>
                  </span>
                  <QtyControl
                    qty={qty}
                    max={MAX_QTY}
                    label={dish.name}
                    onInc={() => cartAdd(shop.id, dish.id)}
                    onDec={() => cartDec(shop.id, dish.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
        {others.length > 0 && (
          <div className="order-more">
            <span>同店加一份</span>
            <div className="order-more-list">
              {others.map((d) => (
                <button key={d.id} type="button" className="chip" onClick={() => cartAdd(shop.id, d.id)}>
                  <IconPlus size={12} /> {d.name} ¥{listing.prices[d.id]}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {lines.length > 0 && (
        <section className="card">
          <QuoteBreakdown quote={quote} />
          {best && best.platform !== platform && quote.missing.length === 0 && (
            <p className="order-diff">
              在{PLATFORM_LABEL[best.platform]}下单可以再省 {yuan(Math.round((quote.total - best.total) * 10) / 10)}
            </p>
          )}
        </section>
      )}

      <p className="order-note">选菜、购物车和确认订单都在这里完成，只有付款这一步会跳转到{PLATFORM_LABEL[platform]}。</p>

      <div className="order-bar">
        <div>
          <small>{PLATFORM_LABEL[platform]}实付</small>
          <b>{payable ? yuan(quote.total) : '—'}</b>
        </div>
        <button
          type="button"
          className="btn primary"
          disabled={!payable}
          onClick={() => navigate(`/pay/${shop.id}?p=${platform}&d=${encodeLines(cart!.lines)}`)}
        >
          去{PLATFORM_LABEL[platform]}付款
        </button>
      </div>
    </div>
  );
}

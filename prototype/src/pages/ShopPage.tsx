import { useEffect, useMemo, useState } from 'react';
import { PLATFORM_LABEL } from '../api/client';
import { QuoteBreakdown, QuoteChips, quoteSummary } from '../components/Quotes';
import { CandidateToggle, PageHeader, QtyControl, Sheet, Thumb } from '../components/ui';
import { avoidedBy, orderDishes, type TastePrefs } from '../logic/browse';
import { resolveLines } from '../logic/order';
import { cheapest, quoteAll, yuan } from '../logic/pricing';
import { useActions } from '../store/actions';
import { useData } from '../store/data';
import { useCoupons, useHistoryStats } from '../store/selectors';
import { MAX_QTY, useStore } from '../store/store';

const NO_PREFS: TastePrefs = { likes: [], avoids: [] };

/**
 * App 内的店铺页：看菜单，「候选」用来和别家比，「+」加进这家店的购物车。
 * 底栏直接显示购物车在各平台的含券实付，不用另外点开比较。
 */
export function ShopPage({ shopId, openCart }: { shopId: string; openCart: boolean }) {
  const { shopById, loading } = useData();
  const { state } = useStore();
  const { back, cartAdd, cartDec, cartQty, clearCart, toggleCandidate, isCandidate, openCheckout } = useActions();
  const history = useHistoryStats();
  const coupons = useCoupons();
  const [sheetOpen, setSheetOpen] = useState(openCart);
  useEffect(() => setSheetOpen(openCart), [openCart, shopId]);

  const shop = shopById.get(shopId);
  const { useTastePrefs, likes, avoids } = state.settings;
  const prefs = useMemo<TastePrefs>(() => (useTastePrefs ? { likes, avoids } : NO_PREFS), [useTastePrefs, likes, avoids]);
  const cart = state.carts.find((c) => c.shopId === shopId);

  if (loading) return <div className="page shop" />;
  if (!shop) {
    return (
      <div className="page shop">
        <PageHeader title="店铺" onBack={back} />
        <div className="empty">找不到这家店</div>
      </div>
    );
  }

  const lines = cart ? resolveLines(shop, cart.lines) : [];
  const quotes = quoteAll(shop, lines, coupons);
  const best = cheapest(quotes);
  const portions = lines.reduce((sum, l) => sum + l.qty, 0);
  const h = history.get(shop.id);
  const platforms = shop.listings.map((l) => PLATFORM_LABEL[l.platform]).join('、');

  return (
    <div className="page shop">
      <PageHeader title={shop.name} sub={`${platforms}都能点 · 付款时跳转平台`} onBack={back} />

      <section className="shop-hero">
        <Thumb emoji={shop.emoji} hue={shop.hue} size={64} />
        <div className="shop-info">
          <div className="shop-meta">
            <span className="star">★ {shop.rating.toFixed(1)}</span>
            <span>月售 {shop.monthlySales}+</span>
            <span>{shop.distanceKm}km</span>
          </div>
          {h && (
            <div className="shop-tags">
              <span className="tag ordered">点过 {h.orderCount} 次</span>
            </div>
          )}
          <ul className="listing-rows">
            {shop.listings.map((l) => (
              <li key={l.platform}>
                <span className={`tag plat plat-${l.platform}`}>{PLATFORM_LABEL[l.platform]}</span>
                <span>
                  {l.deliveryMin} 分钟 · {l.deliveryFee ? `配送 ¥${l.deliveryFee}` : '免配送费'} ·{' '}
                  {l.discounts.map((d) => `满${d.threshold}减${d.off}`).join('、')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <h2 className="menu-title">菜单</h2>
      <ul className="menu">
        {orderDishes(shop.dishes, prefs).map((dish) => {
          const avoided = avoidedBy(dish, prefs);
          const ordered = h?.orderedDishIds.has(dish.id);
          const priced = shop.listings.filter((l) => l.prices[dish.id] !== undefined);
          return (
            <li key={dish.id} className={`menu-item${avoided.length ? ' avoided' : ''}`}>
              <Thumb emoji={dish.emoji} hue={shop.hue} size={64} />
              <div className="menu-main">
                <div className="menu-name">
                  {dish.name}
                  {dish.isNew && <span className="kind kind-familiarNew">新品</span>}
                  {ordered && <span className="kind kind-again">吃过</span>}
                </div>
                <div className="menu-tags">
                  {dish.tastes.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                  {avoided.length > 0 && <span className="avoid">含{avoided.join('、')}</span>}
                </div>
                <div className="menu-prices">
                  {priced.length === 1 && <span className="only">仅{PLATFORM_LABEL[priced[0].platform]}</span>}
                  {priced.map((l) => (
                    <span key={l.platform}>
                      {priced.length > 1 && <small>{PLATFORM_LABEL[l.platform]} </small>}
                      <b>¥{l.prices[dish.id]}</b>
                    </span>
                  ))}
                </div>
              </div>
              <div className="menu-actions">
                <CandidateToggle
                  compact
                  on={isCandidate(dish.id)}
                  label={dish.name}
                  onToggle={() => toggleCandidate(shop.id, dish.id)}
                />
                <QtyControl
                  qty={cartQty(shop.id, dish.id)}
                  max={MAX_QTY}
                  label={dish.name}
                  onInc={() => cartAdd(shop.id, dish.id)}
                  onDec={() => cartDec(shop.id, dish.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="shop-bar">
        {lines.length ? (
          <button type="button" className="shop-bar-text" onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
            <b>
              购物车 {portions} 件{best ? ` · 最低 ${yuan(best.total)}` : ''}
            </b>
            <small>{best ? `${PLATFORM_LABEL[best.platform]} · ${quoteSummary(quotes, best)} · 点开看明细` : quoteSummary(quotes, best)}</small>
          </button>
        ) : (
          <div className="shop-bar-text">
            <b>点 + 加进购物车</b>
            <small>自动比较各平台算上优惠券的实付</small>
          </div>
        )}
        <button type="button" className="btn primary" disabled={!best} onClick={() => openCheckout(shop.id)}>
          去结算
        </button>
      </div>

      {sheetOpen && lines.length > 0 && (
        <Sheet title={`购物车 · ${shop.name}`} onClose={() => setSheetOpen(false)}>
          <ul className="order-lines sheet-lines">
            {lines.map(({ dish, qty }) => (
              <li key={dish.id}>
                <Thumb emoji={dish.emoji} hue={shop.hue} size={40} />
                <span className="order-line-name">{dish.name}</span>
                <QtyControl
                  qty={qty}
                  max={MAX_QTY}
                  label={dish.name}
                  onInc={() => cartAdd(shop.id, dish.id)}
                  onDec={() => cartDec(shop.id, dish.id)}
                />
              </li>
            ))}
          </ul>
          <div className="sheet-section">
            <div className="sheet-label">各平台实付（已算优惠券）</div>
            <QuoteChips quotes={quotes} best={best} />
            {quotes
              .filter((q) => q.missing.length)
              .map((q) => (
                <p key={q.platform} className="sheet-hint">
                  {PLATFORM_LABEL[q.platform]}没有「{q.missing.map((d) => d.name).join('、')}」
                </p>
              ))}
            {best && <QuoteBreakdown quote={best} />}
          </div>
          <div className="sheet-actions">
            <button
              type="button"
              className="btn danger-ghost"
              onClick={() => {
                setSheetOpen(false);
                clearCart(shop.id);
              }}
            >
              清空购物车
            </button>
            <button type="button" className="btn primary" disabled={!best} onClick={() => openCheckout(shop.id)}>
              去结算
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

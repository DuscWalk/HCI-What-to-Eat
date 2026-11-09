import { useEffect, useState } from 'react';
import { PLATFORM_LABEL } from '../api/client';
import { IconCartPlus, IconChevron, IconClock, IconClose, IconWheel } from '../components/Icons';
import { QuoteChips } from '../components/Quotes';
import { PageHeader, Thumb } from '../components/ui';
import { MEAL_END, MEAL_LABEL } from '../logic/meal';
import { bestSingle, yuan } from '../logic/pricing';
import { WheelSheet } from '../overlays/WheelSheet';
import { useActions } from '../store/actions';
import { useData } from '../store/data';
import { useCartViews, useCoupons } from '../store/selectors';
import { useStore } from '../store/store';
import type { TrashReason } from '../types';

const TRASH_REASON: Record<TrashReason, string> = {
  manual: '手动移出',
  expired: '上一餐自动清空',
  cleared: '清空',
  replaced: '被替换',
  ordered: '已下单',
};

/**
 * 比一比（F6–F9、F24）：
 * 上半部分比较各家店的购物车——每个购物车按各平台算上优惠券的实付，取最低；
 * 下半部分是候选（跨店的「想吃」清单），选中后放进对应店的购物车。
 */
export function CartPage() {
  const { shopById, dishById } = useData();
  const { state } = useStore();
  const {
    meal,
    back,
    navigate,
    goShop,
    openCheckout,
    candidateToCart,
    removeCandidate,
    restoreCandidate,
    clearCandidates,
    openRecommend,
  } = useActions();
  const coupons = useCoupons();
  const views = useCartViews();
  const { candidates, trash, settings, carts } = state;
  const [showTrash, setShowTrash] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);

  const sorted = [...views].sort((a, b) => (a.best?.total ?? Infinity) - (b.best?.total ?? Infinity));
  const complete = sorted.filter((v) => v.best);
  const cheapestCart = complete.length > 1 ? complete[0] : undefined;

  const rows = candidates.flatMap((c) => {
    const shop = shopById.get(c.shopId);
    const dish = dishById.get(c.dishId);
    if (!shop || !dish) return [];
    const inCart = carts.some((k) => k.shopId === shop.id && k.lines.some((l) => l.dishId === dish.id));
    return [{ c, shop, dish, best: bestSingle(shop, dish, coupons), inCart }];
  });
  const over = candidates.length >= settings.candidateLimit;
  const canWheel = settings.showRandom && rows.length > 1;

  useEffect(() => {
    if (pickedId && !candidates.some((c) => c.dishId === pickedId)) setPickedId(null);
  }, [candidates, pickedId]);

  const retentionNote =
    settings.retention === 'meal'
      ? `${MEAL_END[meal.kind]} 后自动清空`
      : settings.retention === 'day'
        ? '今天结束后清空'
        : '只在手动清空时清除';

  const nothing = views.length === 0 && rows.length === 0;

  return (
    <div className="page cart">
      <PageHeader title="比一比" sub="购物车按各平台算上优惠券的实付比较" onBack={back} />

      {nothing ? (
        <div className="empty cart-empty">
          <div className="empty-emoji">🍽️</div>
          <p className="empty-title">还没有可以比较的</p>
          <p>浏览时点书签加入候选，进店点 + 加进购物车</p>
          <div className="empty-actions">
            <button type="button" className="btn ghost" onClick={() => navigate('/', { replace: true })}>
              回首页逛逛
            </button>
            <button type="button" className="btn primary" onClick={openRecommend}>
              帮我挑几个
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="cmp-section">
            <div className="cmp-head">
              <h2>购物车</h2>
              <span>{views.length} 家</span>
            </div>
            {views.length === 0 ? (
              <p className="cmp-empty">还没有购物车。把下面的候选放进购物车，或进店点 + 加菜。</p>
            ) : (
              <ul className="cand-list">
                {sorted.map((v) => {
                  const names = v.cart.lines
                    .map((l) => `${dishById.get(l.dishId)?.name ?? ''}${l.qty > 1 ? ` ×${l.qty}` : ''}`)
                    .join('、');
                  const isCheapest = cheapestCart?.cart.shopId === v.cart.shopId;
                  return (
                    <li key={v.cart.shopId} className={`cand cart-card${isCheapest ? ' picked' : ''}`}>
                      <div className="cand-top">
                        <Thumb emoji={v.shop.emoji} src={v.shop.image} hue={v.shop.hue} size={52} zoom={{ src: v.shop.imageLarge, title: v.shop.name }} />
                        <div className="cand-main">
                          <div className="cand-dish">
                            {v.shop.name}
                            <span className="cart-portions">{v.portions} 件</span>
                          </div>
                          <div className="cart-names">{names}</div>
                          {v.best && (
                            <div className="cand-eta">
                              <IconClock size={14} />
                              <b>{v.best.deliveryMin}</b> 分钟送达
                            </div>
                          )}
                        </div>
                        <div className="cand-nums">
                          <div className="cand-price">
                            <small>最低</small>
                            {v.best ? yuan(v.best.total) : '—'}
                          </div>
                          {v.best && <span className="cart-plat">{PLATFORM_LABEL[v.best.platform]}</span>}
                          {isCheapest && <span className="flag">这几单最省</span>}
                        </div>
                      </div>
                      <QuoteChips quotes={v.quotes} best={v.best} />
                      <div className="cand-bottom">
                        <button type="button" className="btn ghost small" onClick={() => goShop(v.shop.id, true)}>
                          改一改
                        </button>
                        <button
                          type="button"
                          className="btn primary small"
                          disabled={!v.best}
                          onClick={() => openCheckout(v.shop.id)}
                        >
                          去结算
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="cmp-section">
            <div className="cmp-head">
              <h2>候选</h2>
              <span className={over ? 'warn' : ''}>
                {MEAL_LABEL[meal.kind]} · {candidates.length}/{settings.candidateLimit} · {retentionNote}
              </span>
              <span className="cmp-head-actions">
                {canWheel && (
                  <button type="button" className="wheel-btn" onClick={() => setWheelOpen(true)}>
                    <IconWheel size={15} /> 转盘
                  </button>
                )}
                {rows.length > 0 && (
                  <button type="button" className="btn text small" onClick={clearCandidates}>
                    清空
                  </button>
                )}
              </span>
            </div>
            {rows.length === 0 ? (
              <p className="cmp-empty">浏览时点菜品上的书签，把想吃的先放进候选。</p>
            ) : (
              <ul className="cand-list">
                {rows.map(({ c, shop, dish, best, inCart }) => (
                  <li key={c.dishId} id={`cand-${c.dishId}`} className={`cand${pickedId === c.dishId ? ' picked' : ''}`}>
                    <div className="cand-top">
                      <Thumb emoji={dish.emoji} src={dish.image} hue={shop.hue} size={48} zoom={{ src: dish.imageLarge, title: dish.name, sub: shop.name }} />
                      <div className="cand-main">
                        <div className="cand-dish">{dish.name}</div>
                        <button type="button" className="link-shop" onClick={() => goShop(shop.id)}>
                          {shop.name}
                          <IconChevron size={13} />
                        </button>
                        {best && (
                          <div className="cand-eta">
                            单点最低 <b>{yuan(best.total)}</b> · {PLATFORM_LABEL[best.platform]} · {best.deliveryMin} 分钟
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="icon-btn cand-del"
                        aria-label={`移出候选：${dish.name}`}
                        onClick={() => removeCandidate(c.dishId)}
                      >
                        <IconClose size={16} />
                      </button>
                    </div>
                    <div className="cand-bottom">
                      <span className="cand-note">{inCart ? '已在这家店的购物车里' : '放进购物车后能和别家比总价'}</span>
                      <button type="button" className="btn primary small" onClick={() => candidateToCart(shop.id, dish.id)}>
                        <IconCartPlus size={15} /> {inCart ? '再加一份' : '放进购物车'}
                      </button>
                    </div>
                    {pickedId === c.dishId && (
                      <div className="picked-bar">
                        <span>转盘选中了它</span>
                        <button type="button" className="btn text small" onClick={() => setWheelOpen(true)}>
                          再转一次
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {over && <p className="limit-note">候选已满，再加新的需要先换掉一个</p>}
          </section>
        </>
      )}

      {trash.length > 0 && (
        <section className="trash">
          <button type="button" className="trash-toggle" aria-expanded={showTrash} onClick={() => setShowTrash((v) => !v)}>
            最近移出的候选 {trash.length}
            <IconChevron size={14} className={showTrash ? 'rot' : ''} />
          </button>
          {showTrash && (
            <ul className="trash-list">
              {trash.map((t) => {
                const shop = shopById.get(t.shopId);
                const dish = dishById.get(t.dishId);
                if (!shop || !dish) return null;
                return (
                  <li key={t.dishId}>
                    <div>
                      <div className="trash-name">{dish.name}</div>
                      <div className="trash-meta">
                        {shop.name} · {TRASH_REASON[t.reason]}
                      </div>
                    </div>
                    <button type="button" className="btn ghost small" onClick={() => restoreCandidate(t.dishId)}>
                      恢复
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {wheelOpen && (
        <WheelSheet
          items={rows.map(({ c, shop, dish, best }) => ({
            id: c.dishId,
            name: dish.name,
            emoji: dish.emoji,
            hue: shop.hue,
            shopName: shop.name,
            total: best?.total ?? dish.price,
          }))}
          goLabel="放进购物车"
          onPick={setPickedId}
          onGo={(id) => {
            setWheelOpen(false);
            const row = rows.find((r) => r.c.dishId === id);
            if (row) candidateToCart(row.shop.id, row.dish.id);
          }}
          onClose={() => {
            setWheelOpen(false);
            if (pickedId) document.getElementById(`cand-${pickedId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }}
        />
      )}
    </div>
  );
}

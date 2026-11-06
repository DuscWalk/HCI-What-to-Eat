import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PLATFORM_LABEL } from './api/client';
import { CandidateDock, type DockCandidate, type DockCart } from './components/CandidateDock';
import { HomeTopBar } from './components/HomeTopBar';
import { IconHome, IconRecords, IconUser } from './components/Icons';
import { quoteSummary } from './components/Quotes';
import { useBrowseTimer } from './hooks/useBrowseTimer';
import { useHashRoute } from './hooks/useHashRoute';
import { mealAt } from './logic/meal';
import { bestSingle } from './logic/pricing';
import { RecommendPopup } from './overlays/RecommendPopup';
import { ReplaceSheet } from './overlays/ReplaceSheet';
import { WheelSheet } from './overlays/WheelSheet';
import { CartPage } from './pages/CartPage';
import { DonePage } from './pages/DonePage';
import { HomePage } from './pages/HomePage';
import { OrderPage } from './pages/OrderPage';
import { PayPage } from './pages/PayPage';
import { RecordsPage } from './pages/RecordsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ShopPage } from './pages/ShopPage';
import { ActionsContext, type Actions } from './store/actions';
import { DataProvider, useData } from './store/data';
import { useCartViews, useCoupons } from './store/selectors';
import { StoreProvider, useStore } from './store/store';
import { ToastHost, ToastProvider, useToast } from './store/toast';
import type { Platform } from './types';

export default function App() {
  return (
    <DataProvider>
      <StoreProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </StoreProvider>
    </DataProvider>
  );
}

const TABS = [
  { name: 'home', path: '/', label: '首页', Icon: IconHome },
  { name: 'records', path: '/records', label: '记录', Icon: IconRecords },
  { name: 'me', path: '/me', label: '个性化', Icon: IconUser },
] as const;

/** 与 CSS 保持一致：底部栏、首页顶部、店铺页顶部与底部操作栏的高度 */
const TABBAR_H = 58;
const HOME_TOP_H = 112;
const SHOP_HEADER_H = 72;
const SHOP_BAR_H = 76;

function Shell() {
  const { route, navigate, back } = useHashRoute();
  const { state, dispatch } = useStore();
  const { loading, shopById, dishById } = useData();
  const coupons = useCoupons();
  const cartViews = useCartViews();
  const toast = useToast();

  const stateRef = useRef(state);
  stateRef.current = state;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const meal = useMemo(() => mealAt(now, state.mealShift), [now, state.mealShift]);

  const [rec, setRec] = useState<{ auto: boolean } | null>(null);
  const [replaceFor, setReplaceFor] = useState<{ shopId: string; dishId: string } | null>(null);
  const [dockOpen, setDockOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const candidateIds = useMemo(() => new Set(state.candidates.map((c) => c.dishId)), [state.candidates]);
  const dishName = (id: string) => dishById.get(id)?.name ?? '这道菜';
  const shopName = (id: string) => shopById.get(id)?.name ?? '这家店';

  /* ---------- 候选 ---------- */

  const restoreMany = (dishIds: string[], mealKey: string) => {
    const s = stateRef.current;
    const room = Math.max(0, s.settings.candidateLimit - s.candidates.length);
    const ids = dishIds.slice(0, room);
    if (ids.length) dispatch({ type: 'restore', dishIds: ids, mealKey, at: Date.now() });
    if (ids.length < dishIds.length) toast.show({ text: `候选已满，只恢复了 ${ids.length} 个，其余在「最近移出」里` });
  };

  const clearCandidates = () => {
    const ids = stateRef.current.candidates.map((c) => c.dishId);
    if (!ids.length) return;
    dispatch({ type: 'remove', dishIds: ids, reason: 'cleared', at: Date.now() });
    toast.show({ text: `已清空 ${ids.length} 个候选`, action: '撤销', onAction: () => restoreMany(ids, meal.key) });
  };

  // F8：候选按餐次（或当天）自动清空，清空的进入「最近移出」，可恢复；购物车不受影响
  useEffect(() => {
    const { retention } = state.settings;
    if (retention === 'manual') return;
    const expired = state.candidates.filter((c) =>
      retention === 'meal' ? c.mealKey !== meal.key : !c.mealKey.startsWith(meal.dateKey),
    );
    if (!expired.length) return;
    const ids = expired.map((c) => c.dishId);
    dispatch({ type: 'remove', dishIds: ids, reason: 'expired', at: Date.now() });
    toast.show({
      text: `上一餐的 ${ids.length} 个候选已自动清空`,
      action: '恢复',
      onAction: () => restoreMany(ids, meal.key),
      duration: 6000,
    });
  }, [meal.key, meal.dateKey, state.settings.retention, state.candidates]);

  const addCandidate = (shopId: string, dishId: string) => {
    const s = stateRef.current;
    const limit = s.settings.candidateLimit;
    if (s.candidates.some((c) => c.dishId === dishId)) return;
    if (s.candidates.length >= limit) {
      toast.show({
        text: `亲，候选已满（${s.candidates.length}/${limit}）`,
        action: '换掉一个',
        onAction: () => setReplaceFor({ shopId, dishId }),
      });
      return;
    }
    dispatch({ type: 'add', candidate: { shopId, dishId, addedAt: Date.now(), mealKey: meal.key } });
    if (s.candidates.length + 1 === limit) {
      toast.show({
        text: `候选满了（${limit}/${limit}），可以比一比`,
        action: '展开浮窗',
        onAction: () => setDockOpen(true),
      });
    }
  };

  const removeCandidate = (dishId: string) => {
    dispatch({ type: 'remove', dishIds: [dishId], reason: 'manual', at: Date.now() });
    toast.show({
      text: `已移出候选「${dishName(dishId)}」`,
      action: '撤销',
      onAction: () => restoreMany([dishId], meal.key),
    });
  };

  const restoreCandidate = (dishId: string) => {
    const s = stateRef.current;
    const item = s.trash.find((t) => t.dishId === dishId);
    if (!item) return;
    if (s.candidates.length >= s.settings.candidateLimit) {
      setReplaceFor({ shopId: item.shopId, dishId });
      return;
    }
    dispatch({ type: 'restore', dishIds: [dishId], mealKey: meal.key, at: Date.now() });
  };

  const replace = (oldDishId: string) => {
    if (!replaceFor) return;
    const incoming = replaceFor;
    setReplaceFor(null);
    dispatch({ type: 'replace', oldDishId, candidate: { ...incoming, addedAt: Date.now(), mealKey: meal.key } });
    toast.show({
      text: `已用「${dishName(incoming.dishId)}」换掉「${dishName(oldDishId)}」`,
      action: '撤销',
      onAction: () => {
        const old = stateRef.current.trash.find((t) => t.dishId === oldDishId);
        if (!old) return;
        dispatch({
          type: 'replace',
          oldDishId: incoming.dishId,
          candidate: { shopId: old.shopId, dishId: old.dishId, addedAt: Date.now(), mealKey: meal.key },
        });
      },
    });
  };

  /* ---------- 购物车 ---------- */

  const cartOf = (shopId: string) => stateRef.current.carts.find((c) => c.shopId === shopId);
  const cartQty = (shopId: string, dishId: string) =>
    state.carts.find((c) => c.shopId === shopId)?.lines.find((l) => l.dishId === dishId)?.qty ?? 0;

  const cartAdd = (shopId: string, dishId: string) => dispatch({ type: 'cartAdd', shopId, dishId, at: Date.now() });

  const cartDec = (shopId: string, dishId: string) => {
    const snapshot = cartOf(shopId);
    const line = snapshot?.lines.find((l) => l.dishId === dishId);
    if (!snapshot || !line) return;
    dispatch({ type: 'cartSetQty', shopId, dishId, qty: line.qty - 1, at: Date.now() });
    if (line.qty === 1) {
      toast.show({
        text: `已从购物车移出「${dishName(dishId)}」`,
        action: '撤销',
        onAction: () => dispatch({ type: 'cartPut', cart: snapshot }),
      });
    }
  };

  const clearCart = (shopId: string) => {
    const snapshot = cartOf(shopId);
    if (!snapshot) return;
    dispatch({ type: 'cartClear', shopId });
    toast.show({
      text: `已清空「${shopName(shopId)}」的购物车`,
      action: '撤销',
      onAction: () => dispatch({ type: 'cartPut', cart: snapshot }),
    });
  };

  const goShop = (shopId: string, openCart = false) => navigate(`/shop/${shopId}${openCart ? '?cart=1' : ''}`);
  const openCheckout = (shopId: string, platform?: Platform) =>
    navigate(`/order/${shopId}${platform ? `?p=${platform}` : ''}`);

  const candidateToCart = (shopId: string, dishId: string) => {
    cartAdd(shopId, dishId);
    goShop(shopId, true);
  };

  const reorder = (shopId: string, dishId: string) => {
    if (!cartOf(shopId)?.lines.some((l) => l.dishId === dishId)) cartAdd(shopId, dishId);
    openCheckout(shopId);
  };

  /* ---------- 页面与浮窗 ---------- */

  // 换页时：收起推荐弹窗、浮窗和提示条
  useEffect(() => {
    if (route.name !== 'home') {
      setRec(null);
      setPeek(false);
    }
    setDockOpen(false);
    toast.dismiss();
  }, [route.name]);

  // N4 延后介入：浏览一段时间后，浮球旁探出一张小卡片，而不是直接弹窗
  const cancelAuto = useBrowseTimer(
    route.name === 'home' && !rec && !replaceFor && !dockOpen && !loading,
    state.settings.autoPopupSec,
    () => setPeek(true),
  );

  useEffect(() => {
    if (!peek) return;
    const id = window.setTimeout(() => setPeek(false), 15_000);
    return () => window.clearTimeout(id);
  }, [peek]);

  const openRecommend = (auto = false) => {
    cancelAuto();
    setPeek(false);
    setDockOpen(false);
    if (route.name !== 'home') navigate('/', { replace: true });
    setRec({ auto });
  };

  const setDock = useCallback((open: boolean) => {
    setDockOpen(open);
    if (open) {
      // 推荐弹窗打开时点浮球：收起弹窗，展开浮窗
      setRec(null);
      setPeek(false);
    }
  }, []);

  const hintDone = useCallback(() => dispatch({ type: 'dockHintSeen' }), [dispatch]);

  const actions: Actions = {
    meal,
    navigate,
    back,
    isCandidate: (dishId) => candidateIds.has(dishId),
    toggleCandidate: (shopId, dishId) =>
      candidateIds.has(dishId) ? removeCandidate(dishId) : addCandidate(shopId, dishId),
    removeCandidate,
    restoreCandidate,
    clearCandidates,
    cartQty,
    cartAdd,
    cartDec,
    clearCart,
    candidateToCart,
    reorder,
    goShop,
    openCheckout,
    openRecommend: () => openRecommend(false),
  };

  const dockCarts: DockCart[] = useMemo(
    () =>
      cartViews.map((v) => ({
        shopId: v.shop.id,
        shopName: v.shop.name,
        emoji: v.shop.emoji,
        hue: v.shop.hue,
        portions: v.portions,
        bestTotal: v.best?.total,
        bestLabel: v.best ? PLATFORM_LABEL[v.best.platform] : undefined,
        summary: quoteSummary(v.quotes, v.best),
      })),
    [cartViews],
  );

  const dockCandidates: DockCandidate[] = useMemo(
    () =>
      state.candidates.flatMap((c) => {
        const shop = shopById.get(c.shopId);
        const dish = dishById.get(c.dishId);
        if (!shop || !dish) return [];
        return [
          {
            dishId: dish.id,
            shopId: shop.id,
            name: dish.name,
            shopName: shop.name,
            emoji: dish.emoji,
            hue: shop.hue,
            total: bestSingle(shop, dish, coupons)?.total,
            inCart: state.carts.some((k) => k.shopId === shop.id && k.lines.some((l) => l.dishId === dish.id)),
          },
        ];
      }),
    [state.candidates, state.carts, shopById, dishById, coupons],
  );

  const showTabs = route.name === 'home' || route.name === 'records' || route.name === 'me';
  const showDock = !loading && (route.name === 'home' || route.name === 'shop');
  // 提示条的位置避开顶部入口、浮窗和底部栏
  const toastPlace =
    route.name === 'home' ? 'below-top' : route.name === 'shop' ? 'below-header' : showTabs ? 'above-tab' : 'bottom';

  return (
    <ActionsContext.Provider value={actions}>
      <div className="app" data-toast={toastPlace}>
        <HomePage active={route.name === 'home'} />
        {route.name === 'cart' && <CartPage />}
        {route.name === 'records' && <RecordsPage />}
        {route.name === 'me' && <SettingsPage />}
        {route.name === 'shop' && <ShopPage shopId={route.shopId} openCart={route.openCart} />}
        {route.name === 'order' && <OrderPage key={route.shopId} shopId={route.shopId} platform={route.platform} />}
        {route.name === 'pay' && <PayPage shopId={route.shopId} platform={route.platform} lines={route.lines} />}
        {route.name === 'done' && <DonePage shopId={route.shopId} platform={route.platform} lines={route.lines} />}

        {showTabs && (
          <nav className="tabbar" aria-label="主导航">
            {TABS.map(({ name, path, label, Icon }) => (
              <button
                key={name}
                type="button"
                className={route.name === name ? 'on' : ''}
                aria-current={route.name === name ? 'page' : undefined}
                onClick={() => navigate(path, { replace: true })}
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}

        {route.name === 'home' && (
          <HomeTopBar meal={meal} recOpen={Boolean(rec)} onRecommend={() => openRecommend(false)} />
        )}

        {rec && route.name === 'home' && <RecommendPopup auto={rec.auto} onClose={() => setRec(null)} />}

        {showDock && (
          <CandidateDock
            carts={dockCarts}
            candidates={dockCandidates}
            limit={state.settings.candidateLimit}
            open={dockOpen}
            onOpenChange={setDock}
            parked={Boolean(rec)}
            atBottom={route.name === 'shop'}
            topInset={route.name === 'home' ? HOME_TOP_H : SHOP_HEADER_H}
            bottomInset={route.name === 'home' ? TABBAR_H : SHOP_BAR_H}
            hint={!state.dockHintSeen && route.name === 'home'}
            onHintDone={hintDone}
            peek={peek && route.name === 'home'}
            onPeekOpen={() => openRecommend(true)}
            onPeekDismiss={() => setPeek(false)}
            showWheel={state.settings.showRandom}
            onWheel={() => setWheelOpen(true)}
            onCheckout={(shopId) => openCheckout(shopId)}
            onOpenShop={(shopId) => goShop(shopId)}
            onToCart={(item) => candidateToCart(item.shopId, item.dishId)}
            onRemove={removeCandidate}
            onCompare={() => navigate('/cart')}
          />
        )}

        {wheelOpen && (
          <WheelSheet
            items={dockCandidates.map((i) => ({
              id: i.dishId,
              name: i.name,
              emoji: i.emoji,
              hue: i.hue,
              shopName: i.shopName,
              total: i.total ?? 0,
            }))}
            goLabel="放进购物车"
            onPick={() => {}}
            onGo={(id) => {
              setWheelOpen(false);
              const item = dockCandidates.find((i) => i.dishId === id);
              if (item) candidateToCart(item.shopId, item.dishId);
            }}
            onClose={() => setWheelOpen(false)}
          />
        )}
        {replaceFor && <ReplaceSheet incoming={replaceFor} onReplace={replace} onClose={() => setReplaceFor(null)} />}
        <div id="overlay-root" />
        <ToastHost />
      </div>
    </ActionsContext.Provider>
  );
}

import Fuse from 'fuse.js';
import { useMemo, useState } from 'react';
import { PLATFORM_LABEL } from '../api/client';
import { IconChevron, IconSearch } from '../components/Icons';
import { CandidateToggle, Thumb } from '../components/ui';
import { avoidedBy, browseScore, orderDishes, type TastePrefs } from '../logic/browse';
import { cheapestDishTotal, fastestMin, lowestDeliveryFee } from '../logic/pricing';
import { useActions } from '../store/actions';
import { useData } from '../store/data';
import { useCoupons, useHistoryStats } from '../store/selectors';
import { useStore } from '../store/store';
import type { Shop } from '../types';

const CATEGORY_EMOJI: Record<string, string> = {
  全部: '🍽️',
  盖饭快餐: '🍱',
  川湘菜: '🌶️',
  家常菜: '🥘',
  东北菜: '🍖',
  粤菜: '🍲',
  汤粥: '🥣',
  轻食: '🥗',
  东南亚菜: '🍛',
  汉堡炸鸡: '🍔',
  西餐: '🍕',
  粉面: '🍜',
  小吃点心: '🥟',
  麻辣烫: '🍢',
  烧烤: '🍢',
  奶茶饮品: '🧋',
  甜品蛋糕: '🍰',
};

/** 首页卡片里最多露出几道菜，其余在店铺页看 */
const CARD_DISHES = 6;

/**
 * 搜索用 Fuse.js 做模糊匹配：店名、类别、标签（如「工作餐」「练后餐」）、菜名、口味都能搜到。
 * threshold 偏严，避免两三个字的中文词匹配到不相干的店。
 */
const SEARCH_OPTIONS = {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'tags', weight: 2 },
    { name: 'category', weight: 2 },
    { name: 'dishes.name', weight: 1.5 },
    { name: 'dishes.tastes', weight: 1 },
    { name: 'dishes.tags', weight: 0.5 },
  ],
  threshold: 0.3,
  ignoreLocation: true,
};

type Sort = 'default' | 'fast' | 'cheap' | 'rating';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'default', label: '综合' },
  { value: 'fast', label: '送达快' },
  { value: 'cheap', label: '实付低' },
  { value: 'rating', label: '评分高' },
];

const NO_PREFS: TastePrefs = { likes: [], avoids: [] };

/**
 * 首页浏览流（F1）：这里是比较阶段，菜品上只有「候选」开关；
 * 加购物车在店铺页里进行（外卖平台的信息流也不能直接加购）。
 */
export function HomePage({ active }: { active: boolean }) {
  const { shops, loading } = useData();
  const { state } = useStore();
  const { navigate } = useActions();
  const history = useHistoryStats();
  const coupons = useCoupons();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [sort, setSort] = useState<Sort>('default');
  const [onlyOrdered, setOnlyOrdered] = useState(false);

  const { useTastePrefs, likes, avoids } = state.settings;
  const prefs = useMemo<TastePrefs>(() => (useTastePrefs ? { likes, avoids } : NO_PREFS), [useTastePrefs, likes, avoids]);

  const categories = useMemo(() => ['全部', ...new Set(shops.map((s) => s.category))], [shops]);
  const fuse = useMemo(() => new Fuse(shops, SEARCH_OPTIONS), [shops]);
  const orderedShopCount = useMemo(() => shops.filter((s) => history.has(s.id)).length, [shops, history]);
  const showOrderedFilter = orderedShopCount > 0;
  const cartCount = useMemo(
    () => new Map(state.carts.map((c) => [c.shopId, c.lines.reduce((sum, l) => sum + l.qty, 0)])),
    [state.carts],
  );

  const list = useMemo(() => {
    const q = query.trim();
    // 有搜索词时先按相关度排，「综合」排序下保持这个顺序
    const matched = q ? fuse.search(q).map((r) => r.item) : shops;
    const filtered = matched.filter(
      (s) => (category === '全部' || s.category === category) && (!onlyOrdered || !showOrderedFilter || history.has(s.id)),
    );
    const sorted = [...filtered];
    if (sort === 'fast') sorted.sort((a, b) => fastestMin(a) - fastestMin(b));
    if (sort === 'cheap') sorted.sort((a, b) => cheapestDishTotal(a, coupons) - cheapestDishTotal(b, coupons));
    if (sort === 'rating') sorted.sort((a, b) => b.rating - a.rating);
    if (sort === 'default' && !q) sorted.sort((a, b) => browseScore(b, prefs) - browseScore(a, prefs));
    return sorted;
  }, [shops, fuse, query, category, sort, onlyOrdered, showOrderedFilter, history, prefs, coupons]);

  const resetFilters = () => {
    setQuery('');
    setCategory('全部');
    setOnlyOrdered(false);
  };

  return (
    // 首页常驻挂载、只做隐藏，返回时保留滚动位置和筛选状态
    <div className={`page home${active ? '' : ' inactive'}`} aria-hidden={!active}>
      <div className="home-search">
        <label className="search">
          <IconSearch size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜店铺、菜品，比如「练后餐」"
            enterKeyHint="search"
          />
        </label>
      </div>

      <nav className="cats" aria-label="分类">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            className={`cat${c === category ? ' on' : ''}`}
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
          >
            <span className="cat-icon" aria-hidden="true">
              {CATEGORY_EMOJI[c] ?? '🍽️'}
            </span>
            <span>{c}</span>
          </button>
        ))}
      </nav>

      <div className="sortbar">
        {SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`sort${sort === s.value ? ' on' : ''}`}
            aria-pressed={sort === s.value}
            onClick={() => setSort(s.value)}
          >
            {s.label}
          </button>
        ))}
        {showOrderedFilter && (
          <button
            type="button"
            className={`sort toggle${onlyOrdered ? ' on' : ''}`}
            aria-pressed={onlyOrdered}
            onClick={() => setOnlyOrdered((v) => !v)}
          >
            点过的店 {orderedShopCount}
          </button>
        )}
      </div>

      {sort === 'default' && prefs.likes.length > 0 && (
        <p className="taste-hint">
          按你的长期口味排序：{prefs.likes.join('、')}
          <button type="button" className="btn text small" onClick={() => navigate('/me', { replace: true })}>
            修改
          </button>
        </p>
      )}

      <section className="feed" aria-busy={loading}>
        {loading &&
          Array.from({ length: 4 }, (_, i) => (
            <div className="shop-card skeleton" key={i}>
              <div className="sk sk-thumb" />
              <div className="sk-lines">
                <div className="sk sk-line w60" />
                <div className="sk sk-line w80" />
                <div className="sk sk-line w40" />
              </div>
            </div>
          ))}
        {!loading &&
          list.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              prefs={prefs}
              orderCount={history.get(shop.id)?.orderCount}
              inCart={cartCount.get(shop.id)}
            />
          ))}
        {!loading && list.length === 0 && (
          <div className="empty">
            <div className="empty-emoji">🔍</div>
            <p>没有找到相关的店</p>
            <button type="button" className="btn ghost" onClick={resetFilters}>
              清除筛选
            </button>
          </div>
        )}
        {!loading && list.length > 0 && <p className="feed-end">没有更多了 · 拿不定主意可以点顶部的「帮我挑」</p>}
      </section>
    </div>
  );
}

function ShopCard({ shop, prefs, orderCount, inCart }: { shop: Shop; prefs: TastePrefs; orderCount?: number; inCart?: number }) {
  const { goShop, toggleCandidate, isCandidate } = useActions();
  const dishes = orderDishes(shop.dishes, prefs).slice(0, CARD_DISHES);
  return (
    <article className="shop-card">
      <button type="button" className="shop-head" onClick={() => goShop(shop.id)}>
        <Thumb emoji={shop.emoji} src={shop.image} hue={shop.hue} size={60} />
        <div className="shop-info">
          <div className="shop-name">
            <span>{shop.name}</span>
            <IconChevron size={16} className="shop-chev" />
          </div>
          <div className="shop-meta">
            <span className="star">★ {shop.rating.toFixed(1)}</span>
            <span>月售 {shop.monthlySales}+</span>
            <span>{shop.distanceKm}km</span>
          </div>
          <div className="shop-meta">
            <span>{fastestMin(shop)} 分钟起</span>
            <span>配送 ¥{lowestDeliveryFee(shop)} 起</span>
          </div>
          <div className="shop-tags">
            {shop.listings.map((l) => (
              <span className={`tag plat plat-${l.platform}`} key={l.platform}>
                {PLATFORM_LABEL[l.platform]}
              </span>
            ))}
            {inCart ? <span className="tag in-cart">购物车 {inCart} 件</span> : null}
            {orderCount ? <span className="tag ordered">点过 {orderCount} 次</span> : null}
            {shop.isNewShop && <span className="tag fresh">新店</span>}
          </div>
        </div>
      </button>
      <div className="dish-row">
        {dishes.map((dish) => {
          const avoided = avoidedBy(dish, prefs);
          return (
            <div className={`dish-mini${avoided.length ? ' avoided' : ''}`} key={dish.id}>
              <div className="dish-mini-thumb">
                <Thumb emoji={dish.emoji} src={dish.image} hue={shop.hue} size={84} zoom={{ src: dish.imageLarge, title: dish.name, sub: shop.name }} />
                {avoided.length > 0 ? (
                  <span className="mini-avoid">含{avoided.join('、')}</span>
                ) : (
                  dish.isNew && <span className="mini-new">新品</span>
                )}
              </div>
              <div className="dish-mini-name">{dish.name}</div>
              <div className="dish-mini-foot">
                <span className="price">¥{dish.price}</span>
                <CandidateToggle
                  compact
                  on={isCandidate(dish.id)}
                  label={dish.name}
                  onToggle={() => toggleCandidate(shop.id, dish.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

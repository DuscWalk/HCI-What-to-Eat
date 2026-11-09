import { Sheet, Thumb } from '../components/ui';
import { bestSingle, fastestMin, yuan } from '../logic/pricing';
import { useData } from '../store/data';
import { useCoupons } from '../store/selectors';
import { useStore } from '../store/store';

/** 候选满额时（F7）：选一个替换，而不是继续堆积。 */
export function ReplaceSheet({
  incoming,
  onReplace,
  onClose,
}: {
  incoming: { shopId: string; dishId: string };
  onReplace: (oldDishId: string) => void;
  onClose: () => void;
}) {
  const { shopById, dishById } = useData();
  const { state } = useStore();
  const coupons = useCoupons();
  const price = (shop: Parameters<typeof bestSingle>[0], dish: Parameters<typeof bestSingle>[1]) =>
    bestSingle(shop, dish, coupons)?.total ?? dish.price;
  const newShop = shopById.get(incoming.shopId);
  const newDish = dishById.get(incoming.dishId);
  if (!newShop || !newDish) return null;

  return (
    <Sheet title="候选满了，换掉哪一个？" onClose={onClose}>
      <p className="sheet-sub">
        要加入：<b>{newDish.name}</b> · {newShop.name} · 单点最低 {yuan(price(newShop, newDish))}
      </p>
      <ul className="replace-list">
        {state.candidates.map((c) => {
          const shop = shopById.get(c.shopId);
          const dish = dishById.get(c.dishId);
          if (!shop || !dish) return null;
          return (
            <li key={c.dishId}>
              <button type="button" className="replace-item" onClick={() => onReplace(c.dishId)}>
                <Thumb emoji={dish.emoji} src={dish.image} hue={shop.hue} size={44} />
                <span className="replace-text">
                  <span className="replace-name">{dish.name}</span>
                  <span className="replace-meta">
                    {shop.name} · 单点最低 {yuan(price(shop, dish))} · {fastestMin(shop)} 分钟起
                  </span>
                </span>
                <span className="replace-cta">换掉</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="sheet-actions">
        <button type="button" className="btn ghost wide" onClick={onClose}>
          先不加了
        </button>
      </div>
    </Sheet>
  );
}

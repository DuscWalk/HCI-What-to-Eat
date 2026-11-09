import { useCallback, useMemo, useState } from 'react';
import { PLATFORM_LABEL } from '../api/client';
import { IconChevron, IconRefresh } from '../components/Icons';
import { CandidateToggle, Chip, Thumb, useEscape } from '../components/ui';
import { yuan } from '../logic/pricing';
import { KIND_LABEL, recommend } from '../logic/recommend';
import { useActions } from '../store/actions';
import { useData } from '../store/data';
import { useCoupons, useHistoryStats } from '../store/selectors';
import { EMPTY_CONDITIONS, useStore } from '../store/store';
import { useToast } from '../store/toast';
import { TASTES, type Conditions, type Taste } from '../types';

const BUDGETS: { value: number | null; label: string }[] = [
  { value: null, label: '不限' },
  { value: 20, label: '¥20 内' },
  { value: 30, label: '¥30 内' },
  { value: 40, label: '¥40 内' },
];

const TIMES: { value: number | null; label: string }[] = [
  { value: null, label: '不限' },
  { value: 25, label: '25 分钟' },
  { value: 30, label: '30 分钟' },
  { value: 40, label: '40 分钟' },
];

/**
 * 推荐弹窗（F2 + F3）：非全屏，背景调灰；点灰色区域返回原页面。
 * 本次条件以可跳过的标签放在弹窗顶部，改动后结果即时更新。
 */
export function RecommendPopup({ auto, onClose }: { auto: boolean; onClose: () => void }) {
  const { shops } = useData();
  const history = useHistoryStats();
  const coupons = useCoupons();
  const { state, dispatch } = useStore();
  const { toggleCandidate, isCandidate, goShop } = useActions();
  const toast = useToast();
  const { conditions, settings } = state;
  const [seen, setSeen] = useState<string[]>([]);

  useEscape(onClose);

  const run = useCallback(
    (exclude: string[]) =>
      recommend({
        shops,
        history,
        coupons,
        settings,
        conditions,
        count: settings.recommendCount,
        excludeShopIds: new Set(exclude),
      }),
    [shops, history, settings, conditions, coupons],
  );

  const items = useMemo(() => run(seen), [run, seen]);
  const hasConditions = conditions.budget !== null || conditions.maxMinutes !== null || conditions.tastes.length > 0;

  const setConditions = (patch: Partial<Conditions>) => {
    setSeen([]);
    dispatch({ type: 'conditions', conditions: { ...conditions, ...patch } });
  };

  const toggleTaste = (t: Taste) =>
    setConditions({
      tastes: conditions.tastes.includes(t) ? conditions.tastes.filter((x) => x !== t) : [...conditions.tastes, t],
    });

  const nextBatch = () => {
    const exclude = [...seen, ...items.map((i) => i.shop.id)];
    if (run(exclude).length === 0) {
      setSeen([]);
      toast.show({ text: '符合条件的都看过一遍了，从头再来' });
    } else {
      setSeen(exclude);
    }
  };

  return (
    <>
      <div className="scrim rec-scrim" onClick={onClose} aria-hidden="true" />
      <section className="rec-pop" role="dialog" aria-modal="true" aria-labelledby="rec-title">
        <div className="rec-head">
          {auto && <p className="rec-eyebrow">逛了一会儿了，看看这几个？</p>}
          <h2 id="rec-title">{items.length ? `帮你挑了 ${items.length} 个` : '没有完全符合的'}</h2>
          <p className="rec-hint">点空白处继续浏览</p>
        </div>

        <div className="rec-body">
          <div className="cond" aria-label="本次条件">
            <div className="cond-row">
              <span className="cond-label">预算</span>
              <div className="cond-chips">
                {BUDGETS.map((b) => (
                  <Chip key={b.label} on={conditions.budget === b.value} onClick={() => setConditions({ budget: b.value })}>
                    {b.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="cond-row">
              <span className="cond-label">送达</span>
              <div className="cond-chips">
                {TIMES.map((t) => (
                  <Chip key={t.label} on={conditions.maxMinutes === t.value} onClick={() => setConditions({ maxMinutes: t.value })}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="cond-row">
              <span className="cond-label">口味</span>
              <div className="cond-chips">
                {TASTES.map((t) => (
                  <Chip key={t} on={conditions.tastes.includes(t)} onClick={() => toggleTaste(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {items.length > 0 ? (
            <ul className="rec-list">
              {items.map((item) => {
                const kindLabel = KIND_LABEL[item.kind];
                return (
                  <li className="rec-item" key={item.dish.id}>
                    <Thumb
                      emoji={item.dish.emoji}
                      src={item.dish.image}
                      hue={item.shop.hue}
                      size={60}
                      zoom={{ src: item.dish.imageLarge, title: item.dish.name, sub: item.shop.name }}
                    />
                    <div className="rec-main">
                      <div className="rec-title">
                        <span className="rec-dish">{item.dish.name}</span>
                        {kindLabel && <span className={`kind kind-${item.kind}`}>{kindLabel}</span>}
                      </div>
                      <button
                        type="button"
                        className="link-shop"
                        onClick={() => goShop(item.shop.id)}
                      >
                        {item.shop.name}
                        <IconChevron size={13} />
                      </button>
                      <div className="rec-facts">
                        <span className="pay">
                          最低 <b>{yuan(item.price.total)}</b> · {PLATFORM_LABEL[item.price.platform]}
                        </span>
                        <span>{item.price.deliveryMin} 分钟</span>
                        <span>★ {item.shop.rating.toFixed(1)}</span>
                      </div>
                    </div>
                    <CandidateToggle
                      on={isCandidate(item.dish.id)}
                      label={item.dish.name}
                      onToggle={() => toggleCandidate(item.shop.id, item.dish.id)}
                    />
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rec-empty">
              <p>这些条件下没有合适的菜，放宽一点试试？</p>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  setSeen([]);
                  dispatch({ type: 'conditions', conditions: EMPTY_CONDITIONS });
                }}
              >
                清除本次条件
              </button>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="rec-foot">
            <button type="button" className="btn ghost small" onClick={nextBatch}>
              <IconRefresh size={16} /> 换一批
            </button>
            {hasConditions && (
              <button
                type="button"
                className="btn text small"
                onClick={() => {
                  setSeen([]);
                  dispatch({ type: 'conditions', conditions: EMPTY_CONDITIONS });
                }}
              >
                清除条件
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}

import type { ReactNode } from 'react';
import { Chip, PageHeader, Segmented, Switch } from '../components/ui';
import { mealTitle } from '../logic/meal';
import { PLATFORM_LABEL } from '../api/client';
import { useActions } from '../store/actions';
import { useData } from '../store/data';
import { CANDIDATE_LIMIT_RANGE, useStore } from '../store/store';
import { useToast } from '../store/toast';
import { AVOIDS, TASTES, type Retention, type Settings } from '../types';

function Row({ title, desc, children, stack }: { title: string; desc?: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`set-row${stack ? ' stack' : ''}`}>
      <div className="set-text">
        <div className="set-title">{title}</div>
        {desc && <div className="set-desc">{desc}</div>}
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

/** 个性化设置页（F13）：长期偏好与推荐行为，设置即时生效。 */
export function SettingsPage() {
  const { state, dispatch } = useStore();
  const { meal, clearCandidates } = useActions();
  const toast = useToast();
  const s = state.settings;
  const { coupons } = useData();
  const couponText = coupons
    .map((c) => `${PLATFORM_LABEL[c.platform]}${c.threshold ? `满${c.threshold}减${c.off}` : `无门槛${c.off}元`}`)
    .join('、');
  const set = (patch: Partial<Settings>) => dispatch({ type: 'settings', patch });
  const toggleIn = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <div className="page settings">
      <PageHeader title="个性化" sub="改动即时生效" />

      <section className="set-card">
        <h2>长期口味</h2>
        <Row title="喜欢的口味" desc="首页按这些口味排序；推荐弹窗里没选本次口味时也会参考" stack>
          <div className="chips-wrap">
            {TASTES.map((t) => (
              <Chip key={t} on={s.likes.includes(t)} onClick={() => set({ likes: toggleIn(s.likes, t) })}>
                {t}
              </Chip>
            ))}
          </div>
        </Row>
        <Row title="忌口" desc="推荐里不出现，首页里排到店内最后并标出" stack>
          <div className="chips-wrap">
            {AVOIDS.map((a) => (
              <Chip key={a} tone="avoid" on={s.avoids.includes(a)} onClick={() => set({ avoids: toggleIn(s.avoids, a) })}>
                {a}
              </Chip>
            ))}
          </div>
        </Row>
      </section>

      <section className="set-card">
        <h2>推荐</h2>
        <Row title="推荐弹窗自动弹出" desc="在首页浏览这么久还没决定时，弹出一次" stack>
          <Segmented
            label="自动弹出时机"
            value={s.autoPopupSec}
            onChange={(v) => set({ autoPopupSec: v })}
            options={[
              { value: 0, label: '不自动' },
              { value: 20, label: '20 秒' },
              { value: 60, label: '1 分钟' },
              { value: 180, label: '3 分钟' },
            ]}
          />
        </Row>
        <Row title="每次推荐">
          <Segmented
            label="每次推荐数量"
            value={s.recommendCount}
            onChange={(v) => set({ recommendCount: v })}
            options={[3, 4, 5].map((n) => ({ value: n, label: `${n} 个` }))}
          />
        </Row>
      </section>

      <section className="set-card">
        <h2>候选</h2>
        <Row title="候选上限" desc="3–5 道菜，满了以后需要换掉一个才能再加；购物车不受这个限制">
          <div className="stepper">
            <button
              type="button"
              aria-label="减少上限"
              disabled={s.candidateLimit <= CANDIDATE_LIMIT_RANGE[0]}
              onClick={() => set({ candidateLimit: s.candidateLimit - 1 })}
            >
              −
            </button>
            <span aria-live="polite">{s.candidateLimit}</span>
            <button
              type="button"
              aria-label="增加上限"
              disabled={s.candidateLimit >= CANDIDATE_LIMIT_RANGE[1]}
              onClick={() => set({ candidateLimit: s.candidateLimit + 1 })}
            >
              +
            </button>
          </div>
        </Row>
        <Row title="候选保留" desc="清空的候选可在候选页「最近移出」中恢复" stack>
          <Segmented<Retention>
            label="候选保留时长"
            value={s.retention}
            onChange={(v) => set({ retention: v })}
            options={[
              { value: 'meal', label: '按餐次' },
              { value: 'day', label: '当天' },
              { value: 'manual', label: '手动清空' },
            ]}
          />
        </Row>
        <Row title="显示「转盘」" desc="候选页顶部的随机挑选，样式不显眼">
          <Switch checked={s.showRandom} label="显示转盘" onChange={(v) => set({ showRandom: v })} />
        </Row>
        <Row title="清空当前候选">
          <button
            type="button"
            className="btn ghost small"
            disabled={state.candidates.length === 0}
            onClick={clearCandidates}
          >
            清空 {state.candidates.length || ''}
          </button>
        </Row>
      </section>

      <section className="set-card">
        <h2>数据授权</h2>
        <Row title="使用历史订单与选择记录" desc="用于识别常点的店；关闭后推荐只看本次条件和口味">
          <Switch checked={s.useHistory} label="使用历史订单与选择记录" onChange={(v) => set({ useHistory: v })} />
        </Row>
        <Row title="使用口味偏好与忌口">
          <Switch checked={s.useTastePrefs} label="使用口味偏好与忌口" onChange={(v) => set({ useTastePrefs: v })} />
        </Row>
        <Row title="使用各平台优惠券" desc={`用于算各平台的最低实付。${couponText}`}>
          <Switch checked={s.useCoupons} label="使用各平台优惠券" onChange={(v) => set({ useCoupons: v })} />
        </Row>
      </section>

      <section className="set-card demo">
        <h2>演示工具 · 仅原型</h2>
        <Row title="模拟进入下一餐" desc={`当前：${mealTitle(meal)}`}>
          <button type="button" className="btn ghost small" onClick={() => dispatch({ type: 'shiftMeal' })}>
            下一餐
          </button>
        </Row>
        <Row title="重置演示数据" desc="恢复初始的记录、候选和设置">
          <button
            type="button"
            className="btn ghost small"
            onClick={() => {
              dispatch({ type: 'reset' });
              toast.show({ text: '已重置演示数据' });
            }}
          >
            重置
          </button>
        </Row>
      </section>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { yuan } from '../logic/pricing';
import { IconBag, IconCartPlus, IconChevron, IconClose, IconWheel } from './Icons';
import { Thumb } from './ui';

export interface DockCart {
  shopId: string;
  shopName: string;
  emoji: string;
  hue: number;
  portions: number;
  /** 各平台中最低的含券实付；缺菜时为空 */
  bestTotal?: number;
  bestLabel?: string;
  summary: string;
}

export interface DockCandidate {
  dishId: string;
  shopId: string;
  name: string;
  shopName: string;
  emoji: string;
  hue: number;
  /** 单点最低实付 */
  total?: number;
  inCart: boolean;
}

const BALL_W = 52;
const BALL_H = 64;
const EDGE = 6;
/** 往屏幕中心拉多远算完全展开 */
const OPEN_DIST = 140;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Drag {
  kind: 'ball' | 'panel';
  mode: 'pending' | 'expand' | 'move' | 'collapse' | 'none';
  x0: number;
  y0: number;
  frac0: number;
  lastX: number;
  lastY: number;
  lastT: number;
  v: number;
}

/**
 * 浮窗：默认收在屏幕右侧边缘的浮球；点一下或按住往屏幕中心拉，展开成右下角的小窗。
 * 小窗上半部分是各家店的购物车（直接显示各平台中最低的含券实付），下半部分是候选。
 * 小窗不加遮罩，首页照常滚动；上下拖动浮球可以换位置。
 */
export function CandidateDock({
  carts,
  candidates,
  limit,
  open,
  onOpenChange,
  parked,
  atBottom = false,
  topInset,
  bottomInset,
  hint,
  onHintDone,
  peek,
  onPeekOpen,
  onPeekDismiss,
  showWheel,
  onWheel,
  onCheckout,
  onOpenShop,
  onToCart,
  onRemove,
  onCompare,
}: {
  carts: DockCart[];
  candidates: DockCandidate[];
  limit: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 推荐弹窗打开时，浮球停到右下角，给弹窗让位 */
  parked: boolean;
  /** 默认停在右下角（店铺页：避开右侧那一列加购按钮） */
  atBottom?: boolean;
  topInset: number;
  bottomInset: number;
  hint: boolean;
  onHintDone: () => void;
  peek: boolean;
  onPeekOpen: () => void;
  onPeekDismiss: () => void;
  showWheel: boolean;
  onWheel: () => void;
  onCheckout: (shopId: string) => void;
  onOpenShop: (shopId: string) => void;
  onToCart: (item: DockCandidate) => void;
  onRemove: (dishId: string) => void;
  onCompare: () => void;
}) {
  const total = carts.length + candidates.length;
  const ballRef = useRef<HTMLButtonElement>(null);
  const [appH, setAppH] = useState(700);
  const [frac, setFrac] = useState(0.6);
  const [progress, setProgress] = useState<number | null>(null);
  const progressRef = useRef<number | null>(null);
  const drag = useRef<Drag | null>(null);

  const setP = (p: number | null) => {
    progressRef.current = p;
    setProgress(p);
  };

  useLayoutEffect(() => {
    const host = ballRef.current?.offsetParent as HTMLElement | null;
    if (!host) return;
    const measure = () => setAppH(host.clientHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // 页面滚动时浮球缩进屏幕边缘、变半透明，少挡内容；停下后再回来
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    const host = ballRef.current?.offsetParent as HTMLElement | null;
    if (!host) return;
    let timer: number | undefined;
    const onScroll = (e: Event) => {
      if ((e.target as HTMLElement).closest?.('.dock-panel, .rec-pop')) return;
      setTucked(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTucked(false), 700);
    };
    host.addEventListener('scroll', onScroll, true);
    return () => {
      host.removeEventListener('scroll', onScroll, true);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!hint || open) return;
    const id = window.setTimeout(onHintDone, 7000);
    return () => window.clearTimeout(id);
  }, [hint, open, onHintDone]);

  const minTop = topInset + 10;
  const maxTop = appH - bottomInset - 12 - BALL_H;
  const ballTop = parked || atBottom ? maxTop : clamp(frac * appH - BALL_H / 2, minTop, maxTop);
  // 小窗高度跟着内容走：标题 58 + 底栏 56 + 两个分组标题 + 每行 57，最高约六成屏
  const panelH = Math.min(460, appH * 0.6, 58 + 56 + 2 * 30 + Math.max(carts.length, 1) * 57 + Math.max(candidates.length, 1) * 57);
  const panelTop = appH - bottomInset - 10 - panelH;
  const originY = ballTop + BALL_H / 2 - panelTop;

  const visual = progress ?? (open ? 1 : 0);
  const dragging = progress !== null;

  const start = (e: PointerEvent<HTMLElement>, kind: Drag['kind']) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const t = performance.now();
    drag.current = { kind, mode: 'pending', x0: e.clientX, y0: e.clientY, frac0: frac, lastX: e.clientX, lastY: e.clientY, lastT: t, v: 0 };
  };

  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (d.mode === 'pending') {
      if (Math.hypot(dx, dy) < 8) return;
      if (d.kind === 'ball') {
        d.mode = Math.abs(dy) > Math.abs(dx) * 1.2 && !parked && !atBottom ? 'move' : dx < 0 ? 'expand' : 'none';
        onHintDone();
      } else {
        d.mode = 'collapse';
      }
    }
    const t = performance.now();
    const dt = Math.max(1, t - d.lastT);
    if (d.mode === 'collapse') d.v = Math.max(e.clientX - d.lastX, e.clientY - d.lastY) / dt;
    else d.v = (e.clientX - d.lastX) / dt;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    d.lastT = t;

    if (d.mode === 'expand') setP(clamp(-dx / OPEN_DIST, 0, 1));
    if (d.mode === 'move') setFrac(clamp(d.frac0 + dy / appH, 0.1, 0.95));
    if (d.mode === 'collapse') setP(clamp(1 - Math.max(dx, dy, 0) / 160, 0, 1));
  };

  const end = (cancelled: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const p = progressRef.current ?? 0;
    if (!cancelled) {
      if (d.kind === 'ball' && d.mode === 'pending') {
        onHintDone();
        onOpenChange(true);
      }
      if (d.mode === 'expand') onOpenChange(p > 0.4 || d.v < -0.45);
      if (d.mode === 'collapse') onOpenChange(!(p < 0.6 || d.v > 0.45));
    }
    setP(null);
  };

  const ballStyle: CSSProperties = {
    top: ballTop,
    right: EDGE,
    opacity: dragging ? 1 - visual : open ? 0 : tucked && !parked ? 0.55 : 1,
    transform:
      dragging && drag.current?.kind === 'ball'
        ? `translateX(${-visual * 36}px)`
        : tucked && !parked && !open
          ? 'translateX(30px)'
          : undefined,
    transition: dragging ? 'none' : undefined,
  };

  const panelStyle: CSSProperties = {
    height: panelH,
    bottom: bottomInset + 10,
    transformOrigin: `calc(100% - ${EDGE + BALL_W / 2 - 8}px) ${originY}px`,
    ...(dragging
      ? { transform: `scale(${0.3 + 0.7 * visual})`, opacity: visual, visibility: 'visible', transition: 'none' }
      : null),
  };

  const bubbleStyle: CSSProperties = { top: ballTop + BALL_H / 2, right: EDGE + BALL_W + 10 };
  const showBubbles = !open && !dragging && !tucked;

  return (
    <>
      <button
        ref={ballRef}
        type="button"
        className={`dock-ball${parked ? ' parked' : ''}${open ? ' hidden' : ''}`}
        style={ballStyle}
        aria-label={`浮窗：${carts.length} 个购物车、${candidates.length} 个候选，点击或往左拉展开`}
        aria-expanded={open}
        onPointerDown={(e) => start(e, 'ball')}
        onPointerMove={move}
        onPointerUp={() => end(false)}
        onPointerCancel={() => end(true)}
        onClick={(e) => {
          // 键盘操作（没有指针事件）时也能展开
          if (e.detail === 0) onOpenChange(true);
        }}
      >
        <span className="dock-grip" aria-hidden="true" />
        <IconBag size={22} />
        <span className={`dock-count${total ? '' : ' zero'}`} key={total}>
          {total}
        </span>
      </button>

      {showBubbles && peek && (
        <div className="dock-bubble peek" style={bubbleStyle} role="status">
          <span className="peek-eyebrow">逛了一会儿了</span>
          <b>要不要帮你挑几个？</b>
          <div className="peek-actions">
            <button type="button" className="btn text small" onClick={onPeekDismiss}>
              不用
            </button>
            <button type="button" className="btn primary small" onClick={onPeekOpen}>
              看看
            </button>
          </div>
        </div>
      )}
      {showBubbles && !peek && hint && !parked && (
        <div className="dock-bubble hint" style={bubbleStyle} role="status" onClick={onHintDone}>
          点一下，或按住往左拉
          <br />
          边逛边看购物车和候选
        </div>
      )}

      <section
        className={`dock-panel${open ? ' open' : ''}${dragging ? ' dragging' : ''}`}
        style={panelStyle}
        aria-label="购物车与候选浮窗"
        aria-hidden={!open && !dragging}
      >
        <header
          className="dock-head"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            start(e, 'panel');
          }}
          onPointerMove={move}
          onPointerUp={() => end(false)}
          onPointerCancel={() => end(true)}
        >
          <span className="dock-grabber" aria-hidden="true" />
          <div className="dock-title">
            <b>这顿的选择</b>
          </div>
          <button type="button" className="icon-btn dock-collapse" aria-label="收起浮窗" onClick={() => onOpenChange(false)}>
            <IconChevron size={18} />
          </button>
        </header>

        <div className="dock-body">
          <div className="dock-group">
            购物车 <span>按各平台最低实付</span>
          </div>
          {carts.length === 0 ? (
            <p className="dock-empty-row">进店点 + 加菜，这里直接显示各平台算上券的最低价</p>
          ) : (
            <ul className="dock-list">
              {carts.map((c) => (
                <li key={c.shopId} className="dock-row">
                  <button type="button" className="dock-row-main" onClick={() => onCheckout(c.shopId)}>
                    <Thumb emoji={c.emoji} hue={c.hue} size={40} />
                    <span className="dock-row-text">
                      <b>
                        {c.shopName}
                        <em className="dock-row-qty"> {c.portions} 件</em>
                      </b>
                      <small>{c.bestLabel ? `${c.bestLabel} · ${c.summary}` : c.summary}</small>
                    </span>
                    <span className="dock-row-price">{c.bestTotal !== undefined ? yuan(c.bestTotal) : '—'}</span>
                    <IconChevron size={14} className="dock-row-go" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="dock-group">
            候选 <span>{candidates.length}/{limit}</span>
          </div>
          {candidates.length === 0 ? (
            <p className="dock-empty-row">在列表里点书签加入候选，跨店比一比</p>
          ) : (
            <ul className="dock-list">
              {candidates.map((item) => (
                <li key={item.dishId} className="dock-row">
                  <button type="button" className="dock-row-main" onClick={() => onOpenShop(item.shopId)}>
                    <Thumb emoji={item.emoji} hue={item.hue} size={40} />
                    <span className="dock-row-text">
                      <b>{item.name}</b>
                      <small>
                        {item.shopName}
                        {item.total !== undefined ? ` · 单点 ${yuan(item.total)} 起` : ''}
                      </small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`icon-btn dock-row-cart${item.inCart ? ' on' : ''}`}
                    aria-label={`放进购物车：${item.name}`}
                    onClick={() => onToCart(item)}
                  >
                    <IconCartPlus size={17} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn dock-row-del"
                    aria-label={`移出候选：${item.name}`}
                    onClick={() => onRemove(item.dishId)}
                  >
                    <IconClose size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="dock-foot">
          {showWheel && candidates.length > 1 ? (
            <button type="button" className="wheel-btn" onClick={onWheel}>
              <IconWheel size={15} /> 转盘
            </button>
          ) : (
            <span className="dock-foot-tip">点购物车直接去结算</span>
          )}
          <button type="button" className="btn primary small" onClick={onCompare} disabled={!total}>
            全部
            <IconChevron size={14} />
          </button>
        </footer>
      </section>
    </>
  );
}

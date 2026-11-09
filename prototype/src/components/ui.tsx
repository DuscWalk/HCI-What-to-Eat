import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconBack, IconBookmark, IconClose, IconMinus, IconPlus } from './Icons';

/** 点开放大的内容：大图（没有时用缩略图）和说明文字。 */
export interface ThumbZoom {
  src?: string;
  title: string;
  sub?: string;
}

/**
 * 缩略图：有图片时显示图片，没有时用 emoji 和色块。
 * 传了 zoom 且有图片时，点一下放大查看；不要用在本身可点击的按钮或整行里。
 */
export function Thumb({ emoji, hue, size = 56, src, zoom }: { emoji: string; hue: number; size?: number; src?: string; zoom?: ThumbZoom }) {
  const [open, setOpen] = useState(false);
  if (src && zoom) {
    return (
      <>
        <button
          type="button"
          className="thumb has-img zoomable"
          style={{ '--h': hue, '--s': `${size}px` } as CSSProperties}
          aria-label={`查看大图：${zoom.title}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <img src={src} alt="" loading="lazy" decoding="async" />
        </button>
        {open && <ImageViewer src={zoom.src ?? src} title={zoom.title} sub={zoom.sub} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return (
    <span
      className={`thumb${src ? ' has-img' : ''}`}
      style={{ '--h': hue, '--s': `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" loading="lazy" decoding="async" /> : emoji}
    </span>
  );
}

export function Chip({
  on,
  onClick,
  children,
  tone,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: 'avoid';
}) {
  return (
    <button type="button" className={`chip${on ? ' on' : ''}${tone ? ` ${tone}` : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

/** 候选开关：书签样式，点一下加入候选，再点一下取消（候选没有份数）。 */
export function CandidateToggle({ on, onToggle, label, compact }: { on: boolean; onToggle: () => void; label: string; compact?: boolean }) {
  return (
    <button
      type="button"
      className={`cand-toggle${on ? ' on' : ''}${compact ? ' compact' : ''}`}
      aria-pressed={on}
      aria-label={on ? `已在候选：${label}，点击取消` : `加入候选：${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <IconBookmark size={15} filled={on} />
      {!compact && <span>{on ? '已候选' : '候选'}</span>}
    </button>
  );
}

/**
 * 购物车数量控制：没加时是「+」；加入后变成「− 份数 +」。
 * 「+」再加一份，「−」减一份，减到 0 才移出购物车（外卖平台的常见做法）。
 */
export function QtyControl({
  qty,
  max,
  onInc,
  onDec,
  label,
}: {
  qty: number;
  max: number;
  onInc: () => void;
  onDec: () => void;
  label: string;
}) {
  const stop = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };
  if (qty <= 0) {
    return (
      <button type="button" className="add-btn" aria-label={`加入购物车：${label}`} onClick={stop(onInc)}>
        <IconPlus size={16} />
      </button>
    );
  }
  return (
    <span className="qty-ctl">
      <button type="button" className="qty-dec" aria-label={`${label}减一份`} onClick={stop(onDec)}>
        <IconMinus size={14} />
      </button>
      <b aria-live="polite" aria-label={`${label} ${qty} 份`}>
        {qty}
      </b>
      <button type="button" className="add-btn" aria-label={`${label}加一份`} disabled={qty >= max} onClick={stop(onInc)}>
        <IconPlus size={14} />
      </button>
    </span>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

export function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onEscape]);
}

/** 放大查看图片：铺满手机框，点任意位置、按 Esc 或关闭按钮收起。 */
export function ImageViewer({ src, title, sub, onClose }: { src: string; title: string; sub?: string; onClose: () => void }) {
  useEscape(onClose);
  const host = document.getElementById('overlay-root');
  // 门户里的点击会沿 React 树冒泡回缩略图所在的行，这里截住
  const close = (e: MouseEvent) => {
    e.stopPropagation();
    onClose();
  };
  const view = (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={title} onClick={close}>
      <figure className="viewer-figure">
        <img src={src} alt={title} />
        <figcaption>
          <b>{title}</b>
          {sub && <span>{sub}</span>}
        </figcaption>
      </figure>
      <button type="button" className="viewer-close" aria-label="关闭" onClick={close} autoFocus>
        <IconClose size={22} />
      </button>
    </div>
  );
  return host ? createPortal(view, host) : view;
}

/** 底部面板。渲染到 App 顶层的 overlay-root，避免被页面的层级压在底部栏下面。 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEscape(onClose);
  const host = document.getElementById('overlay-root');
  const sheet = (
    <div className="sheet-layer">
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        <h2 className="sheet-title">{title}</h2>
        {children}
      </div>
    </div>
  );
  return host ? createPortal(sheet, host) : sheet;
}

export function PageHeader({ title, sub, onBack, right }: { title: string; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="page-header">
      {onBack && (
        <button type="button" className="icon-btn back" aria-label="返回" onClick={onBack}>
          <IconBack size={22} />
        </button>
      )}
      <div className="page-header-text">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right && <div className="page-header-right">{right}</div>}
    </header>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Sheet } from '../components/ui';
import { yuan } from '../logic/pricing';

export interface WheelItem {
  id: string;
  name: string;
  emoji: string;
  hue: number;
  shopName: string;
  total: number;
}

const R = 96;

const point = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  return [r * Math.sin(a), -r * Math.cos(a)] as const;
};

const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** 转盘（F24，白板：候选页顶部的 random 转盘）：只在已有候选中随机挑一个。 */
export function WheelSheet({
  items,
  goLabel = '去下单',
  onPick,
  onGo,
  onClose,
}: {
  items: WheelItem[];
  goLabel?: string;
  onPick: (id: string) => void;
  onGo: (id: string) => void;
  onClose: () => void;
}) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const target = useRef(0);
  const n = items.length;
  const seg = 360 / n;
  const maxChars = n <= 3 ? 6 : 5;

  const spin = () => {
    if (spinning || n < 2) return;
    const index = Math.floor(Math.random() * n);
    target.current = index;
    const center = index * seg + seg / 2;
    const jitter = (Math.random() - 0.5) * seg * 0.5;
    setResultId(null);
    setSpinning(true);
    // 指针在正上方：转过 (360 - center) 后，该扇区中心正好停在指针下
    setRotation((r) => Math.ceil(r / 360) * 360 + 360 * 5 + (360 - center) + jitter);
  };

  // 打开即开始转，少点一次
  useEffect(() => {
    const id = window.setTimeout(spin, 280);
    return () => window.clearTimeout(id);
  }, []);

  const finish = () => {
    if (!spinning) return;
    setSpinning(false);
    const id = items[target.current].id;
    setResultId(id);
    onPick(id);
  };

  const result = items.find((i) => i.id === resultId);

  return (
    <Sheet title="转盘：随机挑一个" onClose={onClose}>
      <p className="sheet-sub">只从你的 {n} 个候选里挑，挑中后照不照做都由你</p>
      <div className="wheel">
        <span className="wheel-pointer" aria-hidden="true" />
        <div
          className="wheel-disc"
          style={{ transform: `rotate(${rotation}deg)` }}
          onTransitionEnd={finish}
          aria-hidden="true"
        >
          <svg viewBox="-100 -100 200 200" width="100%" height="100%">
            {items.map((item, i) => {
              const [x0, y0] = point(i * seg, R);
              const [x1, y1] = point((i + 1) * seg, R);
              const mid = i * seg + seg / 2;
              return (
                <g key={item.id}>
                  <path
                    d={`M0 0 L${x0} ${y0} A${R} ${R} 0 ${seg > 180 ? 1 : 0} 1 ${x1} ${y1} Z`}
                    fill={`hsl(${item.hue} 82% ${i % 2 ? 84 : 91}%)`}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                  <g transform={`rotate(${mid})`}>
                    <text y={-R * 0.8} textAnchor="middle" dominantBaseline="central" fontSize={14}>
                      {item.emoji}
                    </text>
                    <text
                      y={-R * 0.56}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={11}
                      fontWeight={700}
                      fill="#1f1a15"
                    >
                      {truncate(item.name, maxChars)}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </div>
        <button type="button" className="wheel-hub" onClick={spin} disabled={spinning}>
          {spinning ? '…' : '转'}
        </button>
      </div>

      <div className="wheel-result" aria-live="polite">
        {spinning && <p className="wheel-wait">转呀转……</p>}
        {result && !spinning && (
          <div className="wheel-pick">
            <span>就它了？</span>
            <b>{result.name}</b>
            <span>
              {result.shopName} · 单点 {yuan(result.total)} 起
            </span>
          </div>
        )}
      </div>

      <div className="sheet-actions">
        <button type="button" className="btn ghost" onClick={spin} disabled={spinning}>
          再转一次
        </button>
        <button type="button" className="btn primary" disabled={!result || spinning} onClick={() => result && onGo(result.id)}>
          {goLabel}
        </button>
      </div>
    </Sheet>
  );
}

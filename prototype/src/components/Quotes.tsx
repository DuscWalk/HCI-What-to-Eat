import { PLATFORM_LABEL } from '../api/client';
import { yuan, type Quote } from '../logic/pricing';
import type { Platform } from '../types';

/** 一个购物车在各平台的实付：最低的高亮，其余显示贵多少；缺菜的平台标出来。 */
export function QuoteChips({
  quotes,
  best,
  selected,
  onSelect,
}: {
  quotes: Quote[];
  best?: Quote;
  selected?: Platform;
  onSelect?: (p: Platform) => void;
}) {
  return (
    <div className={`quote-chips${onSelect ? ' selectable' : ''}`} role={onSelect ? 'radiogroup' : undefined}>
      {quotes.map((q) => {
        const isBest = best?.platform === q.platform;
        const incomplete = q.missing.length > 0;
        const content = (
          <>
            <span className="qc-plat">{PLATFORM_LABEL[q.platform]}</span>
            {incomplete ? (
              <span className="qc-miss">缺 {q.missing.length} 道菜</span>
            ) : (
              <b className="qc-total">{yuan(q.total)}</b>
            )}
            {isBest ? (
              <span className="qc-tag best">最低</span>
            ) : best && !incomplete ? (
              <span className="qc-tag">贵 {yuan(Math.round((q.total - best.total) * 10) / 10)}</span>
            ) : null}
          </>
        );
        const cls = `quote-chip${isBest ? ' best' : ''}${incomplete ? ' incomplete' : ''}${selected === q.platform ? ' on' : ''}`;
        return onSelect ? (
          <button
            key={q.platform}
            type="button"
            role="radio"
            aria-checked={selected === q.platform}
            className={cls}
            onClick={() => onSelect(q.platform)}
          >
            {content}
          </button>
        ) : (
          <span key={q.platform} className={cls}>
            {content}
          </span>
        );
      })}
    </div>
  );
}

/** 一句话的比价摘要，用在列表行和底栏里。 */
export function quoteSummary(quotes: Quote[], best?: Quote) {
  if (!best) return quotes.length ? '各平台都缺菜，进店调整' : '';
  const others = quotes.filter((q) => q.platform !== best.platform && q.missing.length === 0);
  const diff = others.length ? Math.min(...others.map((q) => q.total - best.total)) : null;
  return diff !== null && diff > 0
    ? `比${PLATFORM_LABEL[others.find((q) => q.total - best.total === diff)!.platform]}省 ${yuan(Math.round(diff * 10) / 10)}`
    : others.length
      ? '两个平台一样'
      : `仅${PLATFORM_LABEL[best.platform]}`;
}

/** 实付明细：让用户知道最低价是怎么算出来的（用了哪张券）。 */
export function QuoteBreakdown({ quote }: { quote: Quote }) {
  return (
    <div className="breakdown">
      <div>
        <span>菜品小计</span>
        <span>{yuan(quote.dish)}</span>
      </div>
      <div>
        <span>包装费</span>
        <span>{yuan(quote.pack)}</span>
      </div>
      <div>
        <span>配送费</span>
        <span>{quote.delivery ? yuan(quote.delivery) : '免配送费'}</span>
      </div>
      {quote.shopOff > 0 && (
        <div className="off">
          <span>店铺满减</span>
          <span>−{yuan(quote.shopOff)}</span>
        </div>
      )}
      {quote.coupon && (
        <div className="off">
          <span>
            {quote.coupon.name}
            {quote.coupon.threshold ? `（满${quote.coupon.threshold}减${quote.coupon.off}）` : `（无门槛${quote.coupon.off}元）`}
          </span>
          <span>−{yuan(quote.couponOff)}</span>
        </div>
      )}
      <div className="total">
        <span>实付</span>
        <b>{yuan(quote.total)}</b>
      </div>
    </div>
  );
}

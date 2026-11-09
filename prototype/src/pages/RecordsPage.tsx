import { useMemo, useState } from 'react';
import { IconMore, IconSearch } from '../components/Icons';
import { PageHeader, Thumb } from '../components/ui';
import { RecordEditSheet } from '../overlays/RecordEditSheet';
import { REASON_LABEL, STATUS_LABEL, buildRecords, relativeDay, type RecordStatus, type ShopRecord } from '../logic/records';
import { useActions } from '../store/actions';
import { useData } from '../store/data';
import { useStore } from '../store/store';

type Filter = 'all' | RecordStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'chosen', label: '最终选定' },
  { value: 'candidate', label: '候选未选' },
  { value: 'ordered', label: '曾点过' },
];

/** 记录页（F10–F12）：快速锁定想吃的店，修正推荐记忆。 */
export function RecordsPage() {
  const { shopById, dishById, orders } = useData();
  const { state, dispatch } = useStore();
  const { goShop, reorder, isCandidate, navigate } = useActions();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const records = useMemo(
    () => buildRecords(shopById, orders, state.events, state.edits).filter((r) => !r.edit.deleted),
    [shopById, orders, state.events, state.edits],
  );

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: records.length, chosen: 0, candidate: 0, ordered: 0 };
    for (const r of records) c[r.status] += 1;
    return c;
  }, [records]);

  const q = query.trim();
  const visible = records.filter(
    (r) =>
      (filter === 'all' || r.status === filter) &&
      (!q ||
        r.shop.name.includes(q) ||
        r.shop.category.includes(q) ||
        r.shop.dishes.some((d) => d.name.includes(q))),
  );

  const editingRecord = editing ? records.find((r) => r.shop.id === editing) : undefined;

  return (
    <div className="page records">
      <PageHeader title="记录" sub="找回吃过、选过的店；记得不准的可以改" />

      <div className="records-tools">
        <label className="search">
          <IconSearch size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="记不清店名？搜菜名或品类"
            enterKeyHint="search"
          />
        </label>
        <div className="filter-tabs" role="tablist" aria-label="记录分类">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              className={filter === f.value ? 'on' : ''}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
              <span className="count">{counts[f.value]}</span>
            </button>
          ))}
        </div>
      </div>

      {!state.settings.useHistory && (
        <div className="notice">
          已关闭「使用历史记录」，这些记录暂不用于推荐。
          <button type="button" className="btn text small" onClick={() => navigate('/me', { replace: true })}>
            去设置
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty">
          <div className="empty-emoji">🗂️</div>
          <p>{q ? '没有找到相关的店' : '这里还没有记录'}</p>
        </div>
      ) : (
        <ul className="record-list">
          {visible.map((r) => (
            <RecordRow
              key={r.shop.id}
              record={r}
              inCart={r.shop.dishes.some((d) => isCandidate(d.id))}
              dishNames={r.dishIds.map((id) => dishById.get(id)?.name).filter(Boolean) as string[]}
              onGo={() => (r.lastDishId ? reorder(r.shop.id, r.lastDishId) : goShop(r.shop.id))}
              onShop={() => goShop(r.shop.id)}
              onEdit={() => setEditing(r.shop.id)}
            />
          ))}
        </ul>
      )}

      {editingRecord && (
        <RecordEditSheet
          record={editingRecord}
          onClose={() => setEditing(null)}
          onPatch={(patch) => dispatch({ type: 'editRecord', shopId: editingRecord.shop.id, patch })}
        />
      )}
    </div>
  );
}

function RecordRow({
  record,
  inCart,
  dishNames,
  onGo,
  onShop,
  onEdit,
}: {
  record: ShopRecord;
  inCart: boolean;
  dishNames: string[];
  onGo: () => void;
  onShop: () => void;
  onEdit: () => void;
}) {
  const { shop, status, edit } = record;
  const statusLabel = status === 'candidate' && inCart ? '候选中' : STATUS_LABEL[status];
  const facts = [
    record.orderCount > 0 && `点过 ${record.orderCount} 次`,
    record.chosenCount > 0 && `选定 ${record.chosenCount} 次`,
    status === 'candidate' && `进过候选 ${record.candidateCount} 次`,
  ].filter(Boolean);

  return (
    <li className={`record${edit.excluded ? ' muted' : ''}`}>
      <Thumb emoji={shop.emoji} src={shop.image} hue={shop.hue} size={52} zoom={{ src: shop.imageLarge, title: shop.name }} />
      <div className="record-main">
        <div className="record-top">
          <button type="button" className="record-name" onClick={onShop}>
            {shop.name}
          </button>
          <span className={`status status-${status}`}>{statusLabel}</span>
        </div>
        <div className="record-meta">
          {relativeDay(record.lastAt)} · {facts.join(' · ')}
        </div>
        {dishNames.length > 0 && <div className="record-dishes">{dishNames.join('、')}</div>}
        {(edit.reason || edit.excluded) && (
          <div className="record-marks">
            {edit.reason && <span className="mark">因为{REASON_LABEL[edit.reason]}</span>}
            {edit.excluded && <span className="mark off">不用于推荐</span>}
          </div>
        )}
      </div>
      <div className="record-actions">
        <button type="button" className="btn primary small" onClick={onGo}>
          {status === 'candidate' ? '去下单' : '再来一单'}
        </button>
        <button type="button" className="icon-btn" aria-label={`修正记录：${shop.name}`} onClick={onEdit}>
          <IconMore size={20} />
        </button>
      </div>
    </li>
  );
}

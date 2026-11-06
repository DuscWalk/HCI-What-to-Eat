import { useState } from 'react';
import { Chip, Sheet, Switch } from '../components/ui';
import { REASON_LABEL, STATUS_LABEL, type ShopRecord } from '../logic/records';
import { useToast } from '../store/toast';
import type { RecordEdit, RecordReason } from '../types';

const REASONS = Object.keys(REASON_LABEL) as RecordReason[];

/** 修正记忆（F12）：标记选择原因、决定是否用于推荐、删除记录。 */
export function RecordEditSheet({
  record,
  onClose,
  onPatch,
}: {
  record: ShopRecord;
  onClose: () => void;
  onPatch: (patch: RecordEdit) => void;
}) {
  const toast = useToast();
  const { edit, shop } = record;
  const [hint, setHint] = useState<string | null>(null);

  const pickReason = (reason: RecordReason) => {
    if (edit.reason === reason) {
      onPatch({ reason: undefined });
      setHint(null);
      return;
    }
    const preference = reason === 'love';
    onPatch({ reason, excluded: !preference });
    setHint(
      preference
        ? '会把这家店当作你的偏好，用于推荐'
        : `「${REASON_LABEL[reason]}」不代表口味偏好，已关闭「用于推荐」，可以再打开`,
    );
  };

  const remove = () => {
    onPatch({ deleted: true });
    onClose();
    toast.show({
      text: `已删除「${shop.name}」的记录`,
      action: '撤销',
      onAction: () => onPatch({ deleted: false }),
    });
  };

  return (
    <Sheet title={shop.name} onClose={onClose}>
      <p className="sheet-sub">
        {STATUS_LABEL[record.status]} · 点过 {record.orderCount} 次 · 进过候选 {record.candidateCount} 次
      </p>

      <div className="sheet-section">
        <div className="sheet-label">当时为什么选它？</div>
        <div className="chips-wrap">
          {REASONS.map((r) => (
            <Chip key={r} on={edit.reason === r} onClick={() => pickReason(r)}>
              {REASON_LABEL[r]}
            </Chip>
          ))}
        </div>
        {hint && <p className="sheet-hint">{hint}</p>}
      </div>

      <div className="sheet-section row">
        <div>
          <div className="sheet-label">用于推荐</div>
          <p className="sheet-desc">关闭后，这家店不会作为「常点」出现在推荐和「点过的店」里</p>
        </div>
        <Switch
          checked={!edit.excluded}
          label="用于推荐"
          onChange={(on) => {
            onPatch({ excluded: !on });
            setHint(null);
          }}
        />
      </div>

      <div className="sheet-actions">
        <button type="button" className="btn danger-ghost" onClick={remove}>
          删除这条记录
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          完成
        </button>
      </div>
      <p className="sheet-foot">删除只影响这里的记录和推荐依据，不影响外卖平台上的订单。</p>
    </Sheet>
  );
}

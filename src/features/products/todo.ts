// 제품 상세 "할 일" 계산 (Claude)
import type { FieldStatus, FieldStatusValue } from './types';

export type FieldRef = {
  entity_type: FieldStatus['entity_type'];
  entity_id: string;
  field_key: string;
  value: unknown;           // 현재 값 (비었는지 판단용)
};

const is_empty = (v: unknown) =>
  v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

/** 상태 줄이 없을 때의 기본값: 값이 비었으면 missing, 값이 있으면 needs_check */
export function effective_status(ref: FieldRef, rows: FieldStatus[]): FieldStatusValue {
  const row = rows.find(
    (r) => r.entity_type === ref.entity_type && r.entity_id === ref.entity_id && r.field_key === ref.field_key,
  );
  if (row) return row.status;
  return is_empty(ref.value) ? 'missing' : 'needs_check';
}

export type TodoGroups = {
  doNow: { ref: FieldRef; status: FieldStatusValue; row?: FieldStatus }[];
  waiting: { ref: FieldRef; status: FieldStatusValue; row: FieldStatus; overdue: boolean }[];
  total: number;            // 기다리는 중도 포함한 할 일 개수
};

const OPEN: FieldStatusValue[] = ['missing', 'needs_check', 'on_hold'];
const WAIT_DAYS = 7;

/** 할 일 = missing + needs_check + on_hold. 기다리는 중도 개수에 포함하고, 7일 지나면 다시 "지금 할 일"로. */
export function group_todos(refs: FieldRef[], rows: FieldStatus[], today = new Date()): TodoGroups {
  const do_now: TodoGroups['doNow'] = [];
  const waiting: TodoGroups['waiting'] = [];
  for (const ref of refs) {
    const status = effective_status(ref, rows);
    if (!OPEN.includes(status)) continue;
    const row = rows.find(
      (r) => r.entity_type === ref.entity_type && r.entity_id === ref.entity_id && r.field_key === ref.field_key,
    );
    if (row?.wait_reason && row.wait_reason !== 'unknown') {
      const days = row.requested_at
        ? Math.floor((today.getTime() - new Date(row.requested_at).getTime()) / 86_400_000)
        : 0;
      const overdue = days >= WAIT_DAYS;
      if (overdue) do_now.push({ ref, status, row });
      else waiting.push({ ref, status, row, overdue });
    } else {
      do_now.push({ ref, status, row });
    }
  }
  return { doNow: do_now, waiting, total: do_now.length + waiting.length };
}

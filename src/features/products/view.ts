// 제품 상세 화면용 계산 (Claude): 할 일 묶기, 확인된 정보 목록
import type { FieldStatus, FieldStatusValue } from '@/features/products/types';
import type { ProductDetail } from './data';
import { COMPONENT_FIELDS, EXPORT_FIELDS, PRODUCT_FIELDS, REQUEST_GROUPS, type FieldDef, type RequestGroup, type UseTab } from './fields';
import { ingredients_display } from './form';
import { format_hs_code } from './hs_format';
import { effective_status, group_todos, type FieldRef } from './todo';

export type TodoItem = {
  scope: string;              // 제품 또는 구성품 이름
  def: FieldDef;
  value: string | null;
  status: FieldStatusValue;
  row?: FieldStatus;
  key: string;                // entity_type:entity_id:field_key (다시 올리기용)
};

export type RequestRow = { title: string; where: string; fields: string[]; uses: UseTab[]; items: TodoItem[] };

export type DetailView = {
  requests: RequestRow[];     // 모아야 할 자료 (지금 할 일 중 비어 있는 칸)
  checks: TodoItem[];         // 값은 있지만 확인이 필요해요
  waiting: TodoItem[];        // 기다리는 중
  doNowCount: number;
  total: number;
  info: { scope: string; items: TodoItem[] }[];   // 제품 정보 탭: 모든 칸 (값 + 상태)
};

const EMPTY_TRI = '미확인';

function display(v: unknown): string | null {
  if (v == null || v === '' || v === EMPTY_TRI) return null;
  if (Array.isArray(v)) return v.length ? v.join(', ') : null;
  return String(v);
}

export function build_detail_view(d: ProductDetail, today = new Date()): DetailView {
  const refs: (FieldRef & { scope: string; def: FieldDef; shown: string | null })[] = [];

  for (const def of PRODUCT_FIELDS) {
    const raw = def.key === 'packaging'
      ? d.packaging.filter((p) => p.material).map((p) => `${p.part} ${p.material}`)
      : (d.product as unknown as Record<string, unknown>)[def.key];
    const shown = def.key === 'net_content_value' && d.product.net_content_value
      ? `${d.product.net_content_value}${d.product.net_content_unit ?? ''}`
      : display(raw);
    refs.push({ entity_type: 'product', entity_id: d.product.id, field_key: def.key, value: shown, scope: d.product.name_ko, def, shown });
  }
  for (const pc of d.components) {
    const c = pc.component;
    for (const def of COMPONENT_FIELDS) {
      if (def.key === 'unit_weight_g' && pc.unit === 'g') continue;   // g 구성품은 실중량이 따로 필요 없음
      const raw = def.key === 'ingredients'
        ? ingredients_display(d.ingredients.filter((i) => i.component_id === c.id))
        : (c as unknown as Record<string, unknown>)[def.key];
      const shown = display(raw);
      refs.push({ entity_type: 'component', entity_id: c.id, field_key: def.key, value: shown, scope: c.name, def, shown });
    }
  }
  for (const def of EXPORT_FIELDS) {
    const raw = d.exportInfo ? (d.exportInfo as unknown as Record<string, unknown>)[def.key] : null;
    const shown = def.key === 'hs6' ? format_hs_code(raw as string | null) : display(raw);
    refs.push({ entity_type: 'product', entity_id: d.product.id, field_key: def.key, value: shown, scope: d.product.name_ko, def, shown });
  }

  const g = group_todos(refs.filter((r) => !r.def.optional), d.statuses, today);   // 선택 칸은 할 일에서 뺌
  const to_item = (x: { ref: FieldRef; status: FieldStatusValue; row?: FieldStatus }): TodoItem => {
    const r = x.ref as (typeof refs)[number];
    return { scope: r.scope, def: r.def, value: r.shown, status: x.status, row: x.row, key: `${r.entity_type}:${r.entity_id}:${r.field_key}` };
  };
  const do_now = g.doNow.map(to_item);
  const waiting = g.waiting.map(to_item);

  // 비어 있는 칸은 "받을 자료"로 묶고, 값이 있는 칸은 "확인 필요"로
  const empty = do_now.filter((t) => t.value == null);
  const checks = do_now.filter((t) => t.value != null);

  const groups = new Map<string, { group: RequestGroup; scope: string; items: TodoItem[] }>();
  for (const t of empty) {
    const scope = t.def.request === 'price_pack' ? '' : t.scope;
    const k = `${t.def.request}|${scope}`;
    if (!groups.has(k)) groups.set(k, { group: t.def.request, scope, items: [] });
    groups.get(k)!.items.push(t);
  }
  const order: RequestGroup[] = ['component_spec', 'package_label', 'price_pack'];
  const requests: RequestRow[] = [...groups.values()]
    .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group))
    .map(({ group, scope, items }) => ({
      title: REQUEST_GROUPS[group].title(scope),
      where: REQUEST_GROUPS[group].where,
      items,
      fields: items.map((i) => i.def.label),
      uses: [...new Set(items.flatMap((i) => i.def.uses))].sort((a, b) => ['규제', '라벨', '서류'].indexOf(a) - ['규제', '라벨', '서류'].indexOf(b)),
    }));

  const info: DetailView['info'] = [];
  for (const r of refs) {
    let sec = info.find((x) => x.scope === r.scope);
    if (!sec) info.push((sec = { scope: r.scope, items: [] }));
    const row = d.statuses.find((s) => s.entity_type === r.entity_type && s.entity_id === r.entity_id && s.field_key === r.field_key);
    sec.items.push({ scope: r.scope, def: r.def, value: r.shown, status: effective_status(r, d.statuses), row, key: `${r.entity_type}:${r.entity_id}:${r.field_key}` });
  }

  return { requests, checks, waiting, doNowCount: do_now.length, total: g.total, info };
}

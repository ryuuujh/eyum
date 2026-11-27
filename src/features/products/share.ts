// [공용] 다른 탭(규제 · 라벨 · 서류)이 제품 정보를 가져가는 곳 (Claude)
// 규칙: 칸마다 값 + 확인 상태를 같이 준다. 확인 안 된 값은 "추가 확인 필요"로 보여 주고 판정에 쓰지 말 것.
// 다른 탭은 DB 표를 직접 읽지 말고 이 함수(또는 /api/products/[code])만 쓴다. 표 구조가 바뀌어도 여기만 고치면 된다.
import 'server-only';
import { STATUS_LABEL, WAIT_REASON_LABEL, type FieldStatusValue, type Ingredient, type WaitReason } from '@/features/products/types';
import { get_product_detail, get_products, type ProductDetail } from './data';
import { build_detail_view } from './view';
import { calc_nutrition, type NutritionResult } from './nutrition';
import { EXPORT_FIELDS, type UseTab } from './fields';

export type SharedField = {
  key: string;                 // 'product.name_en' · 'component.<구성품 이름>.ingredients' · 'export.hs6'
  scope: 'product' | 'component' | 'export';
  component: string | null;    // 구성품 칸이면 구성품 이름
  field: string;               // DB 칸 이름 (field_status.field_key)
  label: string;               // 화면 이름
  value: string | null;        // 보여 줄 값 (없으면 null)
  status: FieldStatusValue;    // confirmed · needs_check · missing · on_hold · not_applicable
  status_label: string;
  usable: boolean;             // 판정에 써도 되는 값인지 (확인됨 또는 해당 없음)
  wait_reason: WaitReason | null;
  wait_label: string | null;   // 제조사에 확인 중 · 아직 정하지 않음 · 모름
  note: string | null;         // 확인할 점 (AI 근거 등)
  uses: UseTab[];
};

export type SharedIngredient = { name: string; origin: string | null; is_organic: boolean; is_additive: boolean; additive_function: string | null; ins_no: string | null; allergens: string[]; labeled_pct: number | null; pct_basis: string | null; children: SharedIngredient[] };

export type SharedProduct = {
  code: string;
  name_ko: string;
  updated_at: string | null;
  for: UseTab | null;          // 어느 탭용으로 걸렀는지 (null = 전체)
  external: boolean;           // true면 내부용 칸(단가 등)과 비공개 제조사 이름을 뺌
  summary: { total: number; usable: number; needs_check: number; missing: number };
  fields: SharedField[];
  components: { name: string; amount: number; unit: string; quantity: number; ingredients: SharedIngredient[] }[];
  nutrition: NutritionResult;  // 구성품 합산 (100g당은 실중량을 모르면 null = 보류)
};

function tree(list: Ingredient[], parent: string | null = null): SharedIngredient[] {
  return list.filter((i) => i.parent_id === parent).sort((a, b) => a.seq - b.seq).map((i) => ({
    name: i.name, origin: i.origin, is_organic: i.is_organic, is_additive: i.is_additive, additive_function: i.additive_function, ins_no: i.ins_no,
    allergens: i.allergens, labeled_pct: i.labeled_pct, pct_basis: i.pct_basis, children: tree(list, i.id),
  }));
}

export function to_shared(d: ProductDetail, opt: { for?: UseTab | null; external?: boolean } = {}): SharedProduct {
  const tab = opt.for ?? null;
  const external = !!opt.external;
  const view = build_detail_view(d);
  const comp_by_id = new Map(d.components.map((pc) => [pc.component.id, pc.component]));
  const export_keys = new Set(EXPORT_FIELDS.map((f) => f.key));

  const fields: SharedField[] = [];
  for (const sec of view.info) {
    for (const t of sec.items) {
      const [entity, id, field] = t.key.split(':');
      if (tab && !t.def.uses.includes(tab)) continue;
      if (external && t.def.internal) continue;
      const comp = entity === 'component' ? comp_by_id.get(id) : undefined;
      const scope: SharedField['scope'] = entity === 'component' ? 'component' : export_keys.has(field) ? 'export' : 'product';
      let value = t.value;
      if (external && comp && field === 'manufacturer_name' && comp.manufacturer_public === false) value = null;
      const reason = (t.row?.wait_reason ?? null) as WaitReason | null;
      fields.push({
        key: comp ? `component.${comp.name}.${field}` : `${scope}.${field}`,
        scope, component: comp?.name ?? null, field, label: t.def.label, value,
        status: t.status, status_label: STATUS_LABEL[t.status],
        usable: t.status === 'confirmed' || t.status === 'not_applicable',
        wait_reason: reason, wait_label: reason ? WAIT_REASON_LABEL[reason] : null,
        note: t.row?.note ?? null, uses: t.def.uses,
      });
    }
  }
  return {
    code: d.product.code, name_ko: d.product.name_ko, updated_at: (d.product as unknown as { updated_at?: string }).updated_at ?? null,
    for: tab, external,
    summary: {
      total: fields.length,
      usable: fields.filter((f) => f.usable).length,
      needs_check: fields.filter((f) => f.status === 'needs_check').length,
      missing: fields.filter((f) => f.status === 'missing' || f.status === 'on_hold').length,
    },
    fields,
    components: d.components.map((pc) => ({
      name: pc.component.name, amount: pc.amount, unit: pc.unit, quantity: pc.quantity,
      ingredients: tree(d.ingredients.filter((i) => i.component_id === pc.component.id)),
    })),
    nutrition: calc_nutrition(d.components, d.product.servings_per_pack),
  };
}

/** 다른 탭용: 제품 하나 (없으면 null) */
export async function get_shared_product(code: string, opt: { for?: UseTab | null; external?: boolean } = {}) {
  const d = await get_product_detail(code);
  return d ? to_shared(d, opt) : null;
}

/** 다른 탭용: 제품 고르기 목록 */
export async function list_shared_products() {
  return (await get_products()).map((p) => ({ code: p.code, name_ko: p.name_ko, status: p.status }));
}

export const USE_TABS: UseTab[] = ['규제', '라벨', '서류'];

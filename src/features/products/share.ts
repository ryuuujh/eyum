// [공용] 다른 탭(규제 · 라벨 · 서류)이 제품 정보를 가져가는 곳 (Claude)
// 규칙: 칸마다 값 + 확인 상태를 같이 준다. 확인 안 된 값은 "추가 확인 필요"로 보여 주고 판정에 쓰지 말 것.
// 다른 탭은 DB 표를 직접 읽지 말고 이 함수(또는 /api/products/[code])만 쓴다. 표 구조가 바뀌어도 여기만 고치면 된다.
import 'server-only';
import { LABEL_ADDRESS_ITEMS, LABEL_ITEMS, LABEL_PACK_LABEL, NUTRIENT_KEYS, STATUS_LABEL, WAIT_REASON_LABEL, type FieldStatusValue, type Ingredient, type LabelItemKey, type Nutrition, type LabelPackLevel, type WaitReason } from '@/features/products/types';
import { get_product_detail, get_products, type ProductDetail } from './data';
import { build_detail_view } from './view';
import { calc_nutrition, type NutritionResult } from './nutrition';
import { EXPORT_FIELDS, type UseTab } from './fields';
import { FOOD_DOC_KEYS, type DocKey } from './doc_keys';

export type SharedField = {
  key: string;                 // 'product.name_en' · 'component.<구성품 이름>.ingredients' · 'export.hs6'
  scope: 'product' | 'component' | 'export';
  component: string | null;    // 구성품 칸이면 구성품 이름
  field: string;               // DB 칸 이름 (field_status.field_key)
  doc_key: DocKey | null;      // 서류 탭 공통 이름 (제품 · 부속물품이 같음, doc_keys.ts). 서류에 안 쓰는 칸은 null
  label: string;               // 화면 이름
  value: string | null;        // 보여 줄 값 (화면용 글자, 예: "1902.30" · "166g" · "150 × 90 × 60 mm"). 없으면 null
  raw: unknown;                // 계산용 원값 (숫자, HS는 숫자만 "190230", 묶은 칸은 { w, d, h, unit } 객체). 없으면 null
  status: FieldStatusValue;    // confirmed · needs_check · missing · on_hold · not_applicable
  status_label: string;
  usable: boolean;             // 판정에 써도 되는 값인지 (확인됨 또는 해당 없음)
  wait_reason: WaitReason | null;
  wait_label: string | null;   // 제조사에 확인 중 · 아직 정하지 않음 · 모름
  note: string | null;         // 확인할 점 (AI 근거 등)
  uses: UseTab[];
};

export type SharedIngredient = { name: string; name_en: string | null; origin: string | null; is_organic: boolean; is_additive: boolean; additive_function: string | null; ins_no: string | null; allergens: string[]; labeled_pct: number | null; pct_basis: string | null; children: SharedIngredient[] };

export type SharedProduct = {
  item_type: 'food';           // 서류 탭이 제품 · 부속물품을 같은 코드로 읽을 때 구분용 (부속물품은 'accessory')
  item_id: string;             // products.id
  code: string;
  name_ko: string;
  updated_at: string | null;
  for: UseTab | null;          // 어느 탭용으로 걸렀는지 (null = 전체)
  external: boolean;           // true면 내부용 칸(단가 등)과 비공개 제조사 이름을 뺌
  summary: { total: number; usable: number; needs_check: number; missing: number };
  fields: SharedField[];
  // amount × quantity = 제품에 들어가는 양 (예: 떡 100 g × 2봉). nutrition = 성적서 · 라벨에 적힌 원본 값 그대로 (basis 기준)
  components: { name: string; amount: number; unit: string; quantity: number; ingredients: SharedIngredient[];
    nutrition: { basis: '100g' | '100mL'; values: Partial<Record<keyof Nutrition, number | null>>; source: string | null } | null }[];
  nutrition: NutritionResult;  // 계산값: 구성품 원본 × 양을 더한 값 (소수 둘째 자리 · kJ 정수까지만 정리, 국가별 반올림 전). 100g당은 실중량을 모르면 null = 보류
  nutrition_items: { key: keyof Nutrition; label_ko: string; label_en: string; unit: string }[];   // 영양성분 항목명 · 단위 (원본과 계산값이 같은 키를 씀)
  packs: SharedPacks;          // 개별포장 · 외박스 숫자 모음 (CI · PL · 라벨 계산용)
  label_texts: SharedLabelText[];   // 기존 라벨 문구 (원문 그대로). external=1이면 주소가 있는 항목(제조원 · 수출자 · 수입자)은 뺌
};

export type SharedPacks = {
  unit: { net_content: number | null; net_unit: string | null; gross_g: number | null; size_mm: { w: number | null; d: number | null; h: number | null } | null; label_area_mm: { w: number | null; h: number | null } | null };
  outer: { units_per_ctn: number | null; net_kg: number | null; gross_kg: number | null; size_cm: { l: number | null; w: number | null; h: number | null } | null; label_area_mm: { w: number | null; h: number | null } | null };
  pallet: { l_cm: number | null; w_cm: number | null; layers: number | null; ctn_count: number | null };
};

export type SharedLabelText = { language: string; pack_level: LabelPackLevel; pack_label: string; item_key: LabelItemKey; item_label: string; text: string; source: string | null };

function tree(list: Ingredient[], parent: string | null = null): SharedIngredient[] {
  return list.filter((i) => i.parent_id === parent).sort((a, b) => a.seq - b.seq).map((i) => ({
    name: i.name, name_en: i.name_en ?? null, origin: i.origin, is_organic: i.is_organic, is_additive: i.is_additive, additive_function: i.additive_function, ins_no: i.ins_no,
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
        scope, component: comp?.name ?? null, field, doc_key: comp ? null : FOOD_DOC_KEYS[field] ?? null, label: t.def.label, value,
        raw: value == null ? null : t.raw,
        status: t.status, status_label: STATUS_LABEL[t.status],
        usable: t.status === 'confirmed' || t.status === 'not_applicable',
        wait_reason: reason, wait_label: reason ? WAIT_REASON_LABEL[reason] : null,
        note: t.row?.note ?? null, uses: t.def.uses,
      });
    }
  }
  return {
    item_type: 'food', item_id: d.product.id,
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
      nutrition: pc.nutrition ? { basis: pc.component.nutrition_basis, values: Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, pc.nutrition![k] ?? null])), source: pc.component.nutrition_source } : null,
    })),
    nutrition: calc_nutrition(d.components, d.product.servings_per_pack),
    nutrition_items: NUTRITION_ITEMS,
    packs: packs_of(d),
    label_texts: d.labelTexts
      .filter((x) => !(external && LABEL_ADDRESS_ITEMS.includes(x.item_key)))
      .filter(() => !tab || tab === '라벨' || tab === '서류')
      .map((x) => ({ language: x.language, pack_level: x.pack_level, pack_label: LABEL_PACK_LABEL[x.pack_level], item_key: x.item_key,
        item_label: LABEL_ITEMS[x.item_key], text: x.text, source: x.source })),
  };
}

const NUTRITION_ITEMS: SharedProduct['nutrition_items'] = [
  { key: 'kcal', label_ko: '열량', label_en: 'Energy', unit: 'kcal' },
  { key: 'sodium_mg', label_ko: '나트륨', label_en: 'Sodium', unit: 'mg' },
  { key: 'carb_g', label_ko: '탄수화물', label_en: 'Carbohydrate', unit: 'g' },
  { key: 'sugar_g', label_ko: '당류', label_en: 'Sugars', unit: 'g' },
  { key: 'fat_g', label_ko: '지방', label_en: 'Fat', unit: 'g' },
  { key: 'sat_fat_g', label_ko: '포화지방', label_en: 'Saturated fat', unit: 'g' },
  { key: 'trans_fat_g', label_ko: '트랜스지방', label_en: 'Trans fat', unit: 'g' },
  { key: 'cholesterol_mg', label_ko: '콜레스테롤', label_en: 'Cholesterol', unit: 'mg' },
  { key: 'protein_g', label_ko: '단백질', label_en: 'Protein', unit: 'g' },
  { key: 'fiber_g', label_ko: '식이섬유', label_en: 'Dietary fibre', unit: 'g' },
];

const n = (v: unknown) => (v == null || v === '' ? null : Number(v));
const obj = <T extends Record<string, number | null>>(o: T) => (Object.values(o).every((v) => v == null) ? null : o);

function packs_of(d: ProductDetail): SharedPacks {
  const p = d.product; const e = d.exportInfo;
  return {
    unit: {
      net_content: n(p.net_content_value), net_unit: p.net_content_unit, gross_g: n(e?.unit_gross_g),
      size_mm: obj({ w: n(p.pack_w_mm), d: n(p.pack_d_mm), h: n(p.pack_h_mm) }),
      label_area_mm: obj({ w: n(p.label_w_mm), h: n(p.label_h_mm) }),
    },
    outer: {
      units_per_ctn: n(e?.units_per_ctn), net_kg: n(e?.ctn_net_kg), gross_kg: n(e?.ctn_gross_kg),
      size_cm: obj({ l: n(e?.ctn_l_cm), w: n(e?.ctn_w_cm), h: n(e?.ctn_h_cm) }),
      label_area_mm: obj({ w: n(p.outer_label_w_mm), h: n(p.outer_label_h_mm) }),
    },
    pallet: { l_cm: n(e?.pallet_l_cm), w_cm: n(e?.pallet_w_cm), layers: n(e?.pallet_layers), ctn_count: n(e?.pallet_ctn_count) },
  };
}

/** 다른 탭용: 제품 하나 (없으면 null) */
export async function get_shared_product(code: string, opt: { for?: UseTab | null; external?: boolean } = {}) {
  const d = await get_product_detail(code);
  return d ? to_shared(d, opt) : null;
}

/** 다른 탭용: 제품 고르기 목록. selected: true면 "수출할 제품"으로 체크한 것만 (없으면 빈 목록 → "선택된 제품이 없습니다") */
export async function list_shared_products(opt: { selected?: boolean } = {}) {
  return (await get_products(opt)).map((p) => ({ item_type: 'food' as const, item_id: p.id, code: p.code, name_ko: p.name_ko, status: p.status, export_selected: p.export_selected }));
}

export const USE_TABS: UseTab[] = ['규제', '라벨', '서류'];

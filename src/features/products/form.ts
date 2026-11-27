// 등록 · 수정 화면의 입력 모델과 저장 규칙 (Claude)
// 규칙: 사람이 새로 적거나 바꾼 값 = confirmed. 빈 칸은 답변(제조사에 확인 중 등)에 따라 상태를 정한다.
import { NUTRIENT_KEYS, type Component, type FieldStatus, type FieldStatusValue, type Ingredient, type LabelItemKey, type LabelPackLevel, type LabelText, type Nutrition,
  type Product, type ProductExport, type TriState, type WaitReason } from '@/features/products/types';
import type { PackagingPart, ProductDetail } from './data';
import { COMPONENT_FIELDS, COMPOSITE_FIELDS, EXPORT_FIELDS, PRODUCT_FIELDS, type FieldDef } from './fields';

/** 묶은 칸(포장 크기 등)의 보여 줄 값: 하나라도 있으면 "143 × 143 × 98" (빈 칸은 ?) */
export function composite_text(src: Record<string, unknown> | null | undefined, key: string): string {
  const c = COMPOSITE_FIELDS[key];
  const v = c.cols.map((k) => src?.[k]).map((x) => (x == null ? '' : String(x).trim()));
  return v.some((x) => x !== '') ? v.map((x) => x || '?').join(' × ') : '';
}

/** 빈 칸에 고르는 답변. confirm = 값이 맞다고 확인 */
export type Answer = '' | WaitReason | 'not_applicable' | 'confirm';
export const ANSWER_LABEL: Record<Exclude<Answer, '' | 'confirm'>, string> = {
  asking_supplier: '제조사에 확인 중',
  undecided: '아직 정하지 않음',
  not_applicable: '해당 없음',
  unknown: '모름',
};

export const PRODUCT_TEXT_KEYS = [
  'name_ko', 'name_en', 'net_content_value', 'net_content_unit', 'net_content_note', 'serving_desc', 'servings_per_pack',
  'storage_condition', 'date_type', 'date_period', 'manufacturer_name', 'finished_country', 'gtin', 'halal', 'storage_text', 'cooking_en',
  'caution_en', 'claims', 'pack_w_mm', 'pack_d_mm', 'pack_h_mm', 'label_w_mm', 'label_h_mm',
] as const;
export const EXPORT_TEXT_KEYS = [
  'hs6', 'unit_price', 'currency', 'units_per_ctn', 'ctn_net_kg', 'ctn_gross_kg', 'ctn_l_cm', 'ctn_w_cm', 'ctn_h_cm',
  'unit_gross_g', 'pallet_l_cm', 'pallet_w_cm', 'pallet_layers', 'pallet_ctn_count',
] as const;
const PRODUCT_NUM = new Set(['net_content_value', 'servings_per_pack', 'pack_w_mm', 'pack_d_mm', 'pack_h_mm', 'label_w_mm', 'label_h_mm']);
const EXPORT_NUM = new Set(EXPORT_TEXT_KEYS.filter((k) => !['hs6', 'currency'].includes(k)));

export type CompForm = {
  id: string; isNew: boolean;
  name: string; amount: string; unit: 'g' | 'mL'; quantity: string;
  manufacturer_name: string; manufacturer_public: '' | 'yes' | 'no';
  report_no: string; food_type_kr: string;
  animal_ingredient: TriState; animal_ingredient_detail: string; cross_contact: string;
  unit_weight_g: string; nutrition_source: string;
  ingredients: string;                          // 한 줄에 원료 하나: 이름(원산지) · INS 330 · 산도조절제
  nutrition: Record<keyof Nutrition, string>;
};

export type ProductForm = {
  id: string; isNew: boolean; code: string;
  p: Record<(typeof PRODUCT_TEXT_KEYS)[number], string>;
  comps: CompForm[];
  packaging: { part: string; material: string; separable: '' | '분리됨' | '붙어 있음' }[];
  exp: Record<(typeof EXPORT_TEXT_KEYS)[number], string>;
  labels: { language: string; pack_level: LabelPackLevel; item_key: LabelItemKey; text: string; source: string }[];   // 기존 라벨 문구
  answers: Record<string, Answer>;              // key: statusKey()
  aiNotes?: Record<string, string>;            // AI가 채운 칸 → 확인 필요 + 근거 메모
};

export const status_key = (entity: 'product' | 'component', id: string, field: string) => `${entity}:${id}:${field}`;
const s = (v: unknown) => (v == null ? '' : String(v));

// ---- 원재료 한 줄 ↔ 표 ----
export function ingredient_line(i: Pick<Ingredient, 'name' | 'origin' | 'ins_no' | 'additive_function'>): string {
  return [i.name + (i.origin ? `(${i.origin})` : ''), i.ins_no && `INS ${i.ins_no}`, i.additive_function].filter(Boolean).join(' · ');
}

/** 한 줄에 원료 하나. 앞에 칸을 띄우거나 "-"로 시작하면 바로 위 원료의 하위 원료 */
export function parse_ingredients(text: string, component_id: string, before: Ingredient[]): Ingredient[] {
  const out: Ingredient[] = [];
  let parent: Ingredient | null = null;
  let top = 0; let sub = 0;
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    const is_child = /^(\s+|-\s*)/.test(raw) && parent !== null;
    const line = raw.replace(/^\s*-?\s*/, '').trim();
    const [head, ...rest] = line.split(/\s*·\s*/);
    const m = head.match(/^(.+?)\s*\((.+)\)$/);
    const name = (m ? m[1] : head).trim();
    let ins: string | null = null; let fn: string | null = null;
    for (const r of rest) {
      const im = r.match(/^INS\s*(\S+)$/i);
      if (im) ins = im[1]; else fn = r;
    }
    const parent_id = is_child ? parent!.id : null;
    // 알레르기 · 표기 함량은 같은 자리(부모 · 이름)가 같으면 이어받음
    const prev_parent = parent_id ? before.find((b) => b.id === parent_id) : null;
    const prev = before.find((b) => b.name === name && (is_child ? b.parent_id === prev_parent?.id && !!prev_parent : !b.parent_id));
    const ing: Ingredient = {
      id: prev?.id ?? crypto.randomUUID(), component_id: component_id, parent_id: parent_id, seq: is_child ? ++sub : ++top, name,
      origin: m ? m[2].trim() : null, is_organic: prev?.is_organic ?? false,
      is_additive: !!(ins || fn), additive_function: fn, ins_no: ins,
      allergens: prev?.allergens ?? [], labeled_pct: prev?.labeled_pct ?? null, pct_basis: prev?.pct_basis ?? null,
    };
    if (!is_child) { parent = ing; sub = 0; }
    out.push(ing);
  }
  return out;
}

/** 원재료 표 → 입력칸 글 (하위 원료는 두 칸 들여쓰기) */
export function ingredients_text(list: Ingredient[]): string {
  const tops = list.filter((i) => !i.parent_id).sort((a, b) => a.seq - b.seq);
  return tops.flatMap((t) => [ingredient_line(t), ...list.filter((i) => i.parent_id === t.id).sort((a, b) => a.seq - b.seq).map((c) => `  ${ingredient_line(c)}`)]).join('\n');
}

/** 화면 표시용 한 줄: 고춧가루(중국산) [고추, 소금] */
export function ingredients_display(list: Ingredient[]): string[] {
  const tops = list.filter((i) => !i.parent_id).sort((a, b) => a.seq - b.seq);
  return tops.map((t) => {
    const kids = list.filter((i) => i.parent_id === t.id).sort((a, b) => a.seq - b.seq).map(ingredient_line);
    return ingredient_line(t) + (kids.length ? ` [${kids.join(', ')}]` : '');
  });
}

// ---- 화면 → 칸 값 (상태 판단용) ----
type Tracked = { entity: 'product' | 'component'; id: string; def: FieldDef; value: string; scope: string };

function blank_tri(v: string) { return v === '' || v === '미확인' ? '' : v; }

export function tracked_fields(f: ProductForm): Tracked[] {
  const out: Tracked[] = [];
  const pv = (k: string): string => {
    if (k === 'packaging') return f.packaging.filter((x) => x.material.trim()).map((x) => `${x.part} ${x.material}`).join(', ');
    if (k === 'halal') return blank_tri(f.p.halal);
    if (k in COMPOSITE_FIELDS) return composite_text(f.p, k);
    return s((f.p as Record<string, string>)[k]).trim();
  };
  for (const def of PRODUCT_FIELDS) out.push({ entity: 'product', id: f.id, def, value: pv(def.key), scope: f.p.name_ko });
  for (const c of f.comps) {
    for (const def of COMPONENT_FIELDS) {
      if (def.key === 'unit_weight_g' && c.unit === 'g') continue;
      const raw = def.key === 'animal_ingredient' ? blank_tri(c.animal_ingredient) : s((c as unknown as Record<string, unknown>)[def.key]).trim();
      out.push({ entity: 'component', id: c.id, def, value: raw, scope: c.name });
    }
  }
  for (const def of EXPORT_FIELDS) {
    if (def.key === 'hsk10') continue;   // HS 찾기로만 확정 (화면에서 적지 않음)
    const value = def.key in COMPOSITE_FIELDS ? composite_text(f.exp, def.key) : s(f.exp[def.key as keyof ProductForm['exp']]).trim();
    out.push({ entity: 'product', id: f.id, def, value, scope: f.p.name_ko });
  }
  return out;
}

// ---- DB → 화면 ----
const empty_nut = () => Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, ''])) as Record<keyof Nutrition, string>;

export function new_comp(): CompForm {
  return {
    id: crypto.randomUUID(), isNew: true, name: '', amount: '', unit: 'g', quantity: '1',
    manufacturer_name: '', manufacturer_public: '', report_no: '', food_type_kr: '',
    animal_ingredient: '미확인', animal_ingredient_detail: '', cross_contact: '', unit_weight_g: '', nutrition_source: '',
    ingredients: '', nutrition: empty_nut(),
  };
}

export function to_form(d: ProductDetail | null): ProductForm {
  const p = (d?.product ?? {}) as Partial<Product>;
  const form: ProductForm = {
    id: d?.product.id ?? crypto.randomUUID(), isNew: !d, code: d?.product.code ?? '',
    p: Object.fromEntries(PRODUCT_TEXT_KEYS.map((k) => [k, s(p[k as keyof Product])])) as ProductForm['p'],
    comps: (d?.components ?? []).map((pc) => {
      const c = pc.component;
      return {
        id: c.id, isNew: false, name: c.name, amount: s(pc.amount), unit: pc.unit, quantity: s(pc.quantity),
        manufacturer_name: s(c.manufacturer_name), manufacturer_public: c.manufacturer_public == null ? '' : c.manufacturer_public ? 'yes' : 'no',
        report_no: s(c.report_no), food_type_kr: s(c.food_type_kr), animal_ingredient: c.animal_ingredient,
        animal_ingredient_detail: s(c.animal_ingredient_detail), cross_contact: s(c.cross_contact),
        unit_weight_g: s(c.unit_weight_g), nutrition_source: s(c.nutrition_source),
        ingredients: ingredients_text((d?.ingredients ?? []).filter((i) => i.component_id === c.id)),
        nutrition: pc.nutrition ? (Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, s(pc.nutrition![k])])) as CompForm['nutrition']) : empty_nut(),
      };
    }),
    packaging: (d?.packaging ?? []).map((x) => ({ part: x.part, material: s(x.material), separable: (x.separable ?? '') as '' })),
    exp: Object.fromEntries(EXPORT_TEXT_KEYS.map((k) => [k, s(d?.exportInfo?.[k as keyof ProductExport])])) as ProductForm['exp'],
    labels: (d?.labelTexts ?? []).map((x) => ({ language: x.language, pack_level: x.pack_level, item_key: x.item_key, text: x.text, source: s(x.source) })),
    answers: {},
  };
  if (!d) { form.p.halal = '미확인'; form.p.net_content_unit = 'g'; form.comps = [new_comp()]; form.packaging = [{ part: '', material: '', separable: '' }]; }
  for (const t of tracked_fields(form)) {
    const row = d?.statuses.find((r) => r.entity_type === t.entity && r.entity_id === t.id && r.field_key === t.def.key);
    if (row?.status === 'not_applicable') form.answers[status_key(t.entity, t.id, t.def.key)] = 'not_applicable';
    else if (row?.wait_reason) form.answers[status_key(t.entity, t.id, t.def.key)] = row.wait_reason;
  }
  return form;
}

// ---- 화면 → DB 줄 ----
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));
const txt = (v: string) => (v.trim() === '' ? null : v.trim());

export type SaveRows = {
  product: Omit<Product, 'created_at' | 'updated_at'>;
  components: Component[];
  links: { product_id: string; component_id: string; amount: number; unit: 'g' | 'mL'; quantity: number; sort_order: number }[];
  ingredients: Ingredient[];
  nutrition: (Nutrition & { component_id: string })[];
  packaging: PackagingPart[];
  labelTexts: LabelText[];
  exportInfo: Partial<ProductExport> & { product_id: string } | null;
  statuses: Omit<FieldStatus, 'id' | 'updated_at'>[];
};

export function validate(f: ProductForm): string[] {
  const e: string[] = [];
  if (!f.p.name_ko.trim()) e.push('제품명을 적어 주세요.');
  if (f.comps.length === 0) e.push('구성품을 하나 이상 넣어 주세요.');
  f.comps.forEach((c, i) => {
    if (!c.name.trim()) e.push(`구성품 ${i + 1}의 이름을 적어 주세요.`);
    if (!(Number(c.amount) > 0)) e.push(`${c.name || `구성품 ${i + 1}`}의 양을 숫자로 적어 주세요.`);
  });
  const bad = (k: string, v: string) => v.trim() !== '' && Number.isNaN(Number(v.replace(/,/g, ''))) && k;
  for (const k of PRODUCT_NUM) if (bad(k, f.p[k as keyof ProductForm['p']])) e.push(`숫자만 넣을 수 있는 칸이 있어요 (${k}).`);
  for (const k of EXPORT_NUM) if (bad(k, f.exp[k as keyof ProductForm['exp']])) e.push(`숫자만 넣을 수 있는 칸이 있어요 (${k}).`);
  if (f.exp.hs6.trim() && !/^\d{6}$/.test(f.exp.hs6.trim())) e.push('HS 6자리는 숫자 6개로 적어 주세요.');
  return e;
}

/** prevBase: 저장 전 상태 비교용. 다른 제품에서 불러온 구성품까지 합친 것 (없으면 before) */
export function to_rows(f: ProductForm, before: ProductDetail | null, today = new Date(), prev_base?: ProductDetail | null): SaveRows {
  const base = prev_base ?? before;
  // 수출할 제품 체크는 목록 · 상세에서 따로 바꾼다 (등록 · 수정 화면은 원래 값 유지)
  const p: Record<string, unknown> = { id: f.id, code: f.code, status: before?.product.status ?? 'draft', export_selected: before?.product.export_selected ?? false };
  for (const k of PRODUCT_TEXT_KEYS) p[k] = PRODUCT_NUM.has(k) ? num(f.p[k]) : txt(f.p[k]);
  p.halal = f.p.halal || '미확인';

  const components: Component[] = f.comps.map((c) => ({
    id: c.id, name: c.name.trim(), manufacturer_name: txt(c.manufacturer_name),
    manufacturer_public: c.manufacturer_public === '' ? null : c.manufacturer_public === 'yes',
    report_no: txt(c.report_no), food_type_kr: txt(c.food_type_kr), animal_ingredient: c.animal_ingredient,
    animal_ingredient_detail: txt(c.animal_ingredient_detail), cross_contact: txt(c.cross_contact),
    nutrition_basis: c.unit === 'mL' ? '100mL' : '100g', unit_weight_g: c.unit === 'mL' ? num(c.unit_weight_g) : null,
    nutrition_source: txt(c.nutrition_source),
  }));
  const links = f.comps.map((c, i) => ({ product_id: f.id, component_id: c.id, amount: Number(c.amount), unit: c.unit, quantity: Number(c.quantity) || 1, sort_order: i + 1 }));
  const ingredients = f.comps.flatMap((c) => parse_ingredients(c.ingredients, c.id, base?.ingredients.filter((i) => i.component_id === c.id) ?? []));
  const nutrition = f.comps.map((c) => ({ component_id: c.id, ...(Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, num(c.nutrition[k])])) as unknown as Nutrition) }));
  const packaging: PackagingPart[] = f.packaging.filter((x) => x.part.trim()).map((x, i) => ({
    id: crypto.randomUUID(), part: x.part.trim(), material: txt(x.material), separable: x.separable || null, sort_order: i + 1,
  }));

  const label_texts: LabelText[] = f.labels.filter((x) => x.text.trim()).map((x, i) => ({
    id: crypto.randomUUID(), language: x.language.trim() || '영어', pack_level: x.pack_level, item_key: x.item_key,
    text: x.text.trim(), source: txt(x.source), sort_order: i + 1,
  }));

  const exp_has = EXPORT_TEXT_KEYS.some((k) => f.exp[k].trim() !== '') || !!before?.exportInfo;
  const export_info = exp_has
    ? { ...(before?.exportInfo ?? {}), product_id: f.id, ...Object.fromEntries(EXPORT_TEXT_KEYS.map((k) => [k, EXPORT_NUM.has(k) ? num(f.exp[k]) : txt(f.exp[k])])) }
    : null;

  return { product: p as SaveRows['product'], components, links, ingredients, nutrition, packaging, labelTexts: label_texts, exportInfo: export_info, statuses: next_statuses(f, base, today) };
}

/** 저장할 때 칸 상태를 정한다. 바뀌지 않은 칸은 원래 상태를 그대로 둔다. */
export function next_statuses(f: ProductForm, before: ProductDetail | null, today = new Date()): SaveRows['statuses'] {
  const prev = new Map(before ? tracked_fields(to_form(before)).map((t) => [status_key(t.entity, t.id, t.def.key), t.value]) : []);
  const day = today.toISOString().slice(0, 10);
  const out: SaveRows['statuses'] = [];
  for (const t of tracked_fields(f)) {
    const key = status_key(t.entity, t.id, t.def.key);
    const row = before?.statuses.find((r) => r.entity_type === t.entity && r.entity_id === t.id && r.field_key === t.def.key);
    const answer = f.answers[key] ?? '';
    const base = { entity_type: t.entity, entity_id: t.id, field_key: t.def.key, wait_reason: null, wait_who: null, requested_at: null,
      note: row?.note ?? null, source_doc_id: row?.source_doc_id ?? null, updated_by: null } as SaveRows['statuses'][number];
    let status: FieldStatusValue | null = null;

    if (t.value !== '') {
      const changed = t.value !== (prev.get(key) ?? '');
      const ai = f.aiNotes?.[key];
      if (changed && ai) { status = 'needs_check'; base.note = ai; }
      else if (changed || answer === 'confirm') { status = 'confirmed'; base.note = null; }
    } else if (answer === 'not_applicable') {
      status = 'not_applicable';
    } else if (answer === 'asking_supplier' || answer === 'undecided' || answer === 'unknown') {
      status = 'missing';
      base.wait_reason = answer;
      base.wait_who = row?.wait_reason === answer ? row.wait_who : answer === 'asking_supplier' ? `${t.scope} 제조사` : answer === 'undecided' ? '혜윰' : null;
      base.requested_at = row?.wait_reason === answer ? row.requested_at : answer === 'unknown' ? null : day;
    } else if (row && (row.status !== 'missing' || row.wait_reason)) {
      status = 'missing';                      // 값을 지웠거나 답변을 풀었으면 다시 비어 있음
    } else if ((prev.get(key) ?? '') !== '') {
      status = 'missing';
    }
    if (status) out.push({ ...base, status });
  }
  return out;
}

/** 불러오기용: 다른 제품에 이미 등록된 구성품 → 입력칸 (양 · 봉 수는 새로 적음) */
export function comp_from_library(l: { component: Component; nutrition: Nutrition | null; ingredients: Ingredient[] }): CompForm {
  const c = l.component;
  return {
    id: c.id, isNew: false, name: c.name, amount: '', unit: c.nutrition_basis === '100mL' ? 'mL' : 'g', quantity: '1',
    manufacturer_name: s(c.manufacturer_name), manufacturer_public: c.manufacturer_public == null ? '' : c.manufacturer_public ? 'yes' : 'no',
    report_no: s(c.report_no), food_type_kr: s(c.food_type_kr), animal_ingredient: c.animal_ingredient,
    animal_ingredient_detail: s(c.animal_ingredient_detail), cross_contact: s(c.cross_contact),
    unit_weight_g: s(c.unit_weight_g), nutrition_source: s(c.nutrition_source),
    ingredients: ingredients_text(l.ingredients),
    nutrition: l.nutrition ? (Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, s(l.nutrition![k])])) as CompForm['nutrition']) : empty_nut(),
  };
}

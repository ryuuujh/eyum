// Supabase 연결 전 화면 개발용 예시 데이터 (supabase/seed.sql과 같은 값)
import type { Component, FieldStatus, Ingredient, Nutrition, Product, ProductExport } from '@/features/products/types';

const P = '11111111-0000-4000-8000-000000000001';
const C1 = '22222222-0000-4000-8000-000000000001';
const C2 = '22222222-0000-4000-8000-000000000002';
const C3 = '22222222-0000-4000-8000-000000000003';
const now = '2026-11-25T00:00:00Z';

const empty_product = {
  name_en: null, net_content_value: null, net_content_unit: null, net_content_note: null,
  serving_desc: null, servings_per_pack: null, storage_condition: null, date_type: null, date_period: null,
  manufacturer_name: null, finished_country: null, gtin: null, halal: '미확인', storage_text: null, cooking_en: null, caution_en: null,
  claims: null, pack_w_mm: null, pack_d_mm: null, pack_h_mm: null, label_w_mm: null, label_h_mm: null,
  status: 'draft', created_at: now, updated_at: now,
} as const;

const _sampleProducts: Product[] = [
  {
    ...empty_product, id: P, code: 'ttok-ez', name_ko: '또떡EZ',
    net_content_value: 226, net_content_unit: 'g', net_content_note: '조리수 제외',
    serving_desc: '1인분', servings_per_pack: 2, storage_condition: '상온', finished_country: '대한민국',
  },
];

const comp = (c: Partial<Component> & Pick<Component, 'id' | 'name'>): Component => ({
  manufacturer_name: null, manufacturer_public: null, report_no: null, food_type_kr: null,
  animal_ingredient: '미확인', animal_ingredient_detail: null, cross_contact: null,
  nutrition_basis: '100g', unit_weight_g: null, nutrition_source: null, ...c,
});

const _sampleComponents: Component[] = [
  comp({ id: C1, name: '떡볶이떡-S', manufacturer_name: '농업회사법인 주식회사 푸르메에프에스', manufacturer_public: true,
    report_no: '20140487270112', food_type_kr: '떡류', animal_ingredient: '없음', nutrition_source: '시험성적서 · 휴먼바이오 · 2026.03.20' }),
  comp({ id: C2, name: '파우더A', animal_ingredient: '없음', nutrition_source: '시험성적서 · 바이오푸드랩 · 2026.07.27' }),
  comp({ id: C3, name: '양조간장 501', manufacturer_name: '샘표', manufacturer_public: true,
    nutrition_basis: '100mL', nutrition_source: '제품 라벨 표시값 (100mL당)' }),
];

const N = (kcal: number, sodium_mg: number, carb_g: number, sugar_g: number, fat_g: number, sat_fat_g: number, protein_g: number): Nutrition =>
  ({ kcal, sodium_mg, carb_g, sugar_g, fat_g, sat_fat_g, trans_fat_g: null, cholesterol_mg: null, protein_g, fiber_g: null });

const _sampleNutrition: Record<string, Nutrition> = {
  [C1]: N(218.3, 173.21, 48.8, 0, 0.76, 0.21, 4.22),
  [C2]: N(338.2, 1736.9, 71.76, 61.82, 0.4, 0.11, 11.88),
  [C3]: N(100, 6300, 9, 2, 0.1, 0, 10),
};

const _sampleLinks = [
  { product_id: P, component_id: C1, amount: 100, unit: 'g' as const, quantity: 2, sort_order: 1 },
  { product_id: P, component_id: C2, amount: 20, unit: 'g' as const, quantity: 1, sort_order: 2 },
  { product_id: P, component_id: C3, amount: 6, unit: 'mL' as const, quantity: 1, sort_order: 3 },
];

const ing = (id: string, seq: number, name: string, extra: Partial<Ingredient> = {}): Ingredient => ({
  id: `33333333-0000-4000-80${id.slice(-2)}-${String(seq).padStart(12, "0")}`, component_id: id, parent_id: null, seq, name, origin: null, is_organic: false,
  is_additive: false, additive_function: null, ins_no: null, allergens: [], labeled_pct: null, pct_basis: null, ...extra,
});
const _sampleIngredients: Ingredient[] = [
  ing(C1, 1, '쌀', { origin: '미국산' }),
  ing(C1, 2, '소금'),
  ing(C1, 3, '구연산', { is_additive: true, ins_no: '330' }),
  ing(C1, 4, '주정'),
  // 파우더A: 혜윰 회신 (2026-11-26) 원재료 순서만, 함량 없음
  ing(C2, 1, '토마토분말', { origin: '스페인산', allergens: ['토마토'] }),
  ing(C2, 2, '유기농 사탕수수당', { origin: '아르헨티나산', is_organic: true }),
  ing(C2, 3, '양파', { origin: '국산' }),
  ing(C2, 4, '마늘', { origin: '국산' }),
  ing(C2, 5, '다시마', { origin: '국산' }),
  ing(C3, 1, '양조간장', { origin: '국산', allergens: ['대두', '밀'] }),
];

const _sampleExport: ProductExport[] = [];

const _samplePackaging: { product_id: string; id: string; part: string; material: string | null; separable: string | null; sort_order: number }[] = [];

const fs = (entity_type: FieldStatus['entity_type'], entity_id: string, field_key: string, status: FieldStatus['status'],
  extra: Partial<FieldStatus> = {}): FieldStatus => ({
  id: `${entity_id}-${field_key}`, entity_type, entity_id, field_key, status, wait_reason: null, wait_who: null,
  requested_at: null, note: null, source_doc_id: null, updated_by: null, updated_at: now, ...extra,
});

const _sampleStatus: FieldStatus[] = [
  fs('product', P, 'net_content_value', 'needs_check', { note: '간장 6mL를 6g으로 본 값' }),
  fs('product', P, 'finished_country', 'confirmed', { note: '영어 라벨(10.14) Country of Origin: Republic of Korea' }),
  fs('product', P, 'storage_condition', 'confirmed', { note: '영어 라벨(10.14) Store in a cool, dry place' }),
  fs('product', P, 'name_en', 'missing', { wait_reason: 'undecided', wait_who: '혜윰', requested_at: '2026-11-25' }),
  fs('component', C1, 'food_type_kr', 'needs_check', { note: '라벨의 "떡류, 복합조미식품"에서 추정' }),
  fs('component', C1, 'animal_ingredient', 'needs_check', { note: '원재료 기준, 하위 원료 확인 전' }),
  fs('component', C1, 'ingredients', 'needs_check', { note: '구연산 용도(산도조절제 등)가 자료에 없음' }),
  fs('component', C2, 'animal_ingredient', 'needs_check', { note: '원재료 기준 없음으로 보임 (다시마는 해조류), 혜윰 확인 전' }),
  fs('component', C2, 'ingredients', 'needs_check', { note: '순서는 혜윰 회신(11/26), 원산지 · 알레르기는 영어 라벨(10.14). 영어 라벨엔 3번째에 소금이 있어 혜윰 확인 중' }),
  fs('component', C3, 'ingredients', 'needs_check', { note: '영어 라벨(10.14) 기준 한 줄 원재료(하위 원료 구분 안 함, 혜윰). 11/30 미팅에서 확인' }),
  fs('component', C2, 'manufacturer_name', 'missing', { wait_reason: 'asking_supplier', wait_who: '파우더A 제조사', requested_at: '2026-11-25' }),
  fs('component', C3, 'manufacturer_name', 'needs_check', { note: '정식 제조원명 필요' }),
  fs('component', C3, 'unit_weight_g', 'missing', { note: '6mL = 몇 g인지 없음 → 100g당 영양 보류' }),
  fs('component', C3, 'nutrition_source', 'needs_check', { note: '시험성적서 아님' }),
  fs('product', P, 'name_ko', 'confirmed'),
  fs('component', C1, 'manufacturer_name', 'confirmed'),
  fs('component', C1, 'report_no', 'confirmed'),
  fs('component', C1, 'nutrition_source', 'confirmed'),
  fs('component', C2, 'nutrition_source', 'confirmed'),
];

// 저장 화면과 읽기 화면이 같은 예시 데이터를 보도록 서버 메모리 한 곳에 둔다 (Supabase 연결 전 임시)
const G = globalThis as unknown as { __productSample?: Record<string, unknown> };
G.__productSample ??= { sampleProducts: _sampleProducts, sampleComponents: _sampleComponents, sampleNutrition: _sampleNutrition, sampleLinks: _sampleLinks, sampleIngredients: _sampleIngredients, sampleExport: _sampleExport, samplePackaging: _samplePackaging, sampleStatus: _sampleStatus };
const store = G.__productSample;
export const sample_products = store.sampleProducts as typeof _sampleProducts;
export const sample_components = store.sampleComponents as typeof _sampleComponents;
export const sample_nutrition = store.sampleNutrition as typeof _sampleNutrition;
export const sample_links = store.sampleLinks as typeof _sampleLinks;
export const sample_ingredients = store.sampleIngredients as typeof _sampleIngredients;
export const sample_export = store.sampleExport as typeof _sampleExport;
export const sample_packaging = store.samplePackaging as typeof _samplePackaging;
export const sample_status = store.sampleStatus as typeof _sampleStatus;

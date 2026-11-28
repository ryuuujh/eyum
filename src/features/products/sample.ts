// DB 미연결 화면에서 사용하는 가상 제품. 로컬 DB 초기화용 supabase/seed.sql과 같은 값이다.
import type { Component, FieldStatus, Ingredient, LabelText, Nutrition, Product, ProductExport } from '@/features/products/types';

const product_id = 'f1000000-0000-4000-8000-000000000001';
const puree_id = 'f2000000-0000-4000-8000-000000000001';
const crunch_id = 'f2000000-0000-4000-8000-000000000002';
const cream_id = 'f2000000-0000-4000-8000-000000000003';
const sample_time = '2026-11-28T00:00:00Z';

const _sampleProducts: Product[] = [{
  id: product_id, code: 'demo-pumpkin-soup', name_ko: '테스트 단호박 수프 키트', name_en: null,
  net_content_value: 180, net_content_unit: 'g', net_content_note: '가상 포장에 표시된 중량',
  serving_desc: '수프 한 그릇', servings_per_pack: 1, storage_condition: '냉장', finished_country: '캐나다',
  date_type: null, date_period: null, manufacturer_name: null, gtin: null, halal: '미확인',
  storage_text: null, cooking_en: null, caution_en: null, claims: null,
  pack_w_mm: null, pack_d_mm: null, pack_h_mm: null, label_w_mm: null, label_h_mm: null,
  outer_label_w_mm: null, outer_label_h_mm: null, export_selected: true, status: 'draft',
  created_at: sample_time, updated_at: sample_time,
}];

const component_defaults = {
  manufacturer_name: null, manufacturer_public: null, report_no: null, food_type_kr: null,
  animal_ingredient_detail: null, cross_contact: null, unit_weight_g: null,
};
const _sampleComponents: Component[] = [
  { ...component_defaults, id: puree_id, name: '단호박 퓌레', manufacturer_name: '실습용 가상 제조소',
    manufacturer_public: true, food_type_kr: '채소가공품', animal_ingredient: '없음', nutrition_basis: '100g', nutrition_source: '가상 영양표 A' },
  { ...component_defaults, id: crunch_id, name: '귀리 크런치', animal_ingredient: '미확인', nutrition_basis: '100g', nutrition_source: '가상 영양표 B' },
  { ...component_defaults, id: cream_id, name: '코코넛 크림', animal_ingredient: '없음', nutrition_basis: '100mL', nutrition_source: '가상 영양표 C' },
];

const _sampleNutrition: Record<string, Nutrition> = {
  [puree_id]: { kcal: 52, sodium_mg: 24, carb_g: 10.5, sugar_g: 3.8, fat_g: 0.6, sat_fat_g: 0.15,
    trans_fat_g: null, cholesterol_mg: null, protein_g: 1.1, fiber_g: null },
  [crunch_id]: { kcal: 384, sodium_mg: 48, carb_g: 58, sugar_g: 5.6, fat_g: 12.4, sat_fat_g: 1.8,
    trans_fat_g: null, cholesterol_mg: null, protein_g: 10.1, fiber_g: null },
  [cream_id]: { kcal: 164, sodium_mg: 19, carb_g: 3.2, sugar_g: 1.4, fat_g: 16.3, sat_fat_g: 12.7,
    trans_fat_g: null, cholesterol_mg: null, protein_g: 1.2, fiber_g: null },
};

const _sampleLinks = [
  { product_id, component_id: puree_id, amount: 125, unit: 'g' as const, quantity: 1, sort_order: 1 },
  { product_id, component_id: crunch_id, amount: 22, unit: 'g' as const, quantity: 1, sort_order: 2 },
  { product_id, component_id: cream_id, amount: 30, unit: 'mL' as const, quantity: 1, sort_order: 3 },
];

const ingredient_defaults = {
  parent_id: null, is_organic: false, is_additive: false, additive_function: null, ins_no: null,
  labeled_pct: null, pct_basis: null,
};
const _sampleIngredients: Ingredient[] = [
  { ...ingredient_defaults, id: 'f3000000-0000-4000-8001-000000000001', component_id: puree_id,
    seq: 1, name: '단호박', name_en: 'Pumpkin', origin: '캐나다산', allergens: [] },
  { ...ingredient_defaults, id: 'f3000000-0000-4000-8001-000000000002', component_id: puree_id,
    seq: 2, name: '당근', name_en: 'Carrot', origin: '벨기에산', allergens: [] },
  { ...ingredient_defaults, id: 'f3000000-0000-4000-8002-000000000001', component_id: crunch_id,
    seq: 1, name: '귀리 플레이크', name_en: 'Oat flakes', origin: '핀란드산', allergens: [] },
  { ...ingredient_defaults, id: 'f3000000-0000-4000-8002-000000000002', component_id: crunch_id,
    seq: 2, name: '아몬드 조각', name_en: 'Almond pieces', origin: '호주산', allergens: ['아몬드'] },
  { ...ingredient_defaults, id: 'f3000000-0000-4000-8003-000000000001', component_id: cream_id,
    seq: 1, name: '코코넛', name_en: 'Coconut', origin: '스리랑카산', allergens: [] },
  { ...ingredient_defaults, id: 'f3000000-0000-4000-8003-000000000002', component_id: cream_id,
    seq: 2, name: '물', name_en: 'Water', origin: '캐나다산', allergens: [] },
];

const _sampleExport: ProductExport[] = [];
const _samplePackaging: { product_id: string; id: string; part: string; material: string | null; separable: string | null; sort_order: number }[] = [];

function label_text(sort_order: number, item_key: LabelText['item_key'], text: string): LabelText & { product_id: string } {
  return {
    product_id, id: `f4000000-0000-4000-8000-${String(sort_order).padStart(12, '0')}`,
    language: '영어', pack_level: 'unit', item_key, text, source: '실습용 가상 포장 문안', sort_order,
  };
}
const _sampleLabelTexts = [
  label_text(1, 'product_name', 'Demo Pumpkin Soup Kit'),
  label_text(2, 'net_weight', 'Net weight per kit: 180 g.'),
  label_text(3, 'ingredients', 'Pumpkin puree (pumpkin, carrot), oat crunch (oat flakes, almond pieces), coconut cream (coconut, water). Contains almonds.'),
  label_text(4, 'storage', 'Keep the unopened kit refrigerated.'),
  label_text(5, 'origin', 'Made in Canada.'),
];

function field_status(seq: number, entity_type: FieldStatus['entity_type'], entity_id: string,
  field_key: string, status: FieldStatus['status'], extra: Partial<FieldStatus> = {}): FieldStatus {
  return {
    id: `f5000000-0000-4000-8000-${String(seq).padStart(12, '0')}`, entity_type, entity_id, field_key, status,
    wait_reason: null, wait_who: null, requested_at: null, note: null, source_doc_id: null, updated_by: null, updated_at: sample_time, ...extra,
  };
}
const _sampleStatus: FieldStatus[] = [
  field_status(1, 'product', product_id, 'finished_country', 'confirmed'),
  field_status(2, 'product', product_id, 'storage_condition', 'confirmed'),
  field_status(3, 'product', product_id, 'net_content_value', 'needs_check', { note: '가상 라벨의 표시 중량을 구성품 실측값과 대조하는 예시' }),
  field_status(4, 'product', product_id, 'name_en', 'missing', { wait_reason: 'undecided', wait_who: '실습용 라벨 담당', requested_at: '2026-11-28', note: '가상 라벨의 영문 상품명은 초안' }),
  field_status(5, 'component', puree_id, 'food_type_kr', 'needs_check', { note: '가상 제품 분류 검토 예시' }),
  field_status(6, 'component', puree_id, 'animal_ingredient', 'confirmed'),
  field_status(7, 'component', puree_id, 'ingredients', 'confirmed'),
  field_status(8, 'component', puree_id, 'nutrition_source', 'confirmed'),
  field_status(9, 'component', crunch_id, 'ingredients', 'needs_check', { note: '가상 크런치의 원재료 순서 재확인' }),
  field_status(10, 'component', crunch_id, 'animal_ingredient', 'missing', { wait_reason: 'asking_supplier', wait_who: '실습용 구성품 담당', requested_at: '2026-11-28' }),
  field_status(11, 'component', crunch_id, 'nutrition_source', 'confirmed'),
  field_status(12, 'component', cream_id, 'ingredients', 'confirmed'),
  field_status(13, 'component', cream_id, 'animal_ingredient', 'confirmed'),
  field_status(14, 'component', cream_id, 'unit_weight_g', 'missing', { note: '한 포 실측 전에는 100g당 영양값을 보류' }),
  field_status(15, 'component', cream_id, 'nutrition_source', 'needs_check', { note: '가상 크림의 표시 기준 재확인' }),
];

// 저장 화면과 읽기 화면이 같은 예시 데이터를 보도록 서버 메모리 한 곳에 둔다 (Supabase 연결 전 임시)
const G = globalThis as unknown as { __product_sample_v2?: Record<string, unknown> };
G.__product_sample_v2 ??= { sampleProducts: _sampleProducts, sampleComponents: _sampleComponents, sampleNutrition: _sampleNutrition, sampleLinks: _sampleLinks, sampleIngredients: _sampleIngredients, sampleExport: _sampleExport, samplePackaging: _samplePackaging, sampleLabelTexts: _sampleLabelTexts, sampleStatus: _sampleStatus };
const store = G.__product_sample_v2;
export const sample_products = store.sampleProducts as typeof _sampleProducts;
export const sample_components = store.sampleComponents as typeof _sampleComponents;
export const sample_nutrition = store.sampleNutrition as typeof _sampleNutrition;
export const sample_links = store.sampleLinks as typeof _sampleLinks;
export const sample_ingredients = store.sampleIngredients as typeof _sampleIngredients;
export const sample_export = store.sampleExport as typeof _sampleExport;
export const sample_packaging = store.samplePackaging as typeof _samplePackaging;
export const sample_label_texts = store.sampleLabelTexts as typeof _sampleLabelTexts;
export const sample_status = store.sampleStatus as typeof _sampleStatus;

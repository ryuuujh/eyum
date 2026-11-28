// DB 미연결 화면에서 사용하는 가상 제품. 로컬 DB 초기화용 supabase/seed.sql과 같은 값이다.
import type { Component, FieldStatus, Ingredient, LabelText, Nutrition, Product, ProductExport } from '@/features/products/types';

const product_id = 'd1000000-0000-4000-8000-000000000001';
const cake_id = 'd2000000-0000-4000-8000-000000000001';
const garnish_id = 'd2000000-0000-4000-8000-000000000002';
const sauce_id = 'd2000000-0000-4000-8000-000000000003';
const sample_time = '2026-11-28T00:00:00Z';

const _sampleProducts: Product[] = [{
  id: product_id, code: 'demo-tteokbokki', name_ko: '테스트 떡볶이', name_en: 'Test Tteokbokki',
  net_content_value: 166, net_content_unit: 'g', net_content_note: '떡·고명·소스 합계의 가상 포장 표시값',
  serving_desc: '떡볶이 1인분', servings_per_pack: 1, storage_condition: '냉동', finished_country: '태국',
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
  { ...component_defaults, id: cake_id, name: '조랭이떡', manufacturer_name: '가상 떡 실습실',
    manufacturer_public: true, food_type_kr: '떡류', animal_ingredient: '없음', nutrition_basis: '100g', nutrition_source: '가상 조랭이떡 영양표' },
  { ...component_defaults, id: garnish_id, name: '대파 참깨 고명', animal_ingredient: '미확인', nutrition_basis: '100g', nutrition_source: '가상 고명 영양표' },
  { ...component_defaults, id: sauce_id, name: '사과 고추 소스', animal_ingredient: '없음', nutrition_basis: '100mL', nutrition_source: '가상 소스 영양표' },
];

const _sampleNutrition: Record<string, Nutrition> = {
  [cake_id]: { kcal: 203, sodium_mg: 18, carb_g: 44.5, sugar_g: 0.8, fat_g: 0.7, sat_fat_g: 0.1,
    trans_fat_g: null, cholesterol_mg: null, protein_g: 4.6, fiber_g: null },
  [garnish_id]: { kcal: 403, sodium_mg: 66, carb_g: 38.5, sugar_g: 6.2, fat_g: 19.2, sat_fat_g: 2.8,
    trans_fat_g: null, cholesterol_mg: null, protein_g: 15.4, fiber_g: null },
  [sauce_id]: { kcal: 57, sodium_mg: 31, carb_g: 12.6, sugar_g: 7.8, fat_g: 0.3, sat_fat_g: 0.05,
    trans_fat_g: null, cholesterol_mg: null, protein_g: 0.9, fiber_g: null },
};

const _sampleLinks = [
  { product_id, component_id: cake_id, amount: 110, unit: 'g' as const, quantity: 1, sort_order: 1 },
  { product_id, component_id: garnish_id, amount: 8, unit: 'g' as const, quantity: 1, sort_order: 2 },
  { product_id, component_id: sauce_id, amount: 45, unit: 'mL' as const, quantity: 1, sort_order: 3 },
];

const ingredient_defaults = {
  parent_id: null, is_organic: false, is_additive: false, additive_function: null, ins_no: null,
  labeled_pct: null, pct_basis: null,
};
const _sampleIngredients: Ingredient[] = [
  { ...ingredient_defaults, id: 'd3000000-0000-4000-8001-000000000001', component_id: cake_id,
    seq: 1, name: '쌀가루', name_en: 'Rice flour', origin: '태국산', allergens: [] },
  { ...ingredient_defaults, id: 'd3000000-0000-4000-8001-000000000002', component_id: cake_id,
    seq: 2, name: '기장가루', name_en: 'Millet flour', origin: '프랑스산', allergens: [] },
  { ...ingredient_defaults, id: 'd3000000-0000-4000-8002-000000000001', component_id: garnish_id,
    seq: 1, name: '건대파', name_en: 'Dried green onion', origin: '대만산', allergens: [] },
  { ...ingredient_defaults, id: 'd3000000-0000-4000-8002-000000000002', component_id: garnish_id,
    seq: 2, name: '볶은 참깨', name_en: 'Roasted sesame seeds', origin: '인도산', allergens: ['참깨'] },
  { ...ingredient_defaults, id: 'd3000000-0000-4000-8003-000000000001', component_id: sauce_id,
    seq: 1, name: '사과 퓌레', name_en: 'Apple puree', origin: '폴란드산', allergens: [] },
  { ...ingredient_defaults, id: 'd3000000-0000-4000-8003-000000000002', component_id: sauce_id,
    seq: 2, name: '물', name_en: 'Water', origin: '태국산', allergens: [] },
  { ...ingredient_defaults, id: 'd3000000-0000-4000-8003-000000000003', component_id: sauce_id,
    seq: 3, name: '고춧가루', name_en: 'Chili powder', origin: '튀르키예산', allergens: [] },
];

const _sampleExport: ProductExport[] = [];
const _samplePackaging: { product_id: string; id: string; part: string; material: string | null; separable: string | null; sort_order: number }[] = [];

function label_text(sort_order: number, item_key: LabelText['item_key'], text: string): LabelText & { product_id: string } {
  return {
    product_id, id: `d4000000-0000-4000-8000-${String(sort_order).padStart(12, '0')}`,
    language: '영어', pack_level: 'unit', item_key, text, source: '떡볶이 가상 라벨 초안', sort_order,
  };
}
const _sampleLabelTexts = [
  label_text(1, 'product_name', 'Test Tteokbokki'),
  label_text(2, 'net_weight', 'Net weight: 166 g (one serving).'),
  label_text(3, 'ingredients', 'Rice cakes (rice flour, millet flour), apple chili sauce (apple puree, water, chili powder), green onion and sesame garnish (dried green onion, roasted sesame seeds). Contains sesame.'),
  label_text(4, 'storage', 'Keep frozen until ready to cook.'),
  label_text(5, 'origin', 'Made in Thailand.'),
];

function field_status(seq: number, entity_type: FieldStatus['entity_type'], entity_id: string,
  field_key: string, status: FieldStatus['status'], extra: Partial<FieldStatus> = {}): FieldStatus {
  return {
    id: `d5000000-0000-4000-8000-${String(seq).padStart(12, '0')}`, entity_type, entity_id, field_key, status,
    wait_reason: null, wait_who: null, requested_at: null, note: null, source_doc_id: null, updated_by: null, updated_at: sample_time, ...extra,
  };
}
const _sampleStatus: FieldStatus[] = [
  field_status(1, 'product', product_id, 'finished_country', 'confirmed'),
  field_status(2, 'product', product_id, 'storage_condition', 'confirmed'),
  field_status(3, 'product', product_id, 'net_content_value', 'needs_check', { note: '소스 실중량 확인 후 가상 포장의 166g과 대조' }),
  field_status(4, 'product', product_id, 'manufacturer_name', 'missing', { wait_reason: 'asking_supplier', wait_who: '실습용 포장 담당', requested_at: '2026-11-28', note: '완제품 제조원 표기 대기' }),
  field_status(5, 'component', cake_id, 'food_type_kr', 'needs_check', { note: '조랭이떡 식품유형을 가상 사양서와 대조' }),
  field_status(6, 'component', cake_id, 'animal_ingredient', 'confirmed'),
  field_status(7, 'component', cake_id, 'ingredients', 'confirmed'),
  field_status(8, 'component', cake_id, 'nutrition_source', 'confirmed'),
  field_status(9, 'component', garnish_id, 'ingredients', 'needs_check', { note: '고명의 건대파와 볶은 참깨 표시 순서 확인' }),
  field_status(10, 'component', garnish_id, 'animal_ingredient', 'missing', { wait_reason: 'asking_supplier', wait_who: '실습용 고명 담당', requested_at: '2026-11-28' }),
  field_status(11, 'component', garnish_id, 'nutrition_source', 'confirmed'),
  field_status(12, 'component', sauce_id, 'ingredients', 'confirmed'),
  field_status(13, 'component', sauce_id, 'animal_ingredient', 'confirmed'),
  field_status(14, 'component', sauce_id, 'unit_weight_g', 'missing', { note: '소스 한 포 실중량 확인 전에는 100g당 영양값 보류' }),
  field_status(15, 'component', sauce_id, 'nutrition_source', 'needs_check', { note: '소스의 가상 영양표가 100mL 기준인지 재확인' }),
  field_status(16, 'product', product_id, 'name_en', 'confirmed'),
];

// 저장 화면과 읽기 화면이 같은 예시 데이터를 보도록 서버 메모리 한 곳에 둔다 (Supabase 연결 전 임시)
const G = globalThis as unknown as { __product_sample_v3?: Record<string, unknown> };
G.__product_sample_v3 ??= { sampleProducts: _sampleProducts, sampleComponents: _sampleComponents, sampleNutrition: _sampleNutrition, sampleLinks: _sampleLinks, sampleIngredients: _sampleIngredients, sampleExport: _sampleExport, samplePackaging: _samplePackaging, sampleLabelTexts: _sampleLabelTexts, sampleStatus: _sampleStatus };
const store = G.__product_sample_v3;
export const sample_products = store.sampleProducts as typeof _sampleProducts;
export const sample_components = store.sampleComponents as typeof _sampleComponents;
export const sample_nutrition = store.sampleNutrition as typeof _sampleNutrition;
export const sample_links = store.sampleLinks as typeof _sampleLinks;
export const sample_ingredients = store.sampleIngredients as typeof _sampleIngredients;
export const sample_export = store.sampleExport as typeof _sampleExport;
export const sample_packaging = store.samplePackaging as typeof _samplePackaging;
export const sample_label_texts = store.sampleLabelTexts as typeof _sampleLabelTexts;
export const sample_status = store.sampleStatus as typeof _sampleStatus;

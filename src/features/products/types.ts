// 제품 등록·관리 타입 (Claude). DB 컬럼명과 같게 snake_case를 쓴다.

export type FieldStatusValue = 'confirmed' | 'needs_check' | 'missing' | 'on_hold' | 'not_applicable';
export type WaitReason = 'asking_supplier' | 'undecided' | 'unknown';
// accessory = 부속물품 공통 칸, accessory_option = 부속물품 옵션 칸 (HS 포함)
export type EntityType = 'product' | 'component' | 'ingredient' | 'accessory' | 'accessory_option';

export const STATUS_LABEL: Record<FieldStatusValue, string> = {
  confirmed: '확인됨',
  needs_check: '확인 필요',
  missing: '미확인',
  on_hold: '보류',
  not_applicable: '해당 없음',
};

export const WAIT_REASON_LABEL: Record<WaitReason, string> = {
  asking_supplier: '제조사에 확인 중',
  undecided: '아직 정하지 않음',
  unknown: '모름',
};

export interface FieldStatus {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  field_key: string;
  status: FieldStatusValue;
  wait_reason: WaitReason | null;
  wait_who: string | null;
  requested_at: string | null;   // YYYY-MM-DD
  note: string | null;
  source_doc_id: string | null;
  updated_by: string | null;
  updated_at: string;
}

export type ProductStatus = 'draft' | 'active' | 'archived';
export type Unit = 'g' | 'kg' | 'mL' | 'L';
export type TriState = '미확인' | '없음' | '있음';

export interface Product {
  id: string;
  code: string;
  name_ko: string;
  name_en: string | null;
  net_content_value: number | null;
  net_content_unit: Unit | null;
  net_content_note: string | null;
  serving_desc: string | null;
  servings_per_pack: number | null;
  storage_condition: '상온' | '냉장' | '냉동' | null;
  date_type: '소비기한' | '품질유지기한' | null;
  date_period: string | null;
  manufacturer_name: string | null;   // 완제품 제조원 (최종으로 만들거나 포장한 곳)
  finished_country: string | null;
  gtin: string | null;
  halal: TriState;
  storage_text: string | null;
  cooking_en: string | null;
  caution_en: string | null;
  claims: string | null;
  pack_w_mm: number | null; pack_d_mm: number | null; pack_h_mm: number | null;
  label_w_mm: number | null; label_h_mm: number | null;
  export_selected: boolean;           // 다른 탭(서류 등)으로 넘길 수출 제품인지 (목록 · 상세에서 체크)
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface Nutrition {
  kcal: number | null; sodium_mg: number | null; carb_g: number | null; sugar_g: number | null;
  fat_g: number | null; sat_fat_g: number | null; trans_fat_g: number | null;
  cholesterol_mg: number | null; protein_g: number | null; fiber_g: number | null;
}
export const NUTRIENT_KEYS: (keyof Nutrition)[] = [
  'kcal', 'sodium_mg', 'carb_g', 'sugar_g', 'fat_g', 'sat_fat_g', 'trans_fat_g', 'cholesterol_mg', 'protein_g', 'fiber_g',
];

export interface Component {
  id: string;
  name: string;
  manufacturer_name: string | null;
  manufacturer_public: boolean | null;
  report_no: string | null;
  food_type_kr: string | null;
  animal_ingredient: TriState;
  animal_ingredient_detail: string | null;
  cross_contact: string | null;
  nutrition_basis: '100g' | '100mL';
  unit_weight_g: number | null;
  nutrition_source: string | null;
}

export interface ProductComponent {
  component: Component;
  nutrition: Nutrition | null;
  amount: number;
  unit: 'g' | 'mL';
  quantity: number;
  sort_order: number;
}

export interface Ingredient {
  id: string;
  component_id: string;
  parent_id: string | null;
  seq: number;
  name: string;
  origin: string | null;
  is_organic: boolean;
  is_additive: boolean;
  additive_function: string | null;
  ins_no: string | null;
  allergens: string[];
  labeled_pct: number | null;
  pct_basis: '구성품 기준' | '완제품 기준' | null;
}

export interface ProductExport {
  product_id: string;
  hs6: string | null;
  hsk10: string | null;
  hs_checked_at: string | null;
  hs_confirmed_by: string | null;
  hs_classification_id: string | null;
  unit_price: number | null;      // 공개 범위: 내부만
  currency: string | null;
  units_per_ctn: number | null;
  ctn_net_kg: number | null; ctn_gross_kg: number | null;
  ctn_l_cm: number | null; ctn_w_cm: number | null; ctn_h_cm: number | null;
  unit_gross_g: number | null;
  pallet_l_cm: number | null; pallet_w_cm: number | null;
  pallet_layers: number | null; pallet_ctn_count: number | null;
}

/** 기존 라벨 문구 (원문 그대로 보관, 라벨 탭이 번역 · 비교에 씀) */
export type LabelPackLevel = 'unit' | 'outer';   // 개별포장 · 외박스
export const LABEL_PACK_LABEL: Record<LabelPackLevel, string> = { unit: '개별포장', outer: '외박스' };
export const LABEL_ITEMS = {
  product_name: '제품명', net_weight: '내용량', ingredients: '원재료', allergens: '알레르기', instructions: '조리 · 사용 방법',
  storage: '보관 방법', precaution: '주의 문구', date: '제조일 · 기한', origin: '원산지', nutrition: '영양성분',
  manufacturer: '제조원', exporter: '수출자', importer: '수입자', other: '기타',
} as const;
export type LabelItemKey = keyof typeof LABEL_ITEMS;
/** 주소가 들어가는 항목: 외부 공유(external=1) 때 빼고, AI로 보내지 않음 */
export const LABEL_ADDRESS_ITEMS: LabelItemKey[] = ['manufacturer', 'exporter', 'importer'];
export interface LabelText {
  id: string;
  language: string;          // 예: 영어 · 한국어 · 베트남어 (라벨에 적힌 언어)
  pack_level: LabelPackLevel;
  item_key: LabelItemKey;
  text: string;              // 라벨 원문 그대로
  source: string | null;     // 어느 라벨에서 옮겼는지 (예: 영어 라벨 10.14)
  sort_order: number;
}

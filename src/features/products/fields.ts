// 제품 정보 칸 목록 (Claude). 할 일 계산 · 화면 안내 · 내려받기가 이 목록 하나를 기준으로 움직인다.
// uses: 이 칸을 쓰는 탭 / request: 자료 요청 때 묶는 단위 / where: 있으면 좋은 자료 예시 (정답 아님) / hint: 빈 칸 예시

export type UseTab = '규제' | '라벨' | '서류';
export type RequestGroup = 'component_spec' | 'package_label' | 'price_pack';

export type FieldDef = {
  key: string;
  label: string;
  uses: UseTab[];
  request: RequestGroup;
  hint?: string;
  internal?: boolean;   // 공개 범위: 내부만
  optional?: boolean;   // 선택 칸: 값 · 상태는 저장하지만 할 일 · 자료 요청 목록에는 넣지 않음
};

export const REQUEST_GROUPS: Record<RequestGroup, { title: (scope: string) => string; where: string }> = {
  component_spec: {
    title: (c) => `${c} 원료 정보`,
    where: '원료 사양서 · 파우치 라벨 사진 · 제조사 제품 설명서',
  },
  package_label: {
    title: (p) => `${p} 포장 표시 내용`,
    where: '포장 디자인 파일(AI · PDF) · 인쇄소 시안 · 실물 사진',
  },
  price_pack: {
    title: () => '가격 · 포장 사양',
    where: '바이어 견적서 · 포장 사양 메일 · 예전 수출신고서',
  },
};

export const PRODUCT_FIELDS: FieldDef[] = [
  { key: 'name_en', label: '영문 제품명', uses: ['라벨', '서류'], request: 'package_label', hint: '예: Test Tteokbokki · 포장 뒷면 · 수출용 라벨에 있어요' },
  { key: 'net_content_value', label: '총 내용량', uses: ['라벨', '서류'], request: 'package_label' },
  { key: 'storage_condition', label: '보관 조건', uses: ['규제', '라벨'], request: 'package_label', hint: '예: 상온 · 상온 / 냉장 / 냉동 중 하나, 포장의 보관 방법에 있어요' },
  { key: 'date_type', label: '기한 종류', uses: ['라벨'], request: 'package_label', hint: '소비기한 / 품질유지기한 중 하나' },
  { key: 'date_period', label: '소비기한', uses: ['라벨'], request: 'package_label', hint: '예: 12개월 · 포장 표시면 · 제품 규격서에 있어요' },
  { key: 'manufacturer_name', label: '완제품 제조원', uses: ['라벨', '서류'], request: 'package_label', hint: '예: ○○식품(주) · 포장 뒷면 "제조원"에 있어요 (최종으로 만들거나 포장한 곳)' },
  { key: 'finished_country', label: '완제품 제조국', uses: ['규제', '라벨', '서류'], request: 'package_label', hint: '예: 대한민국' },
  { key: 'gtin', label: '바코드', uses: ['라벨'], request: 'package_label', hint: '포장의 바코드 아래 13자리 숫자' },
  { key: 'halal', label: '할랄 인증', uses: ['규제', '라벨'], request: 'package_label' },
  { key: 'storage_text', label: '보관 방법', uses: ['라벨'], request: 'package_label', hint: '예: 직사광선을 피해 서늘한 곳에 보관' },
  { key: 'cooking_en', label: '조리방법', uses: ['라벨'], request: 'package_label' },
  { key: 'packaging', label: '포장 재질', uses: ['라벨'], request: 'package_label' },
  { key: 'pack_size', label: '포장 크기', uses: ['라벨', '서류'], request: 'package_label', hint: '가로 × 세로 × 높이 mm · 포장 전개도 · 포장 사양에 있어요' },
  { key: 'label_size', label: '라벨 부착 면적', uses: ['라벨'], request: 'package_label', hint: '가로 × 세로 mm · 현지어 스티커를 붙일 수 있는 곳' },
  // 외박스 라벨은 나라 · 바이어마다 필요 여부가 달라 선택 칸 (할 일에는 넣지 않음)
  { key: 'outer_label_size', label: '외박스 라벨 부착 면적', uses: ['라벨'], request: 'package_label', optional: true },
];

export const COMPONENT_FIELDS: FieldDef[] = [
  // 구성품 제조원은 내부 관리용 (리콜 · 성분 문의). 외부 라벨 · 서류는 완제품 제조원을 쓴다
  { key: 'manufacturer_name', label: '구성품 제조원', uses: [], request: 'component_spec', optional: true },
  { key: 'report_no', label: '품목보고번호', uses: ['규제'], request: 'component_spec' },
  { key: 'food_type_kr', label: '식품유형', uses: ['규제', '라벨'], request: 'component_spec' },
  { key: 'ingredients', label: '원재료', uses: ['규제', '라벨'], request: 'component_spec' },
  { key: 'animal_ingredient', label: '동물성 원료', uses: ['규제'], request: 'component_spec' },
  { key: 'cross_contact', label: '교차접촉 알레르기', uses: ['라벨'], request: 'component_spec', hint: '예: 같은 시설에서 대두 · 밀 사용 · 없으면 "해당 없음"' },
  { key: 'unit_weight_g', label: '한 포 실중량', uses: ['규제', '라벨'], request: 'component_spec' },
  { key: 'nutrition_source', label: '영양성분 자료', uses: ['규제', '라벨'], request: 'component_spec' },
];

export const EXPORT_FIELDS: FieldDef[] = [
  { key: 'hs6', label: 'HS 6자리', uses: ['규제', '서류'], request: 'price_pack' },
  // HSK 10자리는 HS 찾기(HsCodePicker)로 확정할 때만 채워진다. 화면에서 직접 적지 않으므로 할 일에서는 뺌
  { key: 'hsk10', label: 'HSK 10자리', uses: ['서류'], request: 'price_pack', optional: true },
  { key: 'unit_price', label: '단가', uses: ['서류'], request: 'price_pack', internal: true },
  { key: 'currency', label: '통화', uses: ['서류'], request: 'price_pack', hint: 'USD · EUR · SGD · KRW' },
  { key: 'units_per_ctn', label: '입수 · CTN', uses: ['서류'], request: 'price_pack' },
  { key: 'ctn_net_kg', label: 'CTN 순중량', uses: ['서류'], request: 'price_pack' },
  { key: 'ctn_gross_kg', label: 'CTN 총중량', uses: ['서류'], request: 'price_pack' },
  { key: 'ctn_size', label: 'CTN 크기', uses: ['서류'], request: 'price_pack', hint: '가로 × 세로 × 높이 cm' },
  { key: 'unit_gross_g', label: '1개당 총중량', uses: ['서류'], request: 'price_pack' },
  { key: 'pallet_ctn_count', label: '팔레트 적재', uses: ['서류'], request: 'price_pack' },
];

/** 등록 · 수정 화면에서 이 칸이 있는 탭 (할 일 → "직접 입력"으로 바로 가기) */
export type FormTab = 'basic' | 'comps' | 'nutrition' | 'label' | 'export';
const LABEL_KEYS = new Set(['gtin', 'halal', 'storage_text', 'cooking_en', 'packaging', 'pack_size', 'label_size', 'outer_label_size']);
export const FORM_TAB_LABEL: Record<FormTab, string> = { basic: '기본 정보', comps: '구성품', nutrition: '영양성분', label: '표시 정보', export: '수출 · 물류' };

export const form_tab_of = (entity: string, key: string): FormTab =>
  entity === 'component' ? (key === 'nutrition_source' ? 'nutrition' : 'comps')
  : EXPORT_FIELDS.some((d) => d.key === key) ? 'export' : LABEL_KEYS.has(key) ? 'label' : 'basic';

/** 여러 DB 칸을 묶은 칸 (화면 · 할 일 · 통로에서는 칸 하나로 다룬다). 값은 "150 × 90 × 60" 글자, 원값은 숫자 객체 */
export const COMPOSITE_FIELDS: Record<string, { cols: string[]; names: string[]; unit: string }> = {
  pack_size: { cols: ['pack_w_mm', 'pack_d_mm', 'pack_h_mm'], names: ['w', 'd', 'h'], unit: 'mm' },
  label_size: { cols: ['label_w_mm', 'label_h_mm'], names: ['w', 'h'], unit: 'mm' },
  outer_label_size: { cols: ['outer_label_w_mm', 'outer_label_h_mm'], names: ['w', 'h'], unit: 'mm' },
  ctn_size: { cols: ['ctn_l_cm', 'ctn_w_cm', 'ctn_h_cm'], names: ['l', 'w', 'h'], unit: 'cm' },
};

// [공용] 서류 탭이 제품 · 부속물품을 같은 이름으로 읽는 칸 이름 (Claude, 11/27)
// 통로의 field는 DB 칸 이름이라 제품 · 부속물품이 서로 다르다 (예: finished_country / origin).
// 서류 탭은 fields[].doc_key로 찾으면 두 통로를 같은 코드로 읽을 수 있다. 서류에 안 쓰는 칸은 doc_key가 null.

export type DocKey =
  | 'name_ko' | 'name_en' | 'hs6' | 'hsk10' | 'origin_country' | 'unit_price' | 'currency'
  | 'units_per_ctn' | 'ctn_net_kg' | 'ctn_gross_kg' | 'ctn_size' | 'unit_gross_g';

/** 제품 통로: product · export 칸 (구성품 칸에는 쓰지 않음) */
export const FOOD_DOC_KEYS: Record<string, DocKey> = {
  name_en: 'name_en', hs6: 'hs6', hsk10: 'hsk10', finished_country: 'origin_country',
  unit_price: 'unit_price', currency: 'currency', units_per_ctn: 'units_per_ctn',
  ctn_net_kg: 'ctn_net_kg', ctn_gross_kg: 'ctn_gross_kg', ctn_size: 'ctn_size', unit_gross_g: 'unit_gross_g',
};

/** 부속물품 통로: 물품 · 옵션 칸 */
export const ACCESSORY_DOC_KEYS: Record<string, DocKey> = {
  item_name: 'name_ko', item_name_en: 'name_en', hs6: 'hs6', hsk10: 'hsk10', origin: 'origin_country',
  unit_price: 'unit_price', currency: 'currency', units_per_ctn: 'units_per_ctn',
  ctn_net_kg: 'ctn_net_kg', ctn_gross_kg: 'ctn_gross_kg', ctn_size: 'ctn_size', unit_weight_g: 'unit_gross_g',
};

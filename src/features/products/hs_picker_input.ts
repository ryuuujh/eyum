// HS 찾기(HsCodePicker)에 넘길 식품 입력 만들기 (Claude). 제품 상세의 HS 찾기에서 쓴다.
// 약속(11/25 · 11/27): item_type 'food', item_id = products.id, 기존 HS는 덮어쓰지 않고 existing_classification으로 넘긴다.
// attributes 키는 sanitize의 AI_ALLOWED_FIELDS.food 안에서만 쓴다 (함량 % · 제조원 · 단가 · 주소는 넣지 않음).
import type { ProductDetail } from './data';

import type { HsPickerInput } from '@/lib/hs/contracts';

export type FoodHsPickerInput = HsPickerInput & { item_type: 'food' };

export function build_hs_picker_input(d: ProductDetail): FoodHsPickerInput {
  const p = d.product;
  const e = d.exportInfo;
  const tops = (cid: string) => d.ingredients.filter((i) => i.component_id === cid && !i.parent_id).sort((a, b) => a.seq - b.seq).map((i) => i.name);
  const food_types = [...new Set(d.components.map((c) => c.component.food_type_kr).filter(Boolean))] as string[];
  return {
    item_id: p.id,
    item_name: p.name_ko,
    item_type: 'food',
    ...(p.name_en ? { item_name_en: p.name_en } : {}),
    attributes: {
      ...(food_types.length ? { food_type: food_types.join(', ') } : {}),
      // 구성품별 원재료 이름(많이 든 순서)만. 함량 · 원산지는 보내지 않음
      main_ingredients: d.components.map((c) => `${c.component.name}: ${tops(c.component.id).join(', ')}`).join(' / '),
      packaging_form: d.components.map((c) => `${c.component.name} ${c.amount}${c.unit} × ${c.quantity}`).join(', '),
      ...(p.storage_condition ? { storage: p.storage_condition } : {}),
    },
    // 직접 적은 HS(검토 이력 없음)도 기존 값으로 넘긴다. 그래서 확정일 · 확정자 · 검토 ID는 비어 있을 수 있음
    ...(e?.hs6 ? { existing_classification: {
      hs6: e.hs6, hsk10: e.hsk10, hs_checked_at: e.hs_checked_at, hs_confirmed_by: e.hs_confirmed_by, hs_classification_id: e.hs_classification_id,
    } } : {}),
  };
}

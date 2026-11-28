// 기존 구성품 불러오기용 목록 (Claude)
import 'server-only';
import { get_component_library } from '@/features/products/data';
import { comp_from_library, status_key as sk } from '@/features/products/form';
import type { LibraryItem } from '@/features/products/components/product_form';

export async function library_items(): Promise<LibraryItem[]> {
  return (await get_component_library()).map((l) => ({
    id: l.component.id, name: l.component.name, usedBy: l.usedBy, form: comp_from_library(l),
    hints: Object.fromEntries(l.statuses.map((s) => [sk('component', s.entity_id, s.field_key), { status: s.status, note: s.note }])),
  }));
}

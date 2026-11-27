'use server';
// 제품 저장 (Claude). Supabase가 있으면 DB에, 없으면 예시 데이터(서버 메모리)에 저장한다.
import { revalidatePath } from 'next/cache';
import { get_component_library, get_product_detail, set_export_selected } from './data';
import { persist } from './persist';
import { to_form, to_rows, validate, type ProductForm } from './form';
import { read_request_file, type Change } from './import_request';
import { apply_change } from './apply_changes';
import { ScannedPdfError, extract_from_text, file_to_text } from './extract';
import { findLeftovers, sanitize } from '@/lib/sanitize';

export type SaveResult = { ok: true; code: string } | { ok: false; errors: string[] };

export async function save_product(f: ProductForm): Promise<SaveResult> {
  const errors = validate(f);
  if (errors.length) return { ok: false, errors };
  const before = f.isNew ? null : await get_product_detail(f.code);
  if (!f.isNew && !before) return { ok: false, errors: ['제품을 찾을 수 없어요.'] };
  if (before) { f.id = before.product.id; f.isNew = false; }
  if (f.isNew) f.code = f.code.trim() || `p-${Date.now().toString(36)}`;
  // 다른 제품에서 불러온 구성품은 원래 값 · 상태와 비교해야 손대지 않은 칸이 '확인됨'으로 바뀌지 않음
  const known = new Set(before?.components.map((c) => c.component.id) ?? []);
  const shared = (await get_component_library()).filter((l) => f.comps.some((c) => c.id === l.component.id) && !known.has(l.component.id));
  const prev_base = shared.length ? {
    ...(before ?? { product: { id: f.id } as never, exportInfo: null, packaging: [], labelTexts: [] }),
    components: [...(before?.components ?? []), ...shared.map((l) => ({ component: l.component, nutrition: l.nutrition, amount: 1, unit: (l.component.nutrition_basis === '100mL' ? 'mL' : 'g') as 'g' | 'mL', quantity: 1, sort_order: 0 }))],
    ingredients: [...(before?.ingredients ?? []), ...shared.flatMap((l) => l.ingredients)],
    statuses: [...(before?.statuses ?? []), ...shared.flatMap((l) => l.statuses)],
  } : before;
  const r = to_rows(f, before, new Date(), prev_base);

  await persist(r, f.id);
  revalidatePath('/products');
  revalidatePath(`/products/${f.code}`);
  return { ok: true, code: f.code };
}


/** 요청 목록 엑셀 → 저장 전 확인할 내용 미리보기 */
export async function preview_request_file(code: string, data: FormData) {
  const d = await get_product_detail(code);
  const file = data.get('file');
  if (!d || !(file instanceof File)) return { changes: [] as Change[], warnings: ['파일을 찾을 수 없어요.'] };
  return read_request_file(await file.arrayBuffer(), d);
}

/** 미리보기에서 고른 내용 적용. 기업이 요청 목록에 적은 값은 확인됨 */
export async function apply_imported(code: string, changes: Change[], source: 'company' | 'ai' = 'company'): Promise<SaveResult> {
  const d = await get_product_detail(code);
  if (!d) return { ok: false, errors: ['제품을 찾을 수 없어요.'] };
  const f = to_form(d);
  // AI가 읽은 값은 사람이 미리보기에서 골랐어도 "확인 필요" + 근거 메모로 저장
  for (const c of changes) apply_change(f, c, source === 'ai' ? `AI가 자료에서 읽음: "${c.evidence ?? ''}"` : undefined);
  return save_product(f);
}

/** 메일 · 자료 글 → AI가 읽은 값 미리보기 (주소 · 단가 · 배합비는 보내기 전에 지움) */
/** 1단계: 파일 · 글 → 민감정보 지운 글 (AI 안 씀). 사람이 이 글을 보고 고친 뒤 보낸다 */
export async function prepare_text(code: string, data: FormData) {
  const d = await get_product_detail(code);
  if (!d) return { clean: '', removed: [] as string[], warnings: ['제품을 찾을 수 없어요.'] };
  let text = String(data.get('text') ?? '');
  let dropped: string[] = [];
  const file = data.get('file');
  if (file instanceof File && file.size > 0) {
    if (!/\.(txt|csv|eml|md|xlsx|pdf)$/i.test(file.name)) return { clean: '', removed: [], warnings: ['글 · 엑셀 · PDF 파일만 읽을 수 있어요. 사진은 내용을 글로 붙여 넣어 주세요.'] };
    try {
      const r = await file_to_text(file.name, await file.arrayBuffer());
      text = [text, r.text].filter(Boolean).join('\n\n'); dropped = r.dropped;
    } catch (e) {
      return { clean: '', removed: [], warnings: [e instanceof ScannedPdfError ? e.message : '파일을 열 수 없어요. 다른 파일로 해 주세요.'] };
    }
  }
  const s = sanitize(text);
  const removed = Object.entries(s.removed).map(([k, n]) => `${k} ${n}곳`);
  if (dropped.length) removed.push(`표의 열 ${dropped.join(', ')}`);
  const left = findLeftovers(s.text, { allowPercent: true });
  const warnings = !s.text.trim() ? ['읽을 글이 없어요.']
    : left.length ? [`코드가 못 지운 것 같은 내용이 있어요: ${[...new Set(left.map((l) => `${l.name} "${l.sample}"`))].join(', ')}. 지우지 않으면 AI로 보내지 않아요.`] : [];
  return { clean: s.text.trim(), removed, warnings };
}

/** 2단계: 사람이 확인한 글만 AI로. 한 번 더 지우기 규칙을 거친다 (사람이 붙여 넣은 내용 대비) */
export async function send_to_ai(code: string, clean: string) {
  const d = await get_product_detail(code);
  if (!d) return { changes: [] as Change[], warnings: ['제품을 찾을 수 없어요.'], removed: [] as string[] };
  try {
    return await extract_from_text(clean, d);
  } catch (e) {
    return { changes: [], warnings: [e instanceof Error ? e.message : 'AI 읽기에 실패했어요.'], removed: [] };
  }
}

/** 목록 · 상세의 "수출할 제품" 체크 */
export async function toggle_export_selected(code: string, selected: boolean) {
  await set_export_selected(code, selected);
  revalidatePath('/products');
  revalidatePath(`/products/${code}`);
}

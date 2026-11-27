'use server';
// 부속물품 화면 동작 (Claude, 11/27). 모든 저장은 DB 함수 accessory_action으로.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { accessory_action } from './data';
import type { ConfirmedClassification, HsCandidate, HsConfirmationInput, HsPickerInput, HsQuestion, HsSearchResult } from '@/lib/hs/contracts';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const go = (id: string, option?: string | null) => `/products/accessories/${id}${option ? `?option=${option}` : ''}`;
const done = (id: string, option?: string | null): never => {
  revalidatePath('/products');
  revalidatePath(`/products/accessories/${id}`);
  redirect(go(id, option));
};

export async function create_accessory(f: FormData) {
  const name = s(f, 'name');
  if (!name) return;
  const r = await accessory_action('create', { name, nameEn: s(f, 'nameEn'), description: s(f, 'description'),
    material: s(f, 'material'), purpose: s(f, 'purpose'), shape: s(f, 'shape'), size: s(f, 'size') });
  done(r.id, r.optionId);
}

export async function rename_accessory(id: string, f: FormData) {
  if (!s(f, 'name')) return;
  await accessory_action('rename', { id, name: s(f, 'name'), nameEn: s(f, 'nameEn'), description: s(f, 'description') });
  done(id);
}

export async function add_option(id: string, f: FormData) {
  if (!s(f, 'optionName')) return;
  const r = await accessory_action('add_option', { id, optionName: s(f, 'optionName'), defaultName: s(f, 'defaultName'),
    material: s(f, 'material'), purpose: s(f, 'purpose'), shape: s(f, 'shape'), size: s(f, 'size'),
    unitPrice: s(f, 'unitPrice'), currency: s(f, 'currency') });
  done(id, r.optionId);
}

export async function edit_option(id: string, optionId: string, f: FormData) {
  await accessory_action('edit_option', { id, optionId, optionName: s(f, 'optionName'), code: s(f, 'code'),
    material: s(f, 'material'), purpose: s(f, 'purpose'), shape: s(f, 'shape'), size: s(f, 'size'),
    unitPrice: s(f, 'unitPrice'), currency: s(f, 'currency') });
  done(id, optionId);
}

export async function edit_shipping(id: string, optionId: string, f: FormData) {
  await accessory_action('edit_shipping', { id, optionId, origin: s(f, 'origin'), unitWeightG: s(f, 'unitWeightG'),
    unitsPerCtn: s(f, 'unitsPerCtn'), ctnNetKg: s(f, 'ctnNetKg'), ctnGrossKg: s(f, 'ctnGrossKg'),
    ctnLcm: s(f, 'ctnLcm'), ctnWcm: s(f, 'ctnWcm'), ctnHcm: s(f, 'ctnHcm') });
  done(id, optionId);
}

/** 보관 · 되살리기. optionId가 없으면 물품 전체. 기본 옵션을 보관하면 replacement(새 기본 옵션)가 필요 */
export async function archive_change(id: string, optionId: string | null, restore: boolean, f?: FormData) {
  await accessory_action(restore ? 'restore' : 'archive', { id, optionId, replacement: f ? s(f, 'replacement') : '' });
  if (!optionId && !restore) { revalidatePath('/products'); redirect('/products#accessories'); }
  done(id, restore ? optionId : null);
}

export async function mark_for_review(id: string, optionId: string, f: FormData) {
  if (!s(f, 'why')) return;
  await accessory_action('review', { id, optionId, why: s(f, 'why') });
  done(id, optionId);
}

// ---- HS 찾기 (HsCodePicker에 넘기는 두 함수) ----
const SOURCE_URL = { standard_name: 'https://www.data.go.kr/data/15049721/fileData.do', other: 'https://www.data.go.kr/data/15130660/fileData.do' };
type Row = { hs6: string; hsk10: string | null; label: string; source: HsCandidate['source'] };
const to_candidates = (rows: Row[]): HsCandidate[] => rows.map((r) => ({ hs6: r.hs6, hsk10: r.hsk10, label: r.label, source: r.source,
  official_source_url: r.source === 'standard_name' ? SOURCE_URL.standard_name : SOURCE_URL.other }));

const ATTR_QUESTIONS: HsQuestion[] = [
  { field_key: 'material', label: '재질' }, { field_key: 'purpose', label: '용도' }, { field_key: 'shape', label: '형태' },
];

export async function search_accessory_hs(id: string, item: HsPickerInput, answers: Record<string, string>): Promise<HsSearchResult> {
  // 검색어: 사람이 고친 검색어(answers.query)가 있으면 그것, 없으면 물품명
  const query = (answers.query ?? '').trim() || item.item_name;
  const r = await accessory_action<{ reviewId: string; candidates: Row[] }>('search', { id, optionId: item.item_id, query, answers });
  const attrs = item.attributes ?? {};
  return { classification_id: r.reviewId, candidates: to_candidates(r.candidates),
    questions: [{ field_key: 'query', label: '검색어 (비우면 물품명으로 찾아요)' }, ...ATTR_QUESTIONS.filter((q) => !String(attrs[q.field_key] ?? '').trim())] };
}

export async function confirm_accessory_hs(id: string, optionId: string, sel: HsConfirmationInput): Promise<ConfirmedClassification> {
  await accessory_action('confirm', { id, optionId, reviewId: sel.classification_id, hs6: sel.hs6, hsk10: sel.hsk10, by: sel.confirmed_by, why: sel.human_reason });
  revalidatePath(`/products/accessories/${id}`);
  return { hs6: sel.hs6, hsk10: sel.hsk10, hs_checked_at: new Date().toISOString().slice(0, 10), hs_confirmed_by: sel.confirmed_by, hs_classification_id: sel.classification_id };
}


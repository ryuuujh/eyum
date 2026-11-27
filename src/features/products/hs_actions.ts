'use server';
// 제품(식품) HS 찾기 동작 (Claude, 11/27). DB 함수 food_hs_action으로 후보 검색 → 담당자 확정.
// 확정하면 product_export의 HS와 field_status가 같이 바뀐다 (confirm_hs_classification).
import { revalidatePath } from 'next/cache';
import { db } from './data';
import type { ConfirmedClassification, HsCandidate, HsConfirmationInput, HsPickerInput, HsSearchResult } from '@/lib/hs/contracts';

type Row = { hs6: string; hsk10: string | null; label: string; source: HsCandidate['source'] };

async function call<T>(p: Record<string, unknown>): Promise<T> {
  const client = db();
  if (!client) throw new Error('DB 연결이 없어요 (예시 데이터 모드에서는 HS 찾기를 쓸 수 없어요)');
  const { data, error } = await client.rpc('food_hs_action', { p });
  if (error) throw new Error(error.message);
  return data as T;
}

export async function search_food_hs(item: HsPickerInput, answers: Record<string, string>): Promise<HsSearchResult> {
  // 검색어: 사람이 고친 검색어(answers.query)가 있으면 그것, 없으면 제품 이름 + 식품 유형
  const attrs = item.attributes ?? {};
  const query = (answers.query ?? '').trim() || item.item_name;
  const terms = [attrs.food_type].filter((v): v is string => typeof v === 'string' && !!v.trim()).flatMap((v) => v.split(',').map((x) => x.trim()));
  const r = await call<{ reviewId: string; candidates: Row[] }>({ action: 'search', productId: item.item_id, query, terms, answers });
  return {
    classification_id: r.reviewId,
    candidates: r.candidates.map((c) => ({ ...c, official_source_url: c.source === 'standard_name'
      ? 'https://www.data.go.kr/data/15049721/fileData.do' : 'https://www.data.go.kr/data/15130660/fileData.do' })),
    questions: [{ field_key: 'query', label: '검색어 (비우면 제품 이름으로 찾아요)' }],
  };
}

export async function confirm_food_hs(code: string, product_id: string, sel: HsConfirmationInput): Promise<ConfirmedClassification> {
  const r = await call<ConfirmedClassification>({ action: 'confirm', productId: product_id, reviewId: sel.classification_id,
    hs6: sel.hs6, hsk10: sel.hsk10, by: sel.confirmed_by, why: sel.human_reason });
  revalidatePath(`/products/${code}`);
  return r;
}

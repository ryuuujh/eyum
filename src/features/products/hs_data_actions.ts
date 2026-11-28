'use server';
// 공식 HS 데이터 화면 동작 (Claude, 11/27): 알림 읽음 · 변경 없음, 수동 확인, 승인.
// 엑셀 올리기는 크기 때문에 src/app/products/hs_data/upload/route.ts에서 받는다.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { hs_data_action } from './hs_data';
import { hs_diff_hash, hs_error_text, run_hs_worker, type HsCompare } from './hs_refresh';

const by_of = (f: FormData) => String(f.get('by') ?? '').trim();
const go = (q: Record<string, string>): never => {
  revalidatePath('/products/hs_data');
  revalidatePath('/products');
  redirect(`/products/hs_data?${new URLSearchParams(q)}#update`);
};

export async function read_hs_notice(id: string, f: FormData) {
  if (!by_of(f)) return;
  await hs_data_action('read_notice', { id, by: by_of(f) });
  revalidatePath('/products/hs_data');
  revalidatePath('/products');
}

export async function mark_hs_notice_no_change(id: string, f: FormData) {
  if (!by_of(f)) return;
  await hs_data_action('no_change', { id, by: by_of(f) });
  revalidatePath('/products/hs_data');
  revalidatePath('/products');
}

export async function check_hs_now(dataset: 'hsk' | 'standard_names') {
  let status: string;
  try { status = (await run_hs_worker<{ status: string }>({ action: 'check', dataset })).status; }
  catch (e) { return go({ error: hs_error_text((e as Error).message) }); }
  go({ msg: `check_${status}` });
}

export async function approve_hs_update(f: FormData) {
  const v = (k: string) => String(f.get(k) ?? '').trim();
  const [expected, candidate, by, reason] = [v('expected'), v('candidate'), v('by'), v('reason')];
  if (!by || !reason) go({ candidate, error: '승인한 사람과 사유를 적어 주세요' });
  let count: number;
  try {
    const now = await run_hs_worker<HsCompare>({ action: 'compare', expected, candidate });
    if (hs_diff_hash(now.differences) !== v('diff_hash')) throw new Error('화면을 연 뒤 비교 결과가 바뀌었어요. 다시 확인해 주세요');
    count = (await run_hs_worker<{ count: number }>({ action: 'approve', expected, candidate, notice: v('notice') || null, by, reason, differences: now.differences })).count;
  } catch (e) {
    return go({ candidate, error: `승인하지 못했어요. 지금 데이터를 그대로 써요. (${hs_error_text((e as Error).message)})` });
  }
  go({ msg: 'approved', count: String(count) });
}
